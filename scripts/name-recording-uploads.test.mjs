import {createLiveNameUploads} from '../server/live-name-uploads.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createNameUploads, recordingUploadPath, validateRecording } from '../server/name-recording-uploads.js';
async function withServer(options,run){const server=createServer(createNameUploads(options));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}}
const env={BLOB_READ_WRITE_TOKEN:'test-only'};
function wav(){const b=Buffer.alloc(44+9600);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(9600,40);return b;}
test('real WAV validation accepts audio and rejects corrupt input',async()=>{await validateRecording(wav(),'wav');await assert.rejects(validateRecording(Buffer.from('not audio'),'wav'));});
test('paths isolate tests and retries are stable',()=>{const path=recordingUploadPath('Gail','wav',wav());assert.match(path,/^name-recording-tests\//);assert.equal(path,recordingUploadPath('Gail','wav',wav()));assert.throws(()=>recordingUploadPath('../Gail','wav',wav()));assert.notEqual(path,recordingUploadPath('Gaïl','wav',wav()));});
test('unauthorized requests never access storage',async()=>{await withServer({allowed:()=>false,env,storage:{list:()=>assert.fail()}},async url=>assert.equal((await fetch(url)).status,401));});
test('upload validates, stores privately, previews and excludes other namespaces',async()=>{
 const files=new Map();let savedOptions;
 const storage={put:async(path,body,options)=>{files.set(path,body);savedOptions=options;},list:async()=>({blobs:[...files].map(([pathname,body])=>({pathname,size:body.length,uploadedAt:new Date()})),hasMore:false}),get:async path=>files.has(path)?{statusCode:200,stream:new ReadableStream({start(c){c.enqueue(files.get(path));c.close();}})}:null};
 const publisher=createLiveNameUploads({storage});
 const liveLibrary={load:async(options)=>({records:await publisher.records(options)}),sourceBytes:async r=>files.get(r.path)};
 let completions=0;
 await withServer({allowed:()=>true,env,storage,publisher,liveLibrary,completeRequests:async()=>{completions++;return {status:"complete",requests:1}}},async url=>{
 const headers={'X-Recording-Publish':'live','Content-Type':'application/octet-stream','X-Recording-Name':'Gail','X-Recording-Format':'wav',Origin:url};
 const denied=await fetch(url,{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:wav()});assert.equal(denied.status,403);assert.equal(files.size,0);
 const stale=await fetch(url,{method:'POST',headers:{...headers,'X-Recording-Publish':''},body:wav()});assert.equal(stale.status,409);assert.equal(files.size,0);
 const corrupt=await fetch(url,{method:'POST',headers,body:'invalid'});assert.equal(corrupt.status,400);assert.equal(files.size,0);assert.equal(completions,0);
 const result=await fetch(url,{method:'POST',headers,body:wav()});assert.equal(result.status,200);const saved=await result.json();assert.equal(saved.status,'live');assert.equal(savedOptions.access,'private');assert.equal(completions,1);assert.equal(saved.requestCompletion.status,'complete');
 await fetch(url,{method:'POST',headers,body:wav()});assert.equal(files.size,2);assert.equal(completions,2);
 const listing=await (await fetch(url)).json();assert.equal(listing.recordings[0].name,'Gail');
 const audio=await fetch(url+'?path='+encodeURIComponent(saved.path));assert.equal(audio.status,200);assert.deepEqual(Buffer.from(await audio.arrayBuffer()),wav());
 assert.equal((await fetch(url+'?path=santa-messages/private/audio.mp3')).status,400);
 });
});
test('unconfigured storage returns an actionable error',async()=>{await withServer({allowed:()=>true,env:{}},async url=>assert.equal((await fetch(url)).status,503));});
test('server normalizes spaces to dashes in stored name identity',()=>{assert.equal(recordingUploadPath('Ellie May','wav',wav()),recordingUploadPath('Ellie-May','wav',wav()));});
test('library search spans storage pages and returns only 20 rows per browser page',async()=>{
 const entries=Array.from({length:45},(_,i)=>({pathname:recordingUploadPath('Test-'+String(i).padStart(3,'0'),'wav',wav()),size:100,uploadedAt:new Date()}));
 entries.push({pathname:recordingUploadPath('Ellie May','wav',wav()),size:100,uploadedAt:new Date()});
 let reads=0;const storage={list:async({cursor})=>{reads++;return cursor?{blobs:entries.slice(30),hasMore:false}:{blobs:entries.slice(0,30),hasMore:true,cursor:'second'};}};
 await withServer({allowed:()=>true,env,storage},async url=>{
 const first=await(await fetch(url)).json();assert.equal(first.recordings.length,20);assert.equal(first.total,46);assert.equal(first.totalPages,3);
 const second=await(await fetch(url+'?page=2')).json();assert.equal(second.recordings.length,20);assert.equal(second.page,2);assert.ok(!second.recordings.some(r=>first.recordings.some(f=>f.path===r.path)));
 const search=await(await fetch(url+'?search=ellie%20may')).json();assert.equal(search.recordings[0].name,'Ellie-May');assert.equal(search.total,1);assert.equal(reads,2);
 assert.equal((await fetch(url+'?page=0')).status,400);
 });
});
test('live library pages and playback stay separate from test uploads',async()=>{
 const records=Array.from({length:25},(_,i)=>({id:String(i),name:`Áine-${i}`,file:`Áine-${i}.mp3`,blobPath:`name-library/${i}`,size:100,uploadedAt:'2026-11-12T12:00:00Z'}));
 const liveLibrary={load:async()=>({records}),sourceBytes:async()=>Buffer.alloc(100,1)};
 await withServer({allowed:()=>true,env,liveLibrary,storage:{list:async()=>({blobs:[],hasMore:false})}},async url=>{
  const body=await(await fetch(url+'?page=2')).json();assert.equal(body.mode,'live');assert.equal(body.recordings.length,5);assert.equal(body.libraryTotal,25);
  const testing=await(await fetch(url+'?scope=testing')).json();assert.equal(testing.mode,'testing');assert.equal(testing.total,0);
  assert.equal((await fetch(url+'?path=name-library/0')).status,200);assert.equal((await fetch(url+'?path=name-library/unknown')).status,404);
 });
});
