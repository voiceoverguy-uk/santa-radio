import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { put } from '@vercel/blob';
import { parseBuffer } from 'music-metadata';
import { databasePool } from './name-request-store.js';
export const VERSION = 'adult-submission-2026-11-23-v1';
export const PERMISSION = 'I am 18 or over and am making this submission myself. I have permission from every adult heard and am the parent or legal guardian authorising every child included. I agree that Santa Radio may edit, mix and broadcast this recording in Santa’s Little Helpers and jingles, including future Christmas seasons. I have read the recording privacy notice.';
export const MAX_BYTES = 3 * 1024 * 1024;
export const problem = (message,status=400) => Object.assign(new Error(message),{status});
const secret = () => { if((process.env.SESSION_SECRET || '').length<32) throw problem('Sending is temporarily unavailable.',503); return process.env.SESSION_SECRET; };
const digest = value => createHmac('sha256',secret()).update(`helper-submission:${value}`).digest('hex');
export function makeTicket(id, now=Date.now()) {
  const value=Buffer.from(JSON.stringify({id,version:VERSION,exp:now+15*60*1000})).toString('base64url');
  return `${value}.${digest(value)}`;
}
export function readTicket(value, now=Date.now()) {
  if(typeof value!=='string'||value.length>1000) return null;
  const [body,sig,...extra]=value.split('.');
  if(extra.length||!body||! /^[a-f0-9]{64}$/.test(sig||''))return null;
  if(!timingSafeEqual(Buffer.from(sig),Buffer.from(digest(body))))return null;
  try { const data=JSON.parse(Buffer.from(body,'base64url')); return /^[a-f0-9-]{36}$/.test(data.id)&&data.version===VERSION&&data.exp>now&&data.exp<=now+900000 ? data:null; } catch{return null;}
}
export async function rateLimit(req,pool=databasePool(),upload=false) {
  // Vercel overwrites this header. Never retain raw network addresses in consent records.
  const address=String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const hour=Math.floor(Date.now()/3600000);
  for(const [key,max] of [[`ip:${digest(address)}`,upload?36:12],['global',upload?6000:2000]]) {
    const result=await pool.query(`INSERT INTO santa_name_request_limits(bucket_key,attempts,expires_at) VALUES($1,1,$2)
      ON CONFLICT(bucket_key) DO UPDATE SET attempts=santa_name_request_limits.attempts+1
      WHERE santa_name_request_limits.attempts<$3 RETURNING bucket_key`,[`helpers:${upload?'upload':'permission'}:${key}:${hour}`,new Date((hour+1)*3600000),max]);
    if(!result.rowCount)throw problem('Too many requests. Please try again in an hour.',429);
  }
}
export async function authorise(fields,pool=databasePool()) {
  if(fields.adult!==true||fields.permission!==true||fields.version!==VERSION)throw problem('An adult must read and agree to the recording permissions.');
  const id=randomUUID();
  await pool.query("DELETE FROM santa_helper_permissions WHERE submitted_at IS NULL AND created_at<now()-interval '1 day'");
  await pool.query(`INSERT INTO santa_helper_permissions(id,consent_version,consent_copy) VALUES($1,$2,$3)`,[id,VERSION,PERMISSION]);
  return {reference:id,ticket:makeTicket(id)};
}
export async function validateAudio(buffer,mime) {
  if(!['audio/mp4','audio/x-m4a'].includes(mime)||!buffer.length||buffer.length>MAX_BYTES)throw problem('Please send a valid M4A recording of up to 20 seconds.');
  const metadata=await parseBuffer(buffer,{mimeType:mime},{duration:true});
  const duration=metadata.format.duration;
  if(!Number.isFinite(duration)||duration<0.25||duration>20.3||!metadata.format.numberOfChannels||metadata.format.hasVideo
    ||!String(metadata.format.container).split('/').some(brand=>['M4A','isom','mp42','MPEG-4'].includes(brand)))throw problem('Please send a valid recording of up to 20 seconds.');
  return duration;
}
export async function saveRecording(ticket,buffer,duration,{pool=databasePool(),write=put}={}) {
  const storage=process.env.SLH_BLOB_READ_WRITE_TOKEN;
  if(!storage)throw problem('Sending is temporarily unavailable.',503);
  const hash=createHash('sha256').update(buffer).digest('hex');
  const pathname=`little-helpers/submissions/${ticket.id}.m4a`;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const row=(await client.query('SELECT * FROM santa_helper_permissions WHERE id=$1 FOR UPDATE',[ticket.id])).rows[0];
    if(!row||row.consent_version!==VERSION)throw problem('Please review the permissions again.',401);
    if(row.audio_sha256&&row.audio_sha256!==hash)throw problem('This reference belongs to another recording. Please record again.',409);
    if(row.submitted_at) {
      const existing=await client.query('SELECT id FROM santa_helper_clips WHERE id=$1 AND deleted_at IS NULL AND trashed_at IS NULL',[ticket.id]);
      if(!existing.rowCount)throw problem('This recording has already been processed. Please record a new message.',409);
    } else {
      // Persist the expected hash before Blob upload, so a retry cannot change the audio.
      await client.query('UPDATE santa_helper_permissions SET audio_sha256=$2 WHERE id=$1',[ticket.id,hash]);
      await client.query('COMMIT');
      await client.query('BEGIN');
      const locked=(await client.query('SELECT * FROM santa_helper_permissions WHERE id=$1 FOR UPDATE',[ticket.id])).rows[0];
      if(locked.audio_sha256!==hash)throw problem('Recording mismatch.',409);
      if(!locked.submitted_at) {
        try { await write(pathname,buffer,{token:storage,access:'private',contentType:'audio/mp4',addRandomSuffix:false,allowOverwrite:false}); }
        catch(error) { if(error?.name!=='BlobAlreadyExistsError')throw error; }
        await client.query(`INSERT INTO santa_helper_clips(id,pathname,bytes,created_at) VALUES($1,$2,$3,now()) ON CONFLICT(id) DO NOTHING`,[ticket.id,pathname,buffer.length]);
        await client.query('UPDATE santa_helper_permissions SET submitted_at=now(),duration=$2 WHERE id=$1',[ticket.id,duration]);
      }
    }
    await client.query('COMMIT');
    return {reference:ticket.id,received:true};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
