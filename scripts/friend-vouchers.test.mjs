import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { markVoucherCopied } from '../server/voucher-copy.js';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';
import { friendSession, friendClaim, redeemFriendVoucher, listFriendVouchers, seedFriendVouchers,
  adminVoucherMatches, issueAdminVoucher } from '../server/friend-vouchers.js';
import { createStudioAllowanceStore } from '../server/studio-creation-allowance.js';
import { workshopCodeOpen } from '../server/santa-workshop-settings.js';

let database, pool;
const key = 'fixture-secret-'.repeat(4);
const browser = () => {
  const cookies = new Map();
  return { req: { get headers() { return { cookie: [...cookies].map(([k,v])=>`${k}=${v}`).join(';'), 'x-forwarded-proto':'https' }; } },
    res: { cookie(name,value) { cookies.set(name,value); } }, cookies };
};
test.before(async () => {
  if (process.env.PGLITE_TEST_MODULE) {
    const { PGlite } = await import(process.env.PGLITE_TEST_MODULE);
    const db = new PGlite();
    let queue = Promise.resolve();
    pool = { query: async (sql, args) => { const r=!args && sql.includes(';') ? (await db.exec(sql)).at(-1) : await db.query(sql,args); return {...r,rowCount:r.affectedRows ?? r.rows.length}; },
      connect: async () => { const previous=queue; let release; queue=new Promise(r=>{release=r;}); await previous; return {query:pool.query,release}; } };
    database = { close: () => db.close() };
  } else { database=await studioTestDatabase(); pool=database.pool; }
  const schema=await readFile(new URL('../database/santa-name-requests.sql',import.meta.url),'utf8');
  await pool.query(schema.match(/CREATE TABLE IF NOT EXISTS public\.santa_friend_vouchers[\s\S]*?\n\);/)[0]);
  const migration=await readFile(new URL('../database/friend-voucher-issues.sql',import.meta.url),'utf8');
  await seedFriendVouchers(pool);
  const beforeUpgrade=(await pool.query('SELECT slot,code FROM public.santa_friend_vouchers ORDER BY slot')).rows;
  await pool.query(migration); await pool.query(migration);
  const afterUpgrade=(await pool.query('SELECT slot,code FROM public.santa_friend_vouchers ORDER BY slot')).rows;
  assert.deepEqual(afterUpgrade,beforeUpgrade);
  const allowance=await readFile(new URL('../database/santa-studio-creation-allowance.sql',import.meta.url),'utf8');
  for (const sql of allowance.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim())) await pool.query(sql);
});
test.after(async()=>database?.close());

test('twenty unique vouchers are seeded once; repeated releases preserve codes and redemption',async()=>{
  await seedFriendVouchers(pool);
  const before=await listFriendVouchers(pool);
  assert.equal(before.vouchers.length,20);
  assert.equal(new Set(before.vouchers.map(v=>v.code)).size,20);
  await seedFriendVouchers(pool);
  assert.deepEqual(await listFriendVouchers(pool),before);
});
test('one recipient wins concurrent redemption; original browser retries retain the same two-message allowance',async()=>{
  const code=(await listFriendVouchers(pool)).vouchers[0].code;
  const second=(await listFriendVouchers(pool)).vouchers[1].code;
  await markVoucherCopied('friends',code,pool);
  await markVoucherCopied('friends',second,pool);
  const marked=(await listFriendVouchers(pool)).vouchers.filter(v=>v.status==='COPIED');
  assert.equal(marked.length,2);
  assert.deepEqual((await markVoucherCopied('friends',code,pool)).copiedAt,marked[0].copiedAt);
  const visitors=[browser(),browser()];
  for(const b of visitors) friendClaim(b.req,b.res,key);
  const results=await Promise.all(visitors.map(b=>redeemFriendVoucher(b.req,b.res,code,{pool,key})));
  assert.equal(results.filter(Boolean).length,1);
  const winner=visitors[results.findIndex(Boolean)], loser=visitors[results.findIndex(r=>!r)];
  const session=friendSession(winner.req,key);
  assert.ok(session?.limited); assert.ok(session.friend);
  const identity={key:session.generationKey,expiresAt:new Date(session.expiresAt)};
  const store=createStudioAllowanceStore(pool);
  const reservation=await store.reserve(identity,randomUUID());
  await assert.rejects(store.reserve(identity,randomUUID()),/already being prepared/);
  await store.release(identity,reservation);
  assert.equal((await store.status(identity)).remaining,2);
  for(let n=0;n<2;n++) await store.succeed(identity,await store.reserve(identity,randomUUID()));
  await assert.rejects(store.reserve(identity,randomUUID()),/Both creations/);
  assert.ok(await redeemFriendVoucher(winner.req,winner.res,code.toLowerCase(),{pool,key}));
  assert.deepEqual(friendSession(winner.req,key),session);
  assert.equal((await store.status(identity)).remaining,0);
  assert.equal(await redeemFriendVoucher(loser.req,loser.res,code,{pool,key}),false);
  const row=(await listFriendVouchers(pool)).vouchers[0];
  assert.equal(row.status,'USED'); assert.ok(row.redeemedAt);
  await pool.query("UPDATE public.santa_friend_vouchers SET redeemed_at=now()-interval '23 hours 59 minutes' WHERE code=$1",[code]);
  assert.equal((await listFriendVouchers(pool)).vouchers[0].code,code);
  await pool.query("UPDATE public.santa_friend_vouchers SET redeemed_at=now()-interval '24 hours' WHERE code=$1",[code]);
  const [after,concurrent]=await Promise.all([listFriendVouchers(pool),listFriendVouchers(pool)]);
  assert.deepEqual(after,concurrent); assert.equal(after.vouchers.length,20);
  const replacement=after.vouchers[0];
  assert.equal(replacement.slot,row.slot); assert.notEqual(replacement.code,code);
  assert.equal(replacement.status,'AVAILABLE');assert.equal(replacement.copiedAt,null);
  assert.equal(after.vouchers[1].status,'COPIED');
  await seedFriendVouchers(pool); assert.deepEqual(await listFriendVouchers(pool),after);
  assert.equal((await markVoucherCopied('friends',code,pool)).status,409);
  assert.equal(await redeemFriendVoucher(loser.req,loser.res,code,{pool,key}),false);
  assert.ok(await redeemFriendVoucher(winner.req,winner.res,code,{pool,key}));
  assert.equal(friendSession(winner.req,key).generationKey,session.generationKey);
  assert.ok(await redeemFriendVoucher(loser.req,loser.res,replacement.code,{pool,key}));
  const fresh=friendSession(loser.req,key);
  assert.notEqual(fresh.generationKey,session.generationKey);
  assert.equal((await store.status({key:fresh.generationKey,expiresAt:new Date(fresh.expiresAt)})).remaining,2);
  assert.equal((await store.status(identity)).remaining,0);
});
test('admin runs stop at two, then reset into a fresh bounded run; sessions reject tampering and expiry',async()=>{
  const b=browser(); issueAdminVoucher(b.req,b.res,{key});
  const first=friendSession(b.req,key), store=createStudioAllowanceStore(pool);
  const identity={key:first.generationKey,expiresAt:new Date(first.expiresAt)};
  for(let i=0;i<2;i++) await store.succeed(identity,await store.reserve(identity,randomUUID()));
  await assert.rejects(store.reserve(identity,randomUUID()),/Both creations/);
  issueAdminVoucher(b.req,b.res,{key,expiresAt:first.expiresAt});
  const next=friendSession(b.req,key);
  assert.ok(next.admin); assert.notEqual(next.generationKey,first.generationKey);
  assert.equal(next.expiresAt,first.expiresAt);
  assert.equal((await store.status({key:next.generationKey})).remaining,2);
  assert.equal(friendSession(b.req,'wrong'.repeat(10)),null);
  assert.equal(friendSession(b.req,key,first.expiresAt),null);
  b.cookies.set('santa-friend-access',b.cookies.get('santa-friend-access')+'x');
  assert.equal(friendSession(b.req,key),null);
});
test('retired codes cannot authorize new or existing legacy sessions',()=>{
  for(const code of ['headelf10','cookieyumyum','mincepie4','xmasfun2','tinseltom3']) {
    assert.equal(workshopCodeOpen({expiresAt:Date.now()+86400000},{code},Date.now()),false);
    assert.equal(adminVoucherMatches(code),false);
  }
  assert.equal(adminVoucherMatches('headelf26'),true);
  assert.equal(adminVoucherMatches('headelf26x'),false);
});

