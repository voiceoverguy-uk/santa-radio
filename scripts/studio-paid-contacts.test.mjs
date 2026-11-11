import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { paidContactConfig, upsertPaidContact, syncPaidStudioContact } from '../server/studio-paid-contacts.js';
import { createLiveWebhookHandler } from '../server/studio-live-webhook.js';
const connection={key:'fixture-only',listId:20};
const response=(status,data={})=>({status,ok:status>=200&&status<300,json:async()=>data});
test('paid sync is disabled until explicitly configured',()=>{
 assert.equal(paidContactConfig({}),null);
 assert.throws(()=>paidContactConfig({STUDIO_BREVO_SYNC_ENABLED:'true'}),/NOT_CONFIGURED/);
});
for(const blocked of [false,true]) test(`existing marketing preference ${blocked} is never changed`,async()=>{
 const calls=[];
 await upsertPaidContact({email:'test@example.invalid',firstName:'Brenda',connection,fetcher:async(url,options)=>{
   calls.push({url,...options});return calls.length===1?response(200,{emailBlacklisted:blocked,attributes:{FIRSTNAME:'Existing'},listIds:[8]}):response(204);
 }});
 const update=JSON.parse(calls[1].body);
 assert.deepEqual(update,{attributes:{},listIds:[20]});assert.equal(calls[1].method,'PUT');
});
test('new paid contact is not automatically subscribed to marketing',async()=>{
 const calls=[];
 await upsertPaidContact({email:'test@example.invalid',firstName:'Brenda',connection,fetcher:async(url,options)=>{
   calls.push({url,...options});return calls.length===1?response(404):response(201);
 }});
 assert.deepEqual(JSON.parse(calls[1].body),{email:'test@example.invalid',attributes:{FIRSTNAME:'Brenda'},listIds:[20],emailBlacklisted:true,smsBlacklisted:true,updateEnabled:false});
});
test('repeat sync is a no-op when contact is already present',async()=>{
 let calls=0;await upsertPaidContact({email:'test@example.invalid',firstName:'Brenda',connection,fetcher:async()=>{
 calls++;return response(200,{attributes:{FIRSTNAME:'Brenda'},listIds:[20]});}});assert.equal(calls,1);
});
test('lookup outage is not mistaken for a missing contact',async()=>{
 let calls=0;await assert.rejects(upsertPaidContact({email:'test@example.invalid',firstName:'Brenda',connection,fetcher:async()=>{calls++;return response(503);}}));assert.equal(calls,1);
});
test('unpaid session never reaches Brevo',async()=>{
 let sends=0;await assert.rejects(syncPaidStudioContact({config:{},connection,sessionId:'cs_live_test',stripe:{checkout:{sessions:{retrieve:async()=>({id:'cs_live_test',payment_status:'unpaid'})}}},send:async()=>{sends++;}}),/NOT_VERIFIED/);assert.equal(sends,0);
});
test('contact sync outage requests webhook retry without rolling back paid reconciliation',async()=>{
 let committed=0,syncs=0;
 const app=createLiveWebhookHandler({getConfig:()=>({webhookSecret:'fixture',webhookId:'we_fixture'}),getStripe:async()=>({}),getPool:()=>({}),
 verify:()=>({id:'evt_fixture',livemode:true}),process:async()=>{committed++;return{sessionId:'cs_live_fixture'};},deliver:async()=>{},syncContact:async()=>{if(++syncs===1)throw Error('offline');}});
 const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const url=`http://127.0.0.1:${server.address().port}`;const opts={method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':'fixture'},body:'{}'};
 assert.equal((await fetch(url,opts)).status,503);assert.equal(committed,1);
 assert.equal((await fetch(url,opts)).status,200);assert.equal(syncs,2);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
