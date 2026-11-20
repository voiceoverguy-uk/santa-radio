import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {DAD_LAUNCH_AT,dadSalesOpen} from '../src/lib/dadLaunch.js';
import {createLiveCheckoutHandler,startLiveCheckout} from '../server/dad-live-checkout.js';
import {LIVE_CHECKOUT_COOKIE,signLiveClaim} from '../server/dad-live-access.js';
const config={origin:'https://www.santaradio.co.uk',secret:'fixture-only-secret'.repeat(3),offer:'santa-dad-one-message-v1'};
const cookie=`${LIVE_CHECKOUT_COOKIE}=${signLiveClaim('a'.repeat(43),config)}`;
async function fixture(now,overrides={}){
 let starts=0,probes=0;
 const app=createLiveCheckoutHandler({now:()=>now,getConfig:()=>config,getPool:()=>({query:async()=>({rows:[{enabled:true}]})}),getStripe:async()=>({}),consume:async()=>true,readiness:async()=>{probes++;},start:async()=>{starts++;return{sessionId:'cs_fixture',url:'https://checkout.stripe.com/test'};},...overrides});
 const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return{starts:()=>starts,probes:()=>probes,close:()=>new Promise(r=>server.close(r)),request:(path='',method='GET')=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,path:'/'+path,method,headers:{host:'www.santaradio.co.uk',origin:config.origin,cookie,'Content-Type':'application/json'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(body)}));});req.on('error',reject);req.end(method==='POST'?'{}':undefined);})};
}
test('launch is exactly 9am GMT on Saturday 21 November 2026',()=>{assert.equal(new Date(DAD_LAUNCH_AT).getUTCDay(),6);assert.equal(dadSalesOpen(DAD_LAUNCH_AT-1),false);assert.equal(dadSalesOpen(DAD_LAUNCH_AT),true);assert.equal(dadSalesOpen(NaN),false);});
test('prelaunch prepare and POST stay closed without Stripe calls; readiness can be verified',async()=>{const f=await fixture(DAD_LAUNCH_AT-1);try{const setup=await(await f.request('?prepare=1')).json();assert.equal(setup.configured,false);assert.equal(setup.opensAt,DAD_LAUNCH_AT);assert.equal((await f.request('','POST')).status,503);assert.equal(f.starts(),0);assert.equal(f.probes(),0);const ready=await(await f.request()).json();assert.equal(ready.ready,true);assert.equal(ready.available,false);}finally{await f.close();}});
test('at launch prepare and POST open automatically',async()=>{const f=await fixture(DAD_LAUNCH_AT);try{assert.equal((await(await f.request('?prepare=1')).json()).configured,true);assert.equal((await f.request('','POST')).status,200);assert.equal(f.starts(),1);assert.equal(f.probes(),1);}finally{await f.close();}});
test('durable emergency switch still blocks checkout after launch',async()=>{const f=await fixture(DAD_LAUNCH_AT,{getPool:()=>({query:async()=>({rows:[{enabled:false}]})})});try{assert.equal((await f.request('','POST')).status,503);assert.equal(f.starts(),0);}finally{await f.close();}});
test('environment shutoff still blocks checkout after launch',async()=>{const f=await fixture(DAD_LAUNCH_AT,{getConfig:()=>{throw Error('DAD_SALES_DISABLED');}});try{assert.equal((await f.request('','POST')).status,503);assert.equal(f.starts(),0);}finally{await f.close();}});
test('direct public checkout also enforces server time before storage or Stripe',async t=>{t.mock.method(Date,'now',()=>DAD_LAUNCH_AT-1);await assert.rejects(startLiveCheckout({claim:'fixture',config,stripe:{},pool:{connect(){throw Error('must not touch storage');}}}),/DAD_SALES_NOT_OPEN/);});
test('real checkout creation stays blocked before launch and keeps the £5 offer at launch',async t=>{
 const {dadTestDatabase}=await import('./helpers/dad-test-database.mjs');
 const {readFile}=await import('node:fs/promises');const {digest}=await import('../server/dad-live-store.js');
 const db=await dadTestDatabase();
 try{
  await db.pool.query(await readFile(new URL('../database/dad-studio.sql',import.meta.url),'utf8'));
  await db.pool.query("UPDATE public.santa_dad_live_sales_settings SET enabled=true WHERE key='public'");
  const offer={...config,priceId:'price_dad',productId:'prod_dad'},claim='x'.repeat(43);let created=0;
  const stripe={prices:{retrieve:async()=>({id:offer.priceId,product:{id:offer.productId,active:true,livemode:true},active:true,livemode:true,type:'one_time',currency:'gbp',unit_amount:500})},checkout:{sessions:{create:async body=>{created++;assert.deepEqual(body.line_items,[{price:'price_dad',quantity:1}]);assert.equal(body.metadata.offer,offer.offer);return{id:'cs_dadfixture',livemode:true,metadata:{offer:offer.offer,access_claim_sha256:digest(claim)},url:'https://checkout.stripe.com/fixture'};}}}};
  const clock=t.mock.method(Date,'now',()=>DAD_LAUNCH_AT-1);
  await assert.rejects(startLiveCheckout({claim,config:offer,stripe,pool:db.pool}),/DAD_SALES_NOT_OPEN/);assert.equal(created,0);
  clock.mock.mockImplementation(()=>DAD_LAUNCH_AT);
  const result=await startLiveCheckout({claim,config:offer,stripe,pool:db.pool});assert.equal(result.url,'https://checkout.stripe.com/fixture');assert.equal(created,1);
  await db.pool.query("UPDATE public.santa_dad_live_sales_settings SET enabled=false WHERE key='public'");
  await assert.rejects(startLiveCheckout({claim,config:offer,stripe,pool:db.pool}),/STUDIO_LIVE_SALES_DISABLED/);assert.equal(created,1);
 }finally{await db.close();}
});
