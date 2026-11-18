import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let blobInfo={contentType:'application/pdf',size:10};
let queries=[],puts=[],linked=true,existingPurchase='paid-A';
const db={query:async(sql,args)=>{queries.push({sql,args});if(sql.startsWith('SELECT 1 FROM santa_message_accounts'))return {rowCount:linked?1:0};if(sql.startsWith('INSERT'))return {rows:[{id:'00000000-0000-4000-8000-000000000001',purchase_id:existingPurchase,expires_at:'2027-02-01'}]};return {rowCount:1}}};
mock.module('../server/contenders-database.js',{namedExports:{databasePool:()=>db}});
mock.module('../server/name-request-store.js',{namedExports:{databasePool:()=>db}});
mock.module('../server/studio-live-access.js',{namedExports:{livePaidPurchaseId:async()=> 'paid-A'}});
mock.module('@vercel/blob',{namedExports:{put:async(...args)=>{puts.push(args);return{}},head:async()=>blobInfo}});
const {archiveRecording,acceptAsset}=await import('../server/message-account-store.js');
process.env.STUDIO_ACCOUNTS_ENABLED='true';
test('unlinked paid customers do not upload personal recordings',async()=>{linked=false;puts=[];assert.equal(await archiveRecording({},Buffer.from('a'),'operation','Child'),null);assert.equal(puts.length,0)});
test('an operation collision cannot overwrite another customer recording',async()=>{linked=true;existingPurchase='paid-B';puts=[];await assert.rejects(archiveRecording({},Buffer.from('a'),'operation','Child'),/another purchase/);assert.equal(puts.length,0)});
test('linked purchase audio is private and receives bounded retention',async()=>{existingPurchase='paid-A';puts=[];await archiveRecording({},Buffer.from('a'),'operation','Child');assert.equal(puts[0][2].access,'private');assert.ok(puts[0][2].ttlDays>=1);assert.ok(puts[0][2].ttlDays<=367);assert.equal(puts[0][0],'santa-messages/00000000-0000-4000-8000-000000000001/audio.mp3')});

test('video archives reject wrong types, empty and oversized files',async()=>{
 const row={id:'00000000-0000-4000-8000-000000000001'};
 for(const info of [{contentType:'audio/mpeg',size:10},{contentType:'video/mp4',size:0},{contentType:'video/mp4',size:64*1024*1024+1}]){blobInfo=info;await assert.rejects(acceptAsset(row,'video'));}
 blobInfo={contentType:'video/mp4',size:20*1024*1024};await acceptAsset(row,'video');assert.match(queries.at(-1).args[1],/video.mp4/);
});
