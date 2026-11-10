import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';
import { createStudioAllowanceStore, studioAllowanceIdentity, studioAllowanceReady } from '../server/studio-creation-allowance.js';
import { createStudioMessageHandler } from '../server/santa-studio-message.js';
import { issueWorkshopToken, workshopSession, createWorkshopAccessHandler } from '../server/santa-workshop-access.js';
import { livePaidPurchaseId, signLiveClaim, issueLiveAccess, LIVE_ACCESS_COOKIE, LIVE_CHECKOUT_COOKIE, LIVE_PENDING_COOKIE } from '../server/studio-live-access.js';
import { workshopSettings } from '../server/santa-workshop-settings.js';
import { createServer } from 'node:http';

let database, pool, store;
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = (expiresAt = null) => ({ key: hash(randomUUID()), expiresAt });
test.before(async () => {
  database = await studioTestDatabase();
  pool = database.pool;
  await pool.query(await readFile(new URL('../database/santa-studio-creation-allowance.sql', import.meta.url), 'utf8'));
  store = createStudioAllowanceStore(pool);
});
test.after(async () => database?.close());

test('two successes, bounded committed idempotency, no recipient locks or archives, per-purchase isolation', async () => {
  const who = identity(), other = identity(), operation = randomUUID();
  assert.deepEqual(await store.status(who), { limit: 2, successes: 0, remaining: 2, pending: false });
  const lease = await store.reserve(who, operation);
  assert.equal((await store.status(who)).pending, true);
  await store.succeed(who, lease);
  const restarted = createStudioAllowanceStore(pool);
  assert.equal((await restarted.status(who)).remaining, 1);
  await assert.rejects(restarted.reserve(who, operation), { status: 409 });
  const second = await restarted.reserve(who, randomUUID());
  await restarted.succeed(who, second);
  await assert.rejects(store.reserve(who, randomUUID()), { status: 409 });
  assert.equal((await store.status(who)).remaining, 0);
  assert.equal((await store.status(other)).remaining, 2);
  const row = (await pool.query('SELECT * FROM public.santa_studio_creation_allowances WHERE access_key=$1', [who.key])).rows[0];
  assert.equal(row.operations.length, 2);
  assert.deepEqual(Object.keys(row).sort(), ['access_key', 'operations', 'reservation', 'operation', 'reserved_until', 'expires_at'].sort());
});

test('concurrent instances serialize; failures release; expired leases cannot commit or release replacements', async () => {
  const who = identity(), b = createStudioAllowanceStore(pool);
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => b.reserve(who, randomUUID())));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const first = results.find(r => r.status === 'fulfilled').value;
  await store.release(who, first);
  assert.equal((await store.status(who)).remaining, 2);
  const abandoned = await store.reserve(who, randomUUID());
  await pool.query(`UPDATE public.santa_studio_creation_allowances SET reserved_until=now()-interval '1 second' WHERE access_key=$1`, [who.key]);
  const replacement = await b.reserve(who, randomUUID());
  await assert.rejects(store.succeed(who, abandoned), { status: 409 });
  await store.release(who, abandoned);
  assert.equal((await store.status(who)).pending, true);
  await b.succeed(who, replacement);
  await assert.rejects(b.succeed(who, replacement), { status: 409 });
  assert.equal((await store.status(who)).successes, 1);
});

test('visitor counts expire without changing durable purchase counts', async () => {
  const who = identity(new Date(Date.now() + 60000)), paid = identity();
  await store.succeed(who, await store.reserve(who, randomUUID()));
  await store.succeed(paid, await store.reserve(paid, randomUUID()));
  await pool.query(`UPDATE public.santa_studio_creation_allowances SET expires_at=now()-interval '1 second' WHERE access_key=$1`, [who.key]);
  await store.reserve(identity(), randomUUID()); // bounded visitor cleanup
  assert.equal((await pool.query('SELECT 1 FROM public.santa_studio_creation_allowances WHERE access_key=$1', [who.key])).rowCount, 0);
  assert.equal((await store.status(paid)).successes, 1);
  await assert.rejects(store.reserve(identity(new Date(Date.now() - 1)), randomUUID()), { status: 409 });
});

