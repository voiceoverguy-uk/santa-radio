import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createWorkshopAccessHandler } from '../server/santa-workshop-access.js';
import { createStatisticsHandler } from '../server/message-statistics.js';
import { friendSession } from '../server/friend-vouchers.js';

test('admin code grants bounded access, reset requires admin session, and retired codes fail',async()=>{
  const original=process.env.SESSION_SECRET;
  process.env.SESSION_SECRET='fixture-admin-secret'.repeat(3);
  const app=createWorkshopAccessHandler({getSettings:()=>({signingSecret:process.env.SESSION_SECRET,
    expiresAt:Date.now()+86400000,codes:[{id:'1',code:'headelf10'}]}),consumeAttempt:async()=>({allowed:true})});
  const server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(body,cookie='',origin=url)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});
  try {
    assert.equal((await post({code:'headelf26'},'','https://example.com')).status,403);
    assert.equal((await post({code:'headelf10'})).status,410);
    assert.equal((await post({another:true})).status,403);
    const grant=await post({code:'headelf26'});
    assert.equal(grant.status,200);
    const value=await grant.json(); assert.equal(value.voucher.unlimited,false); assert.equal(value.voucher.admin,true);
    const cookie=grant.headers.getSetCookie().find(s=>s.startsWith('santa-friend-access=')).split(';')[0];
    const req={headers:{cookie}}; const before=friendSession(req);
    const repeat=await post({code:'headelf26'},cookie);
    assert.equal(repeat.headers.getSetCookie().length,0);
    const status=await fetch(url,{headers:{cookie}}); assert.equal((await status.json()).voucher.admin,true);
    const reset=await post({another:true},cookie); assert.equal(reset.status,200);
    const nextCookie=reset.headers.getSetCookie().find(s=>s.startsWith('santa-friend-access=')).split(';')[0];
    assert.notEqual(friendSession({headers:{cookie:nextCookie}}).generationKey,before.generationKey);
  } finally { await new Promise(resolve=>server.close(resolve)); if(original===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=original; }
});
test('dashboard codes require owner authorization and are never cached',async()=>{
  for(const authorized of [false,true]) {
    let read=false;
    const handler=createStatisticsHandler({allowed:()=>authorized,friends:async()=>{read=true;return{vouchers:[]};}});
    const res={headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
    await handler({method:'GET',headers:{},query:{view:'friends'}},res);
    assert.equal(read,authorized);
    assert.equal(res.headers['Cache-Control'],'private, no-store');
    if(!authorized)assert.equal(res.code,401);
  }
});
