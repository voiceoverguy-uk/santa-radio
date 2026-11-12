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
 await withServer({allowed:()=>true,env,storage},async url=>{
 const headers={'Content-Type':'application/octet-stream','X-Recording-Name':'Gail','X-Recording-Format':'wav',Origin:url};
 const denied=await fetch(url,{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:wav()});assert.equal(denied.status,403);assert.equal(files.size,0);
 const corrupt=await fetch(url,{method:'POST',headers,body:'invalid'});assert.equal(corrupt.status,400);assert.equal(files.size,0);
 const result=await fetch(url,{method:'POST',headers,body:wav()});assert.equal(result.status,200);const saved=await result.json();assert.equal(saved.status,'testing');assert.equal(savedOptions.access,'private');
 await fetch(url,{method:'POST',headers,body:wav()});assert.equal(files.size,1);
 const listing=await (await fetch(url)).json();assert.equal(listing.recordings[0].name,'Gail');
 const audio=await fetch(url+'?path='+encodeURIComponent(saved.path));assert.equal(audio.status,200);assert.deepEqual(Buffer.from(await audio.arrayBuffer()),wav());
 assert.equal((await fetch(url+'?path=santa-messages/private/audio.mp3')).status,400);
 });
});
test('unconfigured storage returns an actionable error',async()=>{await withServer({allowed:()=>true,env:{}},async url=>assert.equal((await fetch(url)).status,503));});