test('verified live purchase survives new session credentials and signed pending claims; sandbox ignores claim rotation', async () => {
  const purchase = `cs_live_${randomUUID().replaceAll('-', '')}`, claim = 'x'.repeat(43);
  const config = { secret: 'fixture-secret'.repeat(4) };
  await pool.query(`INSERT INTO public.santa_studio_live_purchases
    (checkout_session_id,payment_intent_id,claim_sha256,email_sha256) VALUES($1,$2,$3,$4)`,
  [purchase, randomUUID(), hash(claim), hash('fixture')]);
  const cookies = [];
  for (let n = 0; n < 2; n++) {
    const grant = await issueLiveAccess({ cookie: (name, token) => cookies.push(`${name}=${token}`) }, purchase, pool);
    grant();
  }
  cookies.push(`${LIVE_CHECKOUT_COOKIE}=${signLiveClaim(claim, config)}; ${LIVE_PENDING_COOKIE}=${purchase}`);
  const identities = [];
  for (const cookie of cookies) {
    const req = { headers: { cookie } };
    identities.push(await studioAllowanceIdentity(req, { visitorSession: () => null, production: () => true,
      livePurchase: r => livePaidPurchaseId(r, { config, pool }) }));
  }
  assert.deepEqual(identities[0], identities[1]);
  assert.deepEqual(identities[0], identities[2]);
  await store.succeed(identities[0], await store.reserve(identities[0], randomUUID()));
  assert.equal((await store.status(identities[1])).remaining, 1);
  assert.equal((await store.status(identities[2])).remaining, 1);
  assert.equal(await livePaidPurchaseId({ headers: { cookie: `${LIVE_ACCESS_COOKIE}=${'z'.repeat(43)}` } }, { config, pool }), false);
  const sandbox = token => studioAllowanceIdentity({ headers: { cookie: `santa-studio-sandbox=cs_test_fixture.${token.repeat(43)}` } },
    { visitorSession: () => null, production: () => false, sandboxPaid: async () => true });
  assert.deepEqual(await sandbox('a'), await sandbox('b'));
});

