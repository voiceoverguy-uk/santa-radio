import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteSavedMessage} from '../server/message-account-delete.js';
const id='00000000-0000-4000-8000-000000000001';
test('delete checks ownership, expires first, and removes every asset including unfinished gifts',async()=>{
 const events=[];
 const db={query:async(sql,args)=>{assert.match(sql,/a.user_id=\$2/);assert.match(sql,/LEAST\(m.expires_at,now\(\)\)/);assert.deepEqual(args,[id,'owner']);events.push('expire');return{rows:[{id}]}}};
 assert.equal(await deleteSavedMessage(db,'owner',id,async paths=>{events.push('delete');assert.deepEqual(paths,[`santa-messages/${id}/audio.mp3`,`santa-messages/${id}/certificate.pdf`,`santa-messages/${id}/letter.pdf`,`santa-messages/${id}/picture.png`])}),true);
 assert.deepEqual(events,['expire','delete']);
});
test('unknown owner and malformed identifiers cannot delete files',async()=>{
 let reads=0;const db={query:async()=>{reads++;return{rows:[]}}};const remove=()=>{throw Error('must not delete')};
 assert.equal(await deleteSavedMessage(db,'other',id,remove),false);
 assert.equal(await deleteSavedMessage(db,'owner','../../file',remove),false);assert.equal(reads,1);
});
test('storage failure leaves the expired row for scheduled retry',async()=>{
 let expired=false;
 const db={query:async()=>{expired=true;return{rows:[{id}]}}};
 await assert.rejects(deleteSavedMessage(db,'owner',id,async()=>{throw Error('storage offline')}),/storage offline/);
 assert.equal(expired,true);
});
