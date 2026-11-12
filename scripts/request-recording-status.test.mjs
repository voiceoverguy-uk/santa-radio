import test from 'node:test';
import assert from 'node:assert/strict';
import { requestRecordingStatus } from '../server/request-recording-status.js';
test('matches exact recorded labels ignoring case without prefix false positives', async () => {
 const rows = [{name:'Gail',count:1},{name:'Ga',count:2}];
 const result = await requestRecordingStatus(rows, async()=>[{name:'gail'}]);
 assert.deepEqual(result.map(r=>r.recordingStatus),['available','not_found']);
 assert.equal(rows[0].recordingStatus,undefined);
});
test('index failure is unknown, never falsely missing',async()=>{
 assert.equal((await requestRecordingStatus([{name:'Gail'}],async()=>{throw Error('offline')}))[0].recordingStatus,'unknown');
});
test('empty queue does not fetch library',async()=>{
 assert.deepEqual(await requestRecordingStatus([],async()=>{throw Error('must not fetch')}),[]);
});
