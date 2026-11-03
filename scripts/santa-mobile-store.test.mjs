import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createMobileStore, sealGrant, openGrant } from '../server/mobile/store.js';
import { databasePool } from '../server/name-request-store.js';

test('free signup grants are encrypted and tamper rejection fails closed', () => {
  const value = 'synthetic-private-grant';
  const sealed = sealGrant(value);
  assert.doesNotMatch(sealed, /synthetic/);
  assert.equal(openGrant(sealed), value);
  const bytes = Buffer.from(sealed, 'base64url'); bytes[30] ^= 1;
  assert.throws(() => openGrant(bytes.toString('base64url')));
});
test('database ledger serializes completions, refunds failed attempts, and prevents cross-customer restore replay', {
  skip: process.env.RUN_MOBILE_DATABASE_TESTS !== '1',
}, async () => {
  const pool = databasePool(), store = createMobileStore(pool);
  const first = await store.createSession(), other = await store.createSession();
  const key = randomBytes(32).toString('hex');
  const purchases = { permanent: false, single: [key] };
  try {
    const attempt = await store.reserve(first.customerId, randomUUID(), purchases);
    assert.equal((await store.entitlement(purchases)).credits, 0);
    await assert.rejects(store.reserve(first.customerId, randomUUID(), purchases), e => e.status === 409);
    await assert.rejects(store.reserve(other.customerId, randomUUID(), purchases), e => e.status === 402);
    await store.finish(attempt, false);
    assert.equal((await store.entitlement(purchases)).credits, 1);
    const request = randomUUID(), done = await store.reserve(first.customerId, request, purchases);
    await store.finish(done, true);
    await assert.rejects(store.reserve(first.customerId, request, purchases), e => e.status === 409);
    await assert.rejects(store.reserve(other.customerId, randomUUID(), purchases), e => e.status === 402);
    assert.equal((await store.entitlement(purchases)).credits, 0);
    const permanent = { permanent: true, single: [] };
    const unlimited = await store.reserve(other.customerId, randomUUID(), permanent);
    await store.finish(unlimited, true);
    assert.equal((await store.entitlement(permanent)).permanent, true);
    const again = await store.reserve(other.customerId, randomUUID(), permanent);
    await store.finish(again, false);
  } finally {
    await pool.query('DELETE FROM santa_mobile_generations WHERE customer_id=ANY($1::text[])', [[first.customerId, other.customerId]]);
    await pool.query('DELETE FROM santa_mobile_sessions WHERE customer_id=ANY($1::text[])', [[first.customerId, other.customerId]]);
    await pool.end();
  }
});