test('only selected voucher is limited; rotation and re-entry preserve visitor, expiry and remaining; new visitor is independent', async t => {
  const config = { codes: [{ id: '1', code: 'fixture-limited', limited: true }, { id: '2', code: 'fixture-unlimited' }],
    signingSecret: randomUUID(), expiresAt: Date.now() + 86400000 };
  const req = codeId => ({ headers: { cookie: `santa-workshop-preview=${issueWorkshopToken(config, Date.now(), codeId)}` } });
  const one = req('1'), two = req('1'), unlimited = req('2');
  const resolve = r => studioAllowanceIdentity(r, { visitorSession: request => workshopSession(request, config) });
  assert.equal(await resolve(unlimited), null);
  const who = await resolve(one), other = await resolve(two);
  assert.notEqual(who.key, other.key);
  await store.succeed(who, await store.reserve(who, randomUUID()));
  const server = createServer(createWorkshopAccessHandler({ getSettings: () => config, consumeAttempt: async () => ({ allowed: true }) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const body of [{ another: true }, { code: 'fixture-limited' }]) {
    const response = await fetch(url, { method: 'POST', headers: { origin: url, cookie: one.headers.cookie,
      'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).expiresAt, workshopSession(one, config).expiresAt);
    assert.equal((await store.status(await resolve(one))).remaining, 1);
  }
  assert.equal((await store.status(other)).remaining, 2);
  assert.equal(workshopSession(one, config, Date.now() + 13 * 3600000), null);
});

test('non-secret slot markers select only the intended voucher and survive credential rotation', () => {
  const env = Object.fromEntries(Array.from({ length: 6 }, (_, n) =>
    [`SANTA_STUDIO_TEST_CODE_${n + 1}`, `fixture-${n + 1}`]));
  const selected = values => workshopSettings(values).codes.filter(entry => entry.limited).map(entry => entry.id);
  assert.deepEqual(selected(env), ['3']);
  assert.deepEqual(selected({ ...env, SANTA_STUDIO_TEST_CODE_3: 'rotated-fixture' }), ['3']);
  assert.deepEqual(selected({ ...env, SANTA_STUDIO_LIMITED_VOUCHER_SLOT: '1' }), ['1']);
});

const choiceId = n => `c-${String(n).repeat(64)}`;
const data = { name: 'fixture', age: choiceId(1), activity: choiceId(2), achievement: choiceId(3),
  treat: choiceId(4), place: choiceId(5), talent: { skip: true } };
async function call(handler, { operation = randomUUID(), body = data, method = 'POST', url = '/', cookie = '', res = new EventEmitter() } = {}) {
  const result = { headers: {} };
  const req = Object.assign(new EventEmitter(), { method, url, body, headers: {
    host: 'studio.test', origin: 'https://studio.test', 'content-type': 'application/json', cookie,
    'idempotency-key': operation }, socket: { encrypted: true } });
  Object.assign(res, { setHeader: (key, value) => result.headers[key.toLowerCase()] = value,
    writeHead: (status, headers) => { res.headersSent = true; result.status = status; Object.assign(result.headers, headers); },
    end: bytes => result.bytes = bytes });
  await handler(req, res);
  return result;
}
function handlerFixture(who, overrides = {}) {
  const state = { renders: 0, directories: [], fail: false };
  const handler = createStudioMessageHandler({
    authorize: async () => true, allowanceIdentity: async () => who, allowances: store,
    limit: async () => {}, reportFailure() {},
    catalogue: async () => ({ categories: Object.fromEntries(['age', 'activity', 'achievement', 'treat', 'place']
      .map(key => [key, [{ id: data[key], file: `${key}.wav` }]])) }),
    library: { resolve: async id => ({ id, name: 'Fixture', source: 'hosted' }),
      download: async (_record, target) => writeFile(target, 'fixture') },
    download: async (_url, target) => writeFile(target, 'fixture'),
    render: async ({ directory }) => {
      state.renders++; state.directories.push(directory);
      if (state.fail) throw new Error('fixture failure');
      return { audio: Buffer.from('fixture mp3') };
    }, ...overrides,
  });
  return { handler, state };
}
test('paid return, rotated access/reload and Start Again keep two-success purchase allowance despite stale vouchers', async () => {
  const purchase = `cs_live_${randomUUID().replaceAll('-', '')}`, claim = 'x'.repeat(43);
  const paidConfig = { secret: 'fixture-secret'.repeat(4) };
  await pool.query(`INSERT INTO public.santa_studio_live_purchases
    (checkout_session_id,payment_intent_id,claim_sha256,email_sha256) VALUES($1,$2,$3,$4)`,
  [purchase, randomUUID(), hash(claim), hash('fixture')]);
  const cookies = [];
  for (let n = 0; n < 2; n++) {
    const grant = await issueLiveAccess({ cookie: (name, token) => cookies.push(`${name}=${token}`) }, purchase, pool);
    grant();
  }
  const returningCookie = `${LIVE_CHECKOUT_COOKIE}=${signLiveClaim(claim, paidConfig)}; ${LIVE_PENDING_COOKIE}=${purchase}`;
  // Exercise both an unlimited and limited stale voucher; neither may select
  // the visitor allowance once the purchase is verified in the database.
  for (const limited of [false, true]) {
    const resolve = req => studioAllowanceIdentity(req, { production: () => true,
      visitorSession: () => ({ limited, generationKey: hash('stale-voucher'), expiresAt: Date.now() + 3600000 }),
      livePurchase: r => livePaidPurchaseId(r, { config: paidConfig, pool }),
    });
    const who = await resolve({ headers: { cookie: returningCookie } });
    for (const cookie of cookies) assert.deepEqual(await resolve({ headers: { cookie } }), who);
  }
  const resolve = req => studioAllowanceIdentity(req, { production: () => true,
    visitorSession: () => ({ limited: false, generationKey: hash('stale-voucher') }),
    livePurchase: r => livePaidPurchaseId(r, { config: paidConfig, pool }),
  });
  const { handler, state } = handlerFixture(null, { allowanceIdentity: resolve });
  assert.equal((await call(handler, { cookie: returningCookie })).status, 200);
  const reloaded = handlerFixture(null, { allowanceIdentity: resolve });
  assert.equal(JSON.parse((await call(reloaded.handler, { method: 'GET', cookie: cookies[0] })).bytes).remaining, 1);
  assert.equal((await call(reloaded.handler, { cookie: cookies[1] })).status, 200);
  assert.equal((await call(handler, { cookie: returningCookie })).status, 409);
  assert.equal((await call(reloaded.handler, { cookie: cookies[0] })).status, 409);
  assert.equal(state.renders + reloaded.state.renders, 2);
  const status = JSON.parse((await call(handler, { method: 'GET', cookie: cookies[1] })).bytes);
  assert.equal(status.remaining, 0);
  assert.equal(status.testerCanStartAnother, false);
});

test('unverified paid claims cannot override vouchers, and paid storage errors fail closed', async () => {
  const visitor = { limited: true, generationKey: hash('limited-fixture'), expiresAt: Date.now() + 3600000 };
  const options = { visitorSession: () => visitor, production: () => true, livePurchase: async () => false };
  assert.deepEqual(await studioAllowanceIdentity({ headers: {} }, options),
    { key: visitor.generationKey, expiresAt: new Date(visitor.expiresAt) });
  await assert.rejects(studioAllowanceIdentity({ headers: {} }, { ...options,
    livePurchase: async () => { throw new Error('fixture unavailable'); } }), /fixture unavailable/);
  assert.deepEqual(await studioAllowanceIdentity({ headers: {} }, { ...options, production: () => false,
    sandboxClaim: () => ({ sessionId: 'cs_test_unverified' }), sandboxPaid: async () => false }),
  { key: visitor.generationKey, expiresAt: new Date(visitor.expiresAt) });
  assert.equal(await studioAllowanceIdentity({ headers: {} }, { ...options,
    visitorSession: () => ({ ...visitor, limited: false }) }), null);
});
test('status failures identify the private failure stage without calling render or reporting exhaustion', async () => {
  for (const stage of ['allowance_identity', 'status_limit', 'status']) {
    const events = [];
    const unavailable = async () => { throw Object.assign(new Error('PRIVATE diagnostic'), { code: '42P01' }); };
    const overrides = {
      reportFailure: (error, failureStage) => events.push([error.code, failureStage]),
      ...(stage === 'allowance_identity' ? { allowanceIdentity: unavailable }
        : stage === 'status_limit' ? { limit: unavailable } : { allowances: { status: unavailable } }),
    };
    const { handler, state } = handlerFixture(identity(), overrides);
    const response = await call(handler, { method: 'GET' });
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(response.bytes), { error: 'The recording check failed. Please try again.' });
    assert.deepEqual(events, [['42P01', stage]]);
    assert.equal(state.renders, 0);
  }
  for (const status of [403, 410, 429]) {
    const { handler } = handlerFixture(identity(), {
      limit: async () => { throw Object.assign(new Error('Access or request restriction.'), { status }); },
      reportFailure: () => assert.fail('Expected restrictions are not service failures'),
    });
    const response = await call(handler, { method: 'GET' });
    assert.equal(response.status, status);
    assert.ok(!response.bytes.includes('remaining'));
  }
});
test('handler counts only completed MP3 preparation, refuses replay/third render, exposes safe status and never recovers audio', async () => {
  const who = identity(), { handler, state } = handlerFixture(who), operation = randomUUID();
  state.fail = true;
  assert.equal((await call(handler, { operation })).status, 503);
  assert.equal((await store.status(who)).remaining, 2);
  state.fail = false;
  assert.equal((await call(handler, { operation })).status, 200);
  assert.equal((await call(handler, { operation })).status, 409);
  assert.equal((await call(handler, { body: { ...data, name: 'another-recipient' } })).status, 200);
  assert.equal((await call(handler)).status, 409);
  assert.equal(state.renders, 3);
  const status = await call(handler, { method: 'GET' });
  assert.equal(status.status, 200);
  assert.deepEqual(JSON.parse(status.bytes), { temporary: true, testerCanStartAnother: false,
    limit: 2, successes: 2, remaining: 0, pending: false });
  assert.equal((await call(handler, { method: 'GET', url: '/?audio=1' })).status, 410);
  for (const directory of state.directories) await assert.rejects(access(directory));
  const columns = JSON.stringify((await pool.query('SELECT * FROM public.santa_studio_creation_allowances WHERE access_key=$1', [who.key])).rows);
  assert.equal(columns.includes('recipient'), false);
});

test('cancel before completion releases slot and always removes request-local working files', async () => {
  const who = identity();
  let entered, directory;
  const ready = new Promise(resolve => entered = resolve);
  const { handler } = handlerFixture(who, { render: async args => {
    directory = args.directory; entered();
    await new Promise((_, reject) => args.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  } });
  const res = new EventEmitter();
  const pending = call(handler, { res });
  await ready;
  assert.equal((await store.status(who)).pending, true);
  res.destroyed = true; res.emit('close');
  await pending;
  assert.equal((await store.status(who)).remaining, 2);
  assert.equal((await store.status(who)).pending, false);
  await assert.rejects(access(directory));
});

test('unlimited vouchers do not require allowance storage; missing paid storage fails closed', async () => {
  const { handler } = handlerFixture(null, { allowances: { reserve: () => assert.fail('unlimited must not touch storage') } });
  for (let n = 0; n < 3; n++) assert.equal((await call(handler)).status, 200);
  const unavailable = async () => { throw new Error('database unavailable'); };
  const down = handlerFixture(identity(), { allowances: { reserve: unavailable, status: unavailable } });
  assert.equal((await call(down.handler)).status, 503);
  assert.equal((await call(down.handler, { method: 'GET' })).status, 503);
  assert.equal(down.state.renders, 0);
});

test('a reservation returned after cancellation is released without starting source work', async () => {
  const who = identity();
  let releaseReservation;
  const waiting = new Promise(resolve => releaseReservation = resolve);
  let reached;
  const entered = new Promise(resolve => reached = resolve);
  const allowances = {
    reserve: async (...args) => { reached(); await waiting; return store.reserve(...args); },
    succeed: (...args) => store.succeed(...args),
    release: (...args) => store.release(...args),
  };
  const { handler, state } = handlerFixture(who, { allowances });
  const res = new EventEmitter(), pending = call(handler, { res });
  await entered;
  res.destroyed = true; res.emit('close');
  releaseReservation();
  await pending;
  assert.equal(state.renders, 0);
  assert.equal((await store.status(who)).pending, false);
  assert.equal((await store.status(who)).remaining, 2);
});

test('committed response lost to a disconnect cannot be rendered free on retry', async () => {
  const who = identity(), operation = randomUUID();
  const res = new EventEmitter();
  const { handler, state } = handlerFixture(who, {
    allowances: {
      reserve: (...args) => store.reserve(...args),
      succeed: async (...args) => {
        await store.succeed(...args);
        res.destroyed = true; res.emit('close');
      },
      release: (...args) => store.release(...args),
    },
  });
  await call(handler, { res, operation });
  assert.equal((await store.status(who)).remaining, 1);
  assert.equal((await call(handler, { operation })).status, 409);
  assert.equal(state.renders, 1);
});

test('runtime allowance readiness checks schema and permissions, independently of website compilation', async () => {
  await studioAllowanceReady(pool);
  await pool.query('ALTER TABLE public.santa_studio_creation_allowances RENAME operations TO missing_operations');
  try { await assert.rejects(studioAllowanceReady(pool)); }
  finally { await pool.query('ALTER TABLE public.santa_studio_creation_allowances RENAME missing_operations TO operations'); }
  await assert.rejects(studioAllowanceReady({
    query: async sql => sql.includes('LIMIT 0') ? { rows: [] } : { rows: [{ allowed: false }] },
  }), /PERMISSIONS_REQUIRED/);
});
