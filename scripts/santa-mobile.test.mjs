import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createMobileHandler } from '../server/mobile/handler.js';
import { verifiedPurchases, createPurchaseVerifier } from '../server/mobile/revenuecat.js';
import { createMessageAccessHandler, issueFreeAccess, FREE_ACCESS_COOKIE } from '../server/santa-message-access.js';

const customer = `sr_${'a'.repeat(48)}`;
const products = { permanent: 'prod-permanent', single: 'prod-single' };
const owned = (changes = {}) => ({ object: 'purchase', status: 'owned', store: 'app_store', environment: 'sandbox',
  customer_id: customer, quantity: 1, purchased_at: 10, product_id: products.single,
  store_purchase_identifier: 'apple-transaction-1', ...changes });
test('only confirmed Apple sandbox ownership grants access; refunds and all other states fail closed', () => {
  for (const changes of [{ status: 'refunded' }, { status: 'pending' }, { status: 'cancelled' },
    { store: 'test_store' }, { store: 'promotional' }, { environment: 'production' },
    { customer_id: 'another-person' }, { product_id: 'website-bundle' }, { quantity: 2 },
    { store_purchase_identifier: '' }, { purchased_at: Date.now() + 10000 }]) {
    assert.deepEqual(verifiedPurchases([owned(changes)], products, customer), { permanent: false, single: [] });
  }
  const approved = verifiedPurchases([owned(), owned(), owned({ product_id: products.permanent })], products, customer);
  assert.equal(approved.permanent, true); assert.equal(approved.single.length, 1);
});
test('verifier resolves products from API and follows all purchase pages, never accepts a supplied product id', async () => {
  const paths = [];
  const verify = createPurchaseVerifier({ project: 'test', app: 'apple-app', request: async path => {
    paths.push(path);
    if (path.includes('/products?')) return { object: 'list', items: [
      { id: products.permanent, app_id: 'apple-app', store_identifier: 'uk.co.santaradio.studio.permanent', type: 'non_consumable' },
      { id: products.single, app_id: 'apple-app', store_identifier: 'uk.co.santaradio.studio.single', type: 'consumable' },
    ] };
    if (path.includes('starting_after')) return { object: 'list', items: [owned()] };
    return { object: 'list', items: [], next_page: `/v2/projects/test/customers/${customer}/purchases?starting_after=1` };
  } });
  assert.equal((await verify(customer)).single.length, 1);
  assert.equal(paths.length, 3);
  await assert.rejects(verify('client-chosen-id'), /not configured/);
});
test('verification failure never falls back to cached or client entitlements', async () => {
  const verify = createPurchaseVerifier({ project: 'test', app: 'app', request: async () => { throw Error('offline'); } });
  await assert.rejects(verify(customer), /offline/);
});

