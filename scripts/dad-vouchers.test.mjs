import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dadTestDatabase} from './helpers/dad-test-database.mjs';
import {listDadVouchers,redeemDadVoucher,dadVoucherSession} from '../server/dad-vouchers.js';
import {markVoucherCopied} from '../server/voucher-copy.js';
import {friendClaim,friendSession} from '../server/friend-vouchers.js';
import {createStudioAllowanceStore} from '../server/dad-creation-allowance.js';
import {createStatisticsHandler} from '../server/message-statistics.js';
const key='test-key-'.repeat(8);
const browser=()=>{const cookies=new Map();return {cookies,req:{get headers(){return {cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),'x-forwarded-proto':'https'};}},res:{cookie:(k,v)=>cookies.set(k,v)}};};
test('Dad vouchers replenish, reject reuse, retain retries and enforce one creation',async()=>{
 const db=await dadTestDatabase(),pool=db.pool;
 try{
 await pool.query(await readFile(new URL('../database/dad-vouchers.sql',import.meta.url),'utf8'));
 await pool.query(await readFile(new URL('../database/dad-studio.sql',import.meta.url),'utf8'));
 const first=await listDadVouchers(pool);assert.equal(first.vouchers.length,15);assert.equal(new Set(first.vouchers.map(v=>v.code)).size,15);
 assert.deepEqual(await listDadVouchers(pool),first);
 const toCopy=first.vouchers.slice(0,2);
 for(const row of toCopy) assert.ok((await markVoucherCopied('dad-vouchers',row.code,pool)).copiedAt);
 const marked=(await listDadVouchers(pool)).vouchers.filter(row=>row.status==='COPIED');
 assert.equal(marked.length,2);
 const repeat=await markVoucherCopied('dad-vouchers',marked[0].code,pool);
 assert.equal(repeat.alreadyCopied,true); assert.deepEqual(repeat.copiedAt,marked[0].copiedAt);
 const visitors=[browser(),browser()];for(const b of visitors)friendClaim(b.req,b.res,key);
 const results=await Promise.all(visitors.map(b=>redeemDadVoucher(b.req,b.res,first.vouchers[0].code,{pool,key})));
 assert.equal(results.filter(Boolean).length,1);
 const winner=visitors[results.findIndex(Boolean)],loser=visitors[results.findIndex(x=>!x)];
 const identity=dadVoucherSession(winner.req,key);assert.ok(identity);assert.equal(friendSession(winner.req,key),null);
 assert.equal(await redeemDadVoucher(loser.req,loser.res,first.vouchers[0].code,{pool,key}),false);
 assert.ok(await redeemDadVoucher(winner.req,winner.res,first.vouchers[0].code,{pool,key}));assert.deepEqual(dadVoucherSession(winner.req,key),identity);
 const next=await listDadVouchers(pool);assert.equal(next.vouchers.length,15);assert.equal(next.vouchers.filter(v=>v.status==='AVAILABLE').length,13);assert.equal(next.vouchers.filter(v=>v.status==='USED').length,1);
 const store=createStudioAllowanceStore(pool);const reservation=await store.reserve(identity,randomUUID());await store.succeed(identity,reservation);assert.equal((await store.status(identity)).remaining,0);await assert.rejects(store.reserve(identity,randomUUID()),/used/);
 assert.equal(dadVoucherSession(winner.req,key,identity.expiresAt+1),null);assert.equal(dadVoucherSession(winner.req,'wrong-key-'.repeat(8)),null);
 assert.equal((await markVoucherCopied('dad-vouchers',first.vouchers[0].code,pool)).status,409);
 await pool.query("UPDATE public.santa_dad_vouchers SET redeemed_at=clock_timestamp()-interval '23 hours 59 minutes' WHERE id=$1",[first.vouchers[0].id]);
 assert.ok((await listDadVouchers(pool)).vouchers.some(row=>row.code===first.vouchers[0].code && row.status==='USED'));
 await pool.query("UPDATE public.santa_dad_vouchers SET redeemed_at=clock_timestamp()-interval '24 hours' WHERE id=$1",[first.vouchers[0].id]);
 const [rotated, simultaneous]=await Promise.all([listDadVouchers(pool),listDadVouchers(pool)]);
 assert.deepEqual(rotated,simultaneous); assert.equal(rotated.vouchers.length,15);
 assert.ok(!rotated.vouchers.some(row=>row.code===first.vouchers[0].code));
 const replacement=rotated.vouchers.find(row=>!first.vouchers.some(old=>old.code===row.code));
 assert.equal(replacement.status,'AVAILABLE'); assert.equal(replacement.copiedAt,null);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.santa_dad_vouchers')).rows[0].n,16);
 assert.equal(await redeemDadVoucher(loser.req,loser.res,first.vouchers[0].code,{pool,key}),false);
 }finally{await db.close();}
});
test('Dad voucher dashboard requires owner authentication',async()=>{
 let calls=0;const handler=createStatisticsHandler({allowed:()=>false,dadVouchers:async()=>{calls++;return {vouchers:[]}}});
 const res={set(){return this},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'GET',query:{view:'dad-vouchers'},headers:{}},res);assert.equal(res.code,401);assert.equal(calls,0);
});

test('only the same-origin owner can save a copied tick',async()=>{
 const res={set(){return this},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 const req={method:'PATCH',query:{view:'friends'},body:{action:'copy',code:'test'},headers:{host:'example.test',origin:'https://example.test'}};
 let calls=0;
 const copyVoucher=async(view,code)=>{calls++;assert.equal(view,'friends');assert.equal(code,'test');return {copiedAt:'saved'}};
 await createStatisticsHandler({allowed:()=>false,copyVoucher})(req,res);assert.equal(res.code,401);assert.equal(calls,0);
 const handler=createStatisticsHandler({allowed:()=>true,copyVoucher});
 await handler({...req,headers:{...req.headers,origin:'https://other.test'}},res);assert.equal(res.code,403);assert.equal(calls,0);
 await handler(req,res);assert.equal(calls,1);assert.equal(res.data.copiedAt,'saved');
});
