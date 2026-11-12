import test from 'node:test';
import assert from 'node:assert/strict';
import { requestRecordingStatus, recordingFileExists } from '../server/request-recording-status.js';
test('matches exact recorded labels ignoring case without prefix false positives', async () => {
 const rows = [{name:'Gail',count:1},{name:'Ga',count:2}];
 const result = await requestRecordingStatus(rows, async()=>[{name:'gail'}]);
 assert.deepEqual(result.map(r=>r.recordingStatus),['available','not_found']);
 assert.equal(rows[0].recordingStatus,undefined);
});
test('index failure is unknown, never falsely missing',async()=>{
 assert.equal((await requestRecordingStatus([{name:'Gail'}],async()=>{throw Error('offline')},async()=>false))[0].recordingStatus,'unknown');
});
test('empty queue does not fetch library',async()=>{
 assert.deepEqual(await requestRecordingStatus([],async()=>{throw Error('must not fetch')}),[]);
});

test('failed index still identifies uploaded Gail audio',async()=>{
 const result=await requestRecordingStatus([{name:'Gail'},{name:'Missing'}],async()=>{throw Error('offline')},async name=>name==='Gail');
 assert.deepEqual(result.map(r=>r.recordingStatus),['available','unknown']);
});
test('file check requires audio, does not follow redirects or bypass private configuration',async()=>{
 let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.equal(options.headers.Range,'bytes=0-11');assert.equal(options.redirect,'error');return new Response('RIFF1234WAVE',{status:206,headers:{'content-type':'audio/x-wav'}})};
 assert.equal(await recordingFileExists('Gail',{fetcher,env:{}}),true);
 assert.equal(calls,1);
 assert.equal(await recordingFileExists('../Gail',{fetcher,env:{}}),false);
 assert.equal(await recordingFileExists('Gail',{fetcher,env:{SANTA_LIBRARY_GATEWAY_URL:'https://private.example'}}),false);
 assert.equal(calls,1);
 assert.equal(await recordingFileExists('Gail',{env:{},fetcher:async()=>new Response(null,{headers:{'content-type':'text/html','content-length':'1000'}})}),false);
});