async function harness(overrides = {}) {
  const token = randomBytes(32).toString('base64url');
  let grant = '';
  const calls = { reserve: 0, finish: [], render: 0, names: 0 };
  const store = {
    createSession: async () => ({ token, customerId: customer, expiresAt: Date.now() + 10000 }),
    session: async value => { if (value !== token) throw Object.assign(Error('Reconnect'), { status: 401 }); return { customerId: customer, freeGrant: grant }; },
    setFreeGrant: async (_session, value) => { grant = value; },
    entitlement: async p => ({ verified: true, permanent: p.permanent, credits: p.single.length }),
    reserve: async (_id, _request, purchases) => {
      if (!purchases.permanent && !purchases.single.length) throw Object.assign(Error('Purchase required'), { status: 402 });
      calls.reserve++; return { requestKey: 'request', purchaseKey: purchases.permanent ? null : purchases.single[0] };
    },
    finish: async (_lease, success) => { calls.finish.push(success); },
  };
  const audio = async (_req, res) => { calls.render++; res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.end('ID3-test-audio'); };
  const handler = createMobileHandler({ getStore: () => store, verify: async () => ({ permanent: false, single: ['confirmed'] }),
    limit: async () => {}, studio: audio, free: audio,
    names: async (_req, res) => { calls.names++; res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ records: [{ id: 'opaque', name: 'Arabella', selectionToken: 'capability', previewUrl: 'secret', file: 'private.wav' }] })); },
    ...overrides });
  const server = createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/?action=`;
  const call = (action, { body, headers = {} } = {}) => fetch(url + action, { method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { call, calls, close: () => new Promise(resolve => server.close(resolve)), store };
}
test('native endpoint rejects website cookies, browser origins, missing bearer, unknown methods and identities', async () => {
  const h = await harness();
  try {
    for (const headers of [{ Origin: 'https://evil.example' }, { Cookie: 'santa-workshop=fake' }, { 'Sec-Fetch-Site': 'same-origin' }]) {
      assert.equal((await h.call('studio', { body: {}, headers })).status, 403);
    }
    assert.equal((await h.call('studio', { body: {}, headers: { Authorization: 'Bearer fake' } })).status, 401);
    assert.equal((await h.call('session', { body: { customerId: customer } })).status, 400);
    assert.equal((await h.call('studio')).status, 405);
    assert.equal(h.calls.render, 0);
  } finally { await h.close(); }
});
test('unverified and cancelled payments never render or reserve', async () => {
  for (const verify of [async () => { throw Error('offline'); }, async () => ({ permanent: false, single: [] })]) {
    const h = await harness({ verify });
    try {
      const result = await h.call('studio', { body: {}, headers: { 'X-Message-Request-Id': 'test' } });
      assert.ok([402, 503].includes(result.status));
      assert.equal(h.calls.render, 0); assert.equal(h.calls.reserve, 0);
    } finally { await h.close(); }
  }
});
test('failed render releases reservation without consuming; completed MP3 commits before delivery', async () => {
  const fail = await harness({ studio: async (_req, res) => { res.writeHead(503); res.end('{"error":"Recording unavailable"}'); } });
  try { assert.equal((await fail.call('studio', { body: {} })).status, 503); assert.deepEqual(fail.calls.finish, [false]); }
  finally { await fail.close(); }
  const ok = await harness();
  try {
    const result = await ok.call('studio', { body: {} });
    assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), 'audio/mpeg');
    assert.equal(await result.text(), 'ID3-test-audio'); assert.deepEqual(ok.calls.finish, [true]);
    assert.equal(result.headers.get('x-studio-selection'), null); assert.match(result.headers.get('cache-control'), /no-store/);
  } finally { await ok.close(); }
});
test('refund during render discards bytes and releases credit', async () => {
  let reads = 0;
  const h = await harness({ verify: async () => ({ permanent: false, single: ++reads === 1 ? ['confirmed'] : [] }) });
  try {
    const result = await h.call('studio', { body: {} });
    assert.equal(result.status, 403); assert.deepEqual(h.calls.finish, [false]);
    assert.doesNotMatch(await result.text(), /ID3/);
  } finally { await h.close(); }
});
test('empty recordings fail explicitly without consuming a generation', async () => {
  const h = await harness({ studio: async (_req, res) => { res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.end(); } });
  try {
    assert.equal((await h.call('studio', { body: {} })).status, 503);
    assert.deepEqual(h.calls.finish, [false]);
  } finally { await h.close(); }
});
test('catalogue projections expose opaque choices only, never private regional folder keys', async () => {
  const h = await harness({ catalogue: async () => ({
    categories: { age: [{ id: 'age-3', label: '3', file: '/private/three.mp3' }] },
    regionalGroups: { '/private/origin/folder/': { parentId: 'country-1', records: [{ id: 'region-1', label: 'Region', filename: 'secret.mp3' }] } },
  }) });
  try {
    const result = await h.call('catalogue');
    assert.deepEqual(await result.json(), { categories: { age: [{ id: 'age-3', label: '3' }] },
      regionalGroups: { 'country-1': { parentId: 'country-1', records: [{ id: 'region-1', label: 'Region' }] } } });
  } finally { await h.close(); }
});
test('free lookup still needs adult access, response projection strips private paths and preview links', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('names', { body: { query: 'Ar', studio: false } })).status, 401);
    assert.equal(h.calls.names, 0);
    const response = await h.call('names', { body: { query: 'Ar', studio: true } });
    assert.deepEqual((await response.json()).records, [{ id: 'opaque', name: 'Arabella', token: 'capability' }]);
  } finally { await h.close(); }
});
test('signup captures existing server cookie privately and does not send it to the app', async () => {
  // Test-only secret and synthetic address; no provider request or real signup.
  const secret = 'test-mobile-access-key'.repeat(3);
  const grant = issueFreeAccess('parent@example.test', Date.now(), secret);
  const h = await harness({ access: async (_req, res) => {
    res.setHeader('Set-Cookie', `${FREE_ACCESS_COOKIE}=${grant}; HttpOnly; Secure; Path=/`);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"success":true}');
  } });
  try {
    const response = await h.call('signup', { body: { FIRSTNAME: 'Test', LASTNAME: 'Parent', EMAIL: 'parent@example.test' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await h.store.session((await (await h.call('session', { body: {} })).json()).token)).freeGrant, grant);
  } finally { await h.close(); }
});
test('real adult signup handler can run behind the native adapter without bypassing validation', async () => {
  let providerCalls = 0;
  const access = createMessageAccessHandler({ limit: async () => {}, fetcher: async () => {
    providerCalls++; return new Response('{"success":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  const h = await harness({ access });
  try {
    const bad = await h.call('signup', { body: { FIRSTNAME: '', LASTNAME: '', EMAIL: 'bad' } });
    assert.equal(bad.status, 400); assert.equal(providerCalls, 0);
    const trapped = await h.call('signup', { body: {
      FIRSTNAME: 'Test', LASTNAME: 'Parent', EMAIL: 'parent@example.test',
      studio_check: 'bot', email_address_check: '',
    } });
    assert.equal(trapped.status, 400); assert.equal(providerCalls, 0);
    const ok = await h.call('signup', { body: { FIRSTNAME: 'Test', LASTNAME: 'Parent', EMAIL: 'parent@example.test', email_address_check: '' } });
    assert.equal(ok.status, 200); assert.equal(providerCalls, 1);
    assert.equal((await h.call('names', { body: { query: 'Ar', studio: false } })).status, 200);
  } finally { await h.close(); }
});
