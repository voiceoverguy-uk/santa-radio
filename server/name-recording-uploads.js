import { blobNameLibrary } from './blob-name-library.js';
import { recordingUploadName } from '../src/lib/recordingUploadName.js';
import express from 'express';
import { put, list, get } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { validOwnerToken } from './studio-owner-handler.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
const prefix = 'name-recording-tests/';
const pathPattern = /^name-recording-tests\/([a-f0-9]{64})\/([a-f0-9]+)\.(mp3|wav)$/;
export const MAX_RECORDING_BYTES = 3 * 1024 * 1024;
export function recordingUploadPath(name, extension, bytes) {
  name=recordingUploadName(name);
  if (typeof name !== 'string' || !/^[\p{L}\p{M}][\p{L}\p{M}0-9 '’_-]{0,79}$/u.test(name) || !['mp3','wav'].includes(extension)) throw new Error('Choose a name and an MP3 or WAV file.');
  return `${prefix}${createHash('sha256').update(bytes).digest('hex')}/${Buffer.from(name.normalize('NFC')).toString('hex')}.${extension}`;
}
export async function validateRecording(bytes, extension) {
  const { createNameLibrary, validateNameWav } = await import('./santa-name-library.js');
  if (extension === 'wav') return validateNameWav(bytes);
  const directory = await mkdtemp(join(tmpdir(), 'name-upload-'));
  try { await createNameLibrary().download({source:'hosted',file:'upload.mp3'},join(directory,'decoded.wav'),bytes); }
  finally { await rm(directory,{recursive:true,force:true}); }
}
export function createNameUploads({allowed=validOwnerToken, storage={put,list,get}, validate=validateRecording, env=process.env, liveLibrary=blobNameLibrary}={}) {
  let cached, cacheUntil=0, pending, version=0;
  async function inventory() {
    if(cached && Date.now()<cacheUntil)return cached;
    if(pending)return pending;
    const current=version;
    pending=(async()=>{
      const rows=[];let cursor;
      const abortSignal=AbortSignal.timeout(12000);
      do {
        const result=await storage.list({prefix,limit:1000,...(cursor?{cursor}:{}),abortSignal});
        for(const b of result.blobs) {
          const match=b.pathname.match(pathPattern);
          if(match)rows.push({path:b.pathname,name:Buffer.from(match[2],'hex').toString('utf8'),size:b.size,uploadedAt:b.uploadedAt});
        }
        cursor=result.hasMore?result.cursor:null;
        if(result.hasMore&&!cursor)throw new Error('Invalid storage page');
        if(rows.length>20000)throw new Error('Recording catalogue limit exceeded');
      }while(cursor);
      rows.sort((a,b)=>a.name.localeCompare(b.name,'en-GB')||a.path.localeCompare(b.path));
      if(current===version){cached=rows;cacheUntil=Date.now()+60000;}
      return rows;
    })().finally(()=>{pending=null;});
    return pending;
  }
  const app=express(); app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set('Cache-Control','private, no-store').set('CDN-Cache-Control','no-store').set('X-Robots-Tag','noindex, nofollow');
    if(!allowed(req)) return res.status(401).json({error:'Unlock the dashboard to manage recordings.'});
    if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed.'});
    if(req.method==='POST') {
      let origin; try {origin=new URL(req.headers.origin);} catch {}
      if(origin?.host!==getClerkProxyHost(req) || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Please upload from the dashboard.'});
    }
    if(!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) return res.status(503).json({error:'Private Blob storage must be connected before uploading recordings.'});
    next();
  });
  app.use(express.raw({type:'application/octet-stream',limit:MAX_RECORDING_BYTES,inflate:false}));
  app.use(async(req,res)=>{
    try {
      if(req.method==='POST') {
        let name;try{name=recordingUploadName(decodeURIComponent(req.headers['x-recording-name'] || ''));}catch{return res.status(400).json({error:'Choose a valid name.'});}
        const extension=req.headers['x-recording-format'];const bytes=req.body;
        if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_RECORDING_BYTES) return res.status(400).json({error:'Choose an MP3 or WAV up to 3 MB.'});
        let path;try{path=recordingUploadPath(name,extension,bytes);await validate(bytes,extension);}catch{return res.status(400).json({error:'This recording could not be validated. Use a valid MP3 or WAV, 0.05–30 seconds long.'});}
        // Content-addressed uploads make retries safe. This namespace is never read
        // by the live name catalogue or customer-message expiry worker.
        await storage.put(path,bytes,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:extension==='wav'?'audio/wav':'audio/mpeg'});
        version++;cached=null;cacheUntil=0;
        return res.json({name,path,status:'testing'});
      }
      if(req.query.path) {
        if(typeof req.query.path==='string' && req.query.path.startsWith('name-library/')) {
          const library=await liveLibrary.load();
          const record=library?.records.find(r=>r.blobPath===req.query.path);
          if(!record)return res.status(404).json({error:'Recording not found.'});
          const data=await liveLibrary.sourceBytes(record);
          return res.type(record.file.toLowerCase().endsWith('.wav')?'audio/wav':'audio/mpeg').set('X-Content-Type-Options','nosniff').send(data);
        }
        if(typeof req.query.path!=='string'||!pathPattern.test(req.query.path)) return res.status(400).json({error:'Invalid recording.'});
        const result=await storage.get(req.query.path,{access:'private'});
        if(!result||result.statusCode===304)return res.status(404).json({error:'Recording not found.'});
        res.set('Content-Type',req.query.path.endsWith('.wav')?'audio/wav':'audio/mpeg').set('X-Content-Type-Options','nosniff');
        return await pipeline(Readable.fromWeb(result.stream),res);
      }
      const search=req.query.search??'', pageText=req.query.page??'1';
      if(typeof search!=='string'||search.length>80||typeof pageText!=='string'||!/^\d{1,4}$/.test(pageText)||Number(pageText)<1)return res.status(400).json({error:'Invalid search or page.'});
      const live=req.query.scope==='testing'?null:await liveLibrary.load();
      const all=live?live.records.map(r=>({path:r.blobPath,name:r.name,size:r.size,uploadedAt:r.uploadedAt})).sort((a,b)=>a.name.localeCompare(b.name,'en-GB')||a.path.localeCompare(b.path)):await inventory();
      const key=recordingUploadName(search).toLocaleLowerCase('en-GB');
      const matches=key?all.filter(row=>recordingUploadName(row.name).toLocaleLowerCase('en-GB').includes(key)):all;
      const totalPages=Math.max(1,Math.ceil(matches.length/20)),page=Math.min(Number(pageText),totalPages);
      return res.json({mode:live?'live':'testing',recordings:matches.slice((page-1)*20,page*20),page,totalPages,total:matches.length,libraryTotal:all.length});
    }catch{if(!res.headersSent)res.status(503).json({error:'Recording storage is unavailable. Refresh the list before retrying an upload.'});}
  });
  app.use((err,_req,res,_next)=>res.status(err.type==='entity.too.large'?413:400).json({error:err.type==='entity.too.large'?'Each recording must be 3 MB or smaller.':'Invalid upload.'}));
  return app;
}
export default createNameUploads();
