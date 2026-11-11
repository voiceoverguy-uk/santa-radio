import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { livePaidSummary, createLiveAccessHandler, LIVE_ACCESS_COOKIE } from '../server/studio-live-access.js';
import { digest } from '../server/studio-live-store.js';

for (const used of [0, 1, 2]) test(`paid return reports ${2-used} messages without resetting the purchase`, async () => {
  const calls = [];
  const pool = { query: async (sql, args) => { calls.push({sql,args}); return { rows: used ? [{ used }] : [] }; } };
  assert.deepEqual(await livePaidSummary(pool, 'cs_live_verified'), {authorized:true, mode:'live',limit:2,remaining:2-used});
  assert.deepEqual(calls[0].args, [digest('studio-purchase:cs_live_verified')]);
  assert(calls.every(c => c.sql.startsWith('SELECT')));
});
test('invalid allowance fails instead of advertising a fresh allowance', async () => {
  await assert.rejects(livePaidSummary({query:async()=>({rows:[{used:3}]})}, 'cs_live_verified'), /ALLOWANCE_INVALID/);
});
test('existing purchase can return with sales off and Stripe unavailable; an unverified visitor cannot', async () => {
  let origin, stripeCalls = 0;
  const token = 'x'.repeat(43);
  const pool = {query:async(sql,args)=>sql.includes('JOIN public.santa_studio_live_purchases')
    ? {rowCount:args[0]===digest(token)?1:0,rows:args[0]===digest(token)?[{checkout_session_id:'cs_live_verified'}]:[]}
    : {rows:[{used:1}]}};
  const app = createLiveAccessHandler({getConfig:()=>({origin}),getPool:()=>pool,
    getStripe:async()=>{stripeCalls++; throw Error('offline');}});
  const server=createServer(app); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const paid=await fetch(origin,{headers:{Cookie:`${LIVE_ACCESS_COOKIE}=${token}`}});
    assert.equal(paid.status,200); assert.equal((await paid.json()).remaining,1);
    assert.match(paid.headers.get('cache-control'),/no-store/);
    const unpaid=await fetch(origin); assert.equal((await unpaid.json()).authorized,false);
    assert.equal(stripeCalls,0);
  } finally {server.closeAllConnections(); await new Promise(r=>server.close(r));}
});

for (const [used, paid, expected] of [[2,true,2],[2,false,0],[1,true,1]]) {
  test(`replacement payment: old used=${used}, new paid=${paid} gives ${expected} remaining`, async () => {
    const {signLiveClaim,LIVE_CHECKOUT_COOKIE,LIVE_PENDING_COOKIE}=await import('../server/studio-live-access.js');
    const config={secret:'fixture-only',offer:'fixture',priceId:'price_fixture',productId:'prod_fixture'};
    const claim='c'.repeat(43), newId='cs_live_new', oldId='cs_live_old';
    let stripeCalls=0, issued=false;
    const query=async(sql,args)=>{
      if(sql.includes('JOIN public.santa_studio_live_purchases')) return {rowCount:1,rows:[{checkout_session_id:oldId}]};
      if(sql.includes('cardinality(operations)')) return {rows:[{used:args[0]===digest('studio-purchase:'+oldId)?used:0}]};
      if(sql.includes('FROM public.santa_studio_live_attempts')) return {rows:[{checkout_session_id:newId}]};
      if(sql.startsWith('INSERT INTO public.santa_studio_live_sessions')) {issued=true;assert.equal(args[1],newId);}
      return {rowCount:1,rows:[]};
    };
    const pool={query,connect:async()=>({query,release(){}})};
    const session={id:newId,livemode:true,mode:'payment',status:paid?'complete':'open',payment_status:paid?'paid':'unpaid',amount_total:650,amount_subtotal:650,currency:'gbp',metadata:{offer:config.offer,access_claim_sha256:digest(claim)},total_details:{amount_discount:0,amount_shipping:0,amount_tax:0},customer_details:{email:'test@example.invalid'},payment_intent:{id:'pi_fixture',livemode:true,status:'succeeded',amount:650,amount_received:650,amount_capturable:0,currency:'gbp'},line_items:{has_more:false,data:[{quantity:1,amount_total:650,amount_subtotal:650,price:{id:config.priceId,livemode:true,unit_amount:650,currency:'gbp',type:'one_time',product:{id:config.productId,livemode:true}}}]}};
    const app=createLiveAccessHandler({getConfig:()=>config,getPool:()=>pool,consume:async()=>true,getStripe:async()=>({checkout:{sessions:{retrieve:async()=>{stripeCalls++;return session;}}}})});
    const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));config.origin=`http://127.0.0.1:${server.address().port}`;
    try {
      const response=await fetch(config.origin,{headers:{Cookie:`${LIVE_ACCESS_COOKIE}=${'x'.repeat(43)}; ${LIVE_CHECKOUT_COOKIE}=${signLiveClaim(claim,config)}; ${LIVE_PENDING_COOKIE}=${newId}`}});
      assert.equal(response.status,200);assert.equal((await response.json()).remaining,expected);
      assert.equal(issued,used===2&&paid);assert.equal(stripeCalls,used===2?1:0);
      assert.equal(Boolean(response.headers.get('set-cookie')),issued);
    }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  });
}
