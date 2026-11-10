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