test('fixed-date gifts have independent two-creation allowances and the same deadline for redemption and use',async()=>{
  const cutoff=new Date(Date.now()+35*86400000);
  const gifts=Array.from({length:2},()=> 'FRIEND-GIFT-'+randomBytes(10).toString('hex').toUpperCase().match(/.{5}/g).join('-'));
  const hashes=gifts.map(code=>createHash('sha256').update(code).digest('hex'));
  for(const hash of hashes) await pool.query('INSERT INTO public.santa_fixed_gift_vouchers(code_sha256,valid_until) VALUES($1,$2)',[hash,cutoff]);
  const before=await listFriendVouchers(pool);
  const visitors=[browser(),browser()];
  const claims=await Promise.all(visitors.map(b=>redeemFriendVoucher(b.req,b.res,gifts[0].toLowerCase(),{pool,key})));
  assert.equal(claims.filter(Boolean).length,1);
  const first=visitors[claims.findIndex(Boolean)], other=visitors[claims.findIndex(x=>!x)];
  const session=friendSession(first.req,key);
  assert.equal(session.expiresAt,cutoff.getTime());
  assert.ok(friendSession(first.req,key,cutoff.getTime()-1));
  assert.equal(friendSession(first.req,key,cutoff.getTime()),null);
  assert.ok(await redeemFriendVoucher(other.req,other.res,gifts[1],{pool,key}));
  const second=friendSession(other.req,key);
  assert.notEqual(second.generationKey,session.generationKey);
  assert.equal(second.expiresAt,session.expiresAt);
  const store=createStudioAllowanceStore(pool);
  const identity={key:session.generationKey,expiresAt:cutoff};
  for(let n=0;n<2;n++) await store.succeed(identity,await store.reserve(identity,randomUUID()));
  await assert.rejects(store.reserve(identity,randomUUID()),/Both creations/);
  assert.equal((await store.status({key:second.generationKey,expiresAt:cutoff})).remaining,2);
  assert.ok(await redeemFriendVoucher(first.req,first.res,gifts[0],{pool,key}));
  assert.deepEqual(friendSession(first.req,key),session);
  assert.equal((await store.status(identity)).remaining,0);
  assert.equal(await redeemFriendVoucher(other.req,other.res,gifts[0],{pool,key}),false);
  await pool.query("UPDATE public.santa_fixed_gift_vouchers SET valid_until=now() WHERE code_sha256=$1",[hashes[0]]);
  assert.equal(await redeemFriendVoucher(first.req,first.res,gifts[0],{pool,key}),false);
  assert.deepEqual(await listFriendVouchers(pool),before);
});
