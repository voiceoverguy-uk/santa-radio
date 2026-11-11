import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {paidStatistics} from '../server/paid-statistics.js';
import {browserSecurity} from '../server/browser-security.js';
import {resolvePublicRequest} from '../src/seo/routes.js';

test('paid totals use actual discounted Stripe amounts and cache completed sessions',async()=>{
  const rows=[{checkout_session_id:'one',creations:2},{checkout_session_id:'two',creations:0}];
  let calls=0;
  const options={pool:{query:async()=>({rows})},cache:new Map(),stripeClient:async()=>({checkout:{sessions:{retrieve:async id=>{calls++;return{livemode:true,payment_status:'paid',currency:'gbp',amount_total:id==='one'?650:500};}}}})};
  assert.deepEqual(await paidStatistics(options),{purchases:2,creations:2,grossPence:1150});
  await paidStatistics(options);assert.equal(calls,2);
});
test('Stripe errors or invalid currency never produce a misleading revenue total',async()=>{
  for(const retrieve of [async()=>{throw Error('offline');},async()=>({livemode:true,payment_status:'paid',currency:'usd',amount_total:650})]){
    const result=await paidStatistics({pool:{query:async()=>({rows:[{checkout_session_id:'one',creations:1}]})},cache:new Map(),stripeClient:async()=>({checkout:{sessions:{retrieve}}})});
    assert.deepEqual(result,{purchases:1,creations:1,grossPence:null});
  }
});
test('capture aliases redirect and embedding relaxation is confined to the map',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
  for(const path of ['/styt','/SRYT','/sryt/','/STYT']){
    const route=resolvePublicRequest(path);
    assert.equal(route.status,path==='/styt'?200:308);
    if(path!=='/styt')assert.equal(route.location,'/styt');
    const headers={};browserSecurity({url:path},{setHeader:(k,v)=>headers[k]=v});
    assert.match(headers['Content-Security-Policy'],/https:\/\/\*\.upstream\.so$/);
    const policies=config.routes.filter(r=>r.headers?.['Content-Security-Policy']&&new RegExp('^'+r.src+'$').test(path));
    assert.equal(policies.length,1);assert.match(policies[0].headers['Content-Security-Policy'],/https:\/\/\*\.upstream\.so$/);
  }
  for(const path of ['/','/santa-dashboard','/bespoke-personalised-message-from-santa']){
    const headers={};browserSecurity({url:path},{setHeader:(k,v)=>headers[k]=v});
    assert.ok(!headers['Content-Security-Policy'].includes('https://*.upstream.so'));
    const policies=config.routes.filter(r=>r.headers?.['Content-Security-Policy']&&new RegExp('^'+r.src+'$').test(path));
    assert.equal(policies.length,1);assert.ok(!policies[0].headers['Content-Security-Policy'].includes('https://*.upstream.so'));
  }
});

test('Brevo reports expose only aggregate counts and reject failures', async()=>{
  const {brevoStatistics}=await import('../server/brevo-statistics.js');
  const counts={requests:10,delivered:8,hardBounces:1,softBounces:1,blocked:0,spamReports:0};
  const report=await brevoStatistics({env:{BREVO_API_KEY:'test'},fetchImpl:async()=>({ok:true,json:async()=>({...counts,email:'private@example.com'})})});
  assert.deepEqual(report,{range:null,...counts});
  assert.equal(await brevoStatistics({env:{}}),null);
  await assert.rejects(brevoStatistics({env:{BREVO_API_KEY:'test'},fetchImpl:async()=>({ok:false})}));
  await assert.rejects(brevoStatistics({env:{BREVO_API_KEY:'test'},fetchImpl:async()=>({ok:true,json:async()=>({})})}));
});
