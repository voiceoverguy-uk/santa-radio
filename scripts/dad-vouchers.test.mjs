import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dadTestDatabase} from './helpers/dad-test-database.mjs';
import {listDadVouchers,redeemDadVoucher,dadVoucherSession} from '../server/dad-vouchers.js';
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
 const visitors=[browser(),browser()];for(const b of visitors)friendClaim(b.req,b.res,key);
 const results=await Promise.all(visitors.map(b=>redeemDadVoucher(b.req,b.res,first.vouchers[0].code,{pool,key})));
 assert.equal(results.filter(Boolean).length,1);
 const winner=visitors[results.findIndex(Boolean)],loser=visitors[results.findIndex(x=>!x)];
 const identity=dadVoucherSession(winner.req,key);assert.ok(identity);assert.equal(friendSession(winner.req,key),null);
 assert.equal(await redeemDadVoucher(loser.req,loser.res,first.vouchers[0].code,{pool,key}),false);
 assert.ok(await redeemDadVoucher(winner.req,winner.res,first.vouchers[0].code,{pool,key}));assert.deepEqual(dadVoucherSession(winner.req,key),identity);
 const next=await listDadVouchers(pool);assert.equal(next.vouchers.filter(v=>v.status==='ACTIVE').length,15);assert.equal(next.vouchers.filter(v=>v.status==='USED').length,1);
 const store=createStudioAllowanceStore(pool);const reservation=await store.reserve(identity,randomUUID());await store.succeed(identity,reservation);assert.equal((await store.status(identity)).remaining,0);await assert.rejects(store.reserve(identity,randomUUID()),/used/);
 assert.equal(dadVoucherSession(winner.req,key,identity.expiresAt+1),null);assert.equal(dadVoucherSession(winner.req,'wrong-key-'.repeat(8)),null);
 await pool.query("UPDATE public.santa_dad_vouchers SET redeemed_at=clock_timestamp()-interval '6 days' WHERE id=$1",[first.vouchers[0].id]);
 assert.equal((await listDadVouchers(pool)).vouchers.length,15);assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.santa_dad_vouchers')).rows[0].n,16);
 assert.equal(await redeemDadVoucher(loser.req,loser.res,first.vouchers[0].code,{pool,key}),false);
 }finally{await db.close();}
});
test('Dad voucher dashboard requires owner authentication',async()=>{
 let calls=0;const handler=createStatisticsHandler({allowed:()=>false,dadVouchers:async()=>{calls++;return {vouchers:[]}}});
 const res={set(){return this},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'GET',query:{view:'dad-vouchers'},headers:{}},res);assert.equal(res.code,401);assert.equal(calls,0);
});
