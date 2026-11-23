import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VERSION,makeTicket,readTicket,authorise,validateAudio,saveRecording,rateLimit} from '../server/helper-submissions.js';
process.env.SESSION_SECRET='local-test-secret-only-'.repeat(3);
process.env.SLH_BLOB_READ_WRITE_TOKEN='local-test-storage';
const id='12345678-1234-4234-8234-123456789abc';
test('permission tickets reject tampering, expiry and oversized input',()=>{
 const token=makeTicket(id,1000000);
 assert.equal(readTicket(token,1000001).id,id);
 assert.equal(readTicket(token,1900000),null);
 assert.equal(readTicket(token+'x',1000001),null);
 assert.equal(readTicket('x'.repeat(2000)),null);
});
test('permission must be current and explicit before any database write',async()=>{
 let writes=0;const pool={query:async()=>{writes++;return {rowCount:1};}};
 for(const fields of [{},{adult:true,permission:false,version:VERSION},{adult:true,permission:true,version:'old'}])await assert.rejects(authorise(fields,pool));
 assert.equal(writes,0);
 const grant=await authorise({adult:true,permission:true,version:VERSION},pool);
 assert.equal(readTicket(grant.ticket).id,grant.reference);
});
test('audio validation checks actual content, size and duration',async()=>{
 await assert.rejects(validateAudio(Buffer.from('fake audio'),'audio/mp4'));
 await assert.rejects(validateAudio(Buffer.alloc(3*1024*1024+1),'audio/mp4'));
 const tone=fs.readFileSync(new URL('./fixtures/helpers/short-tone.m4a',import.meta.url));
 assert.ok(await validateAudio(tone,'audio/mp4')<=20.3);
 await assert.rejects(validateAudio(tone,'text/plain'));
 await assert.rejects(validateAudio(fs.readFileSync(new URL('./fixtures/helpers/overlong-tone.m4a',import.meta.url)),'audio/mp4'));
});
test('rate limit refusal prevents authorisation and never retains raw IP',async()=>{
 let key;await assert.rejects(rateLimit({headers:{'x-vercel-forwarded-for':'192.0.2.2'}},{query:async(_sql,args)=>{key=args[0];return {rowCount:0};}}),{status:429});
 assert.ok(!key.includes('192.0.2.2'));
});
test('successful upload is private and retry is idempotent; changed audio is refused',async()=>{
 let row={consent_version:VERSION,audio_sha256:null,submitted_at:null};let writes=0,clip=false;
 const client={release(){},async query(sql,args){
  if(sql.startsWith('SELECT *'))return {rows:[{...row}]};
  if(sql.includes('SET audio_sha256'))row.audio_sha256=args[1];
  if(sql.includes('INSERT INTO santa_helper_clips'))clip=true;
  if(sql.includes('SET submitted_at'))row.submitted_at=new Date();
  if(sql.startsWith('SELECT id'))return {rowCount:clip?1:0};
  return {rowCount:1,rows:[]};
 }};
 const options={pool:{connect:async()=>client},write:async(path,_bytes,opt)=>{writes++;assert.equal(path,`little-helpers/submissions/${id}.m4a`);assert.equal(opt.access,'private');assert.equal(opt.allowOverwrite,false);}};
 assert.equal((await saveRecording({id},Buffer.from('audio'),1,options)).received,true);
 await saveRecording({id},Buffer.from('audio'),1,options);assert.equal(writes,1);
 await assert.rejects(saveRecording({id},Buffer.from('other audio'),1,options),{status:409});
});
