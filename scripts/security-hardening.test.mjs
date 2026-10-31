import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { createMessageAccessHandler, issueFreeAccess, freeSession, FREE_ACCESS_COOKIE,
  reserveFreeMessage, finishFreeMessage, authorizeFreeMessage, FREE_COOLDOWN_MS } from '../server/santa-message-access.js';
import { consumeNameAccess, trustedAddress } from '../server/santa-name-security.js';
import { createNameRequestHandler } from '../server/name-requests.js';
import { createStripeWebhookHandler } from '../server/stripe-webhook.js';
import { staffAuth } from '../server/staff-auth.js';
import { browserSecurity } from '../server/browser-security.js';
import { createSantaMessageHandler } from '../server/santa-message.js';
import webhookRoute from '../api/stripe/webhook.js';
import webhook from '../server/stripe-webhook.js';
import { createContendersHandler } from '../server/christmas-contenders.js';

const key = 'test-only-hardening-signing-key-not-a-real-secret';
const noLimit = async () => {};
const adult = { FIRSTNAME: 'Test', LASTNAME: 'Fixture', EMAIL: 'adult@example.test' };
let deliveries = 0;
let providerSuccess = true;
const access = createMessageAccessHandler({
  limit: noLimit, issue: email => issueFreeAccess(email, Date.now(), key),
  readSession: req => freeSession(req, Date.now(), key), readAllowance: async () => 0,
  fetcher: async () => {
    deliveries++;
    return new Response(JSON.stringify({ success: providerSuccess, errors: { EMAIL: '<strong>Check email</strong>', CHILD_DATE_OF_BIRTH: 'Required' } }));
  },
});
const denied = createMessageAccessHandler({
  limit: async () => { throw Object.assign(new Error('Too many requests'), { status: 429, retryAfter: 60 }); },
  fetcher: () => assert.fail('Rate-limited signup must not contact provider'),
});
let server, base;
before(async () => {
  const app = express();
  app.use(browserSecurity);
  app.use('/access', access);
  app.use('/limited', denied);
  app.use('/staff', staffAuth, (_req, res) => res.json({ reached: true }));
  app.use('/webhook', createStripeWebhookHandler({ getSync: () => ({
    processWebhook: () => { throw Object.assign(new Error('invalid'), { type: 'StripeSignatureVerificationError' }); },
  }) }));
  app.use('/compressed', express.json({ limit: '2kb', inflate: false }), (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).end());
  server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const post = (path, data, headers = {}) => fetch(base + path, {
  method: 'POST', headers: { 'content-type': 'application/json', origin: base, ...headers },
  body: JSON.stringify(data),
});
test('signup grants require provider success; reject cross-site, invalid fields and honeypots', async () => {
  assert.equal((await post('/access', adult, { origin: 'https://other.invalid' })).status, 403);
  assert.equal((await post('/access', { ...adult, email_address_check: 'bot' })).status, 400);
  assert.equal((await post('/access', { ...adult, FIRSTNAME: '<bad>\ninput' })).status, 400);
  assert.equal(deliveries, 0);
  providerSuccess = false;
  let response = await post('/access', adult);
  assert.equal(response.status, 422);
  assert.equal(response.headers.get('set-cookie'), null);
  const rejected = await response.json();
  assert.equal(rejected.errors.EMAIL, 'Check email');
  assert.equal(rejected.errors.CHILD_DATE_OF_BIRTH, 'Required');
  providerSuccess = true;
  response = await post('/access', adult);
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/i);
  assert.ok(freeSession({ headers: { cookie } }, Date.now(), key));
  assert.doesNotMatch(cookie, /adult|example|Fixture/);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.equal((await (await fetch(base + '/access', { headers: { cookie } })).json()).authorized, true);
  assert.equal((await post('/limited', adult)).status, 429);
});
test('browser storage cannot grant access; cookies reject forgery, expiry and cross-site requests', async () => {
  assert.throws(() => authorizeFreeMessage({ headers: { host: 'site.invalid', origin: 'https://site.invalid', 'x-forwarded-proto': 'https' } }),
    error => error.status === 401);
  const value = issueFreeAccess(adult.EMAIL, 1000, key);
  const req = { headers: { cookie: `${FREE_ACCESS_COOKIE}=${value}` } };
  const session = freeSession(req, 1001, key);
  assert.ok(session);
  assert.notEqual(issueFreeAccess(adult.EMAIL, 1000, key), value);
  assert.equal(freeSession(req, 1001 + 24 * 3600000, key), null);
  assert.equal(freeSession({ headers: { cookie: `${FREE_ACCESS_COOKIE}=${value}x` } }, 1001, key), null);
  const renewed = issueFreeAccess(adult.EMAIL.toUpperCase(), 2000, key);
  assert.equal(freeSession({ headers: { cookie: `${FREE_ACCESS_COOKIE}=${renewed}` } }, 2001, key).subject, session.subject);
});
function allowancePool() {
  const rows = new Map();
  return { rows, async query(sql, values) {
    const [id, marker, expires, now] = values;
    if (sql.startsWith('INSERT')) {
      if (rows.has(id) && rows.get(id).expires_at > now) return { rowCount: 0 };
      rows.set(id, { marker, expires_at: expires }); return { rowCount: 1 };
    }
    if (sql.startsWith('SELECT')) return { rows: rows.has(id) && rows.get(id).expires_at > marker ? [rows.get(id)] : [] };
    if (sql.startsWith('UPDATE')) {
      if (rows.get(id)?.marker !== marker) return { rowCount: 0 };
      rows.get(id).expires_at = expires; return { rowCount: 1 };
    }
    if (rows.get(id)?.marker === marker) rows.delete(id);
    return { rowCount: 1 };
  } };
}
test('atomic rolling allowance survives fresh signup and cookie clearing, denies concurrent renders and releases failures', async () => {
  const pool = allowancePool(), session = { subject: 'stable-adult-digest' }, now = 100000;
  const results = await Promise.allSettled([reserveFreeMessage(session, pool, now), reserveFreeMessage(session, pool, now)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const lease = results.find(result => result.status === 'fulfilled').value;
  await finishFreeMessage(lease, true, pool, now + 1000);
  await assert.rejects(reserveFreeMessage({ ...session }, pool, now + FREE_COOLDOWN_MS),
    error => error.status === 429 && error.retryAfter === 1);
  const next = await reserveFreeMessage(session, pool, now + 1000 + FREE_COOLDOWN_MS);
  await finishFreeMessage(next, false, pool);
  assert.ok(await reserveFreeMessage(session, pool, now + 1000 + FREE_COOLDOWN_MS));
});
test('missing-name limits are independent of visitor cookies and caller forwarding headers', async () => {
  const buckets = new Map();
  const client = { async query(sql, values) {
    if (!sql.includes('INSERT INTO')) return { rowCount: 0 };
    const [bucket, , max] = values;
    const count = buckets.get(bucket) || 0;
    if (count >= max) return { rowCount: 0 };
    buckets.set(bucket, count + 1); return { rowCount: 1 };
  }, release() {} };
  const opts = { pool: { connect: async () => client }, now: 10000, key };
  for (let i = 0; i < 20; i++) await consumeNameAccess({
    headers: { cookie: `arbitrary=${i}`, 'x-forwarded-for': `spoof-${i}` }, socket: { remoteAddress: 'fixed' },
  }, 'request', opts);
  await assert.rejects(consumeNameAccess({ headers: {}, socket: { remoteAddress: 'fixed' } }, 'request', opts),
    error => error.status === 429);
  assert.equal(buckets.size, 2);
  assert.equal(trustedAddress({ headers: { 'x-forwarded-for': 'spoof' }, socket: { remoteAddress: 'fixed' } }), 'fixed');
});
test('missing-name abuse rejection occurs before any save even with fresh cookies', async () => {
  const handler = createNameRequestHandler({
    limit: async () => { throw Object.assign(new Error('Too many requests'), { status: 429, retryAfter: 60 }); },
    save: () => assert.fail('No rejected submission may be saved'),
  });
  let status;
  const res = { set() { return this; }, status(value) { status = value; return this; }, json() {} };
  await handler({ method: 'POST', headers: {}, body: { name: 'Fixture' } }, res);
  assert.equal(status, 429);
});
test('staff authentication errors stay private; anonymous means 401, not malformed input', async () => {
  const response = await fetch(base + '/staff');
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
});
test('Vercel webhook is wired to the signature-checking handler and never accepts unsigned notifications', async () => {
  assert.equal(webhookRoute, webhook);
  assert.equal((await post('/webhook', {})).status, 400);
  assert.equal((await post('/webhook', { livemode: false }, { 'stripe-signature': 'invalid' })).status, 400);
  assert.equal((await fetch(base + '/webhook')).status, 405);
});
test('compressed bodies are refused without decompression; browser policy does not restrict external scripts or connections', async () => {
  const response = await fetch(base + '/compressed', { method: 'POST',
    headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body: gzipSync('{}') });
  assert.equal(response.status, 415);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /frame-ancestors.*replit/);
  assert.doesNotMatch(csp, /default-src|script-src|connect-src|media-src|frame-src/);
});
test('message API rejects a browser-only signup flag before resolving or rendering audio', async () => {
  const handler = createSantaMessageHandler({ resolve: () => assert.fail('No audio access without signup') }, null,
    { limit: noLimit });
  let status;
  const res = { setHeader() {}, writeHead(value) { status = value; }, end() {} };
  await handler({ method: 'POST', headers: { 'content-type': 'application/json', host: 'site.invalid',
    origin: 'https://site.invalid', 'x-forwarded-proto': 'https', cookie: 'santa-message-access=granted' }, body: { name: 'erin', outro: 1 } }, res);
  assert.equal(status, 401);
});
test('Contenders uses the trusted identity and real ballots remain disabled', async () => {
  let scope, status, identity;
  const handler = createContendersHandler({
    abuseLimit: async (_req, value) => { scope = value; },
    digest: value => { identity = value; return 'fixture-bucket'; }, limit: noLimit,
    vote: () => assert.fail('Real voting must remain disabled'),
  });
  const res = { set() { return this; }, status(value) { status = value; return this; }, json() {} };
  await handler({ method: 'POST', protocol: 'http', query: {}, socket: { remoteAddress: 'fixed' },
    headers: { host: 'site.invalid', origin: 'http://site.invalid', 'x-forwarded-for': 'spoof' },
    body: { mode: 'live' } }, res);
  assert.equal(status, 503);
  assert.equal(scope, 'contenderWrite');
  assert.ok(identity.includes('fixed'));
  assert.ok(!identity.includes('spoof'));
});
