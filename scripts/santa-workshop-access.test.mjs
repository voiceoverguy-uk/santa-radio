import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { createWorkshopAccessHandler, consumeWorkshopAttempt, issueWorkshopToken, hasWorkshopAccess, WORKSHOP_COOKIE, WORKSHOP_SESSION_MS } from '../server/santa-workshop-access.js';
import { databasePool } from '../server/name-request-store.js';

const config = { password: randomBytes(24).toString('hex'), signingSecret: randomBytes(48).toString('hex') };
const at = 1800000000000;
const request = token => ({ headers: { cookie: `${WORKSHOP_COOKIE}=${token}` } });

test('signed session rejects missing, tampered, expired, duplicate and rotated cookies', () => {
  const token = issueWorkshopToken(config, at);
  assert.equal(hasWorkshopAccess(request(token), config, at), true);
  assert.equal(hasWorkshopAccess({ headers: {} }, config, at), false);
  assert.equal(hasWorkshopAccess(request(`${token.slice(0, -1)}!`), config, at), false);
  const parts = token.split('.');
  parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
  assert.equal(hasWorkshopAccess(request(parts.join('.')), config, at), false);
  assert.equal(hasWorkshopAccess(request(token), config, at + WORKSHOP_SESSION_MS), false);
  assert.equal(hasWorkshopAccess(request(token), config, at - 1), false);
  assert.equal(hasWorkshopAccess(request(token), { ...config, password: 'rotated' }, at), false);
  assert.equal(hasWorkshopAccess(request(token), { ...config, signingSecret: '' }, at), false);
  assert.equal(hasWorkshopAccess({ headers: { cookie: `${WORKSHOP_COOKIE}=${token}; ${WORKSHOP_COOKIE}=${token}` } }, config, at), false);
});

async function withServer(options, run) {
  const server = createServer(createWorkshopAccessHandler({ getSettings: () => config, ...options }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (password = config.password, extra = {}) => fetch(url, {
    method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...extra.headers },
    body: JSON.stringify({ password }), ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'headers')),
  });
  try { await run({ url, post }); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('valid password sets non-persistent HttpOnly same-site cookie and permits status refresh', async () => {
  await withServer({ consumeAttempt: async () => ({ allowed: true }) }, async ({ url, post }) => {
    assert.deepEqual(await (await fetch(url)).json(), { authorized: false });
    const reply = await post();
    assert.equal(reply.status, 200);
    const cookie = reply.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    assert.doesNotMatch(cookie, /Max-Age|Expires|Secure/);
    assert.doesNotMatch(cookie, new RegExp(config.password));
    assert.equal(reply.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await (await fetch(url, { headers: { Cookie: cookie.split(';')[0] } })).json(), { authorized: true });
    const https = await post(config.password, { headers: { Origin: url.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https' } });
    assert.match(https.headers.get('set-cookie'), /; Secure/);
  });
});

test('incorrect password, request protection and body bounds never grant access', async () => {
  let attempts = 0;
  await withServer({ consumeAttempt: async () => { attempts++; return { allowed: true }; } }, async ({ url, post }) => {
    const wrong = await post('incorrect');
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get('set-cookie'), null);
    for (const origin of ['https://other.example', 'null', 'not a URL', `${url}.evil.test`]) {
      assert.equal((await post(config.password, { headers: { Origin: origin } })).status, 403);
    }
    assert.equal((await fetch(url, { method: 'POST' })).status, 403);
    assert.equal((await post(config.password, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await post(config.password, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await post('x'.repeat(1025))).status, 400);
    assert.equal((await post('x'.repeat(3000))).status, 413);
    assert.equal((await post('', { body: '{' })).status, 400);
    assert.equal((await post('', { body: '{"password":42}' })).status, 400);
    assert.equal((await post('', { body: '{"password":"a","extra":true}' })).status, 400);
    for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) {
      const reply = await fetch(url, { method });
      assert.equal(reply.status, 405);
      assert.equal(reply.headers.get('allow'), 'GET, POST');
      assert.match(reply.headers.get('cache-control'), /no-store/);
    }
    assert.equal(attempts, 1);
  });
});

test('missing secrets and unavailable shared limiter fail closed with safe retry errors', async () => {
  for (const missing of [{ ...config, password: '' }, { ...config, signingSecret: '' }]) {
    await withServer({ getSettings: () => missing }, async ({ url, post }) => {
      assert.equal((await fetch(url)).status, 503);
      assert.equal((await post()).status, 503);
    });
  }
  await withServer({ consumeAttempt: async () => { throw new Error(config.password); } }, async ({ post }) => {
    const reply = await post();
    assert.equal(reply.status, 503);
    assert.ok(!(await reply.text()).includes(config.password));
  });
  await withServer({ consumeAttempt: async () => ({ allowed: false, retryAfter: 300 }) }, async ({ post }) => {
    const reply = await post();
    assert.equal(reply.status, 429);
    assert.equal(reply.headers.get('retry-after'), '300');
    assert.equal(reply.headers.get('set-cookie'), null);
  });
});

test('shared database limiter bounds parallel attempts and resets at the window boundary', { skip: !process.env.DATABASE_URL }, async () => {
  const now = Date.now();
  const window = Math.floor(now / 900000);
  const key = (identity, bucket = window) => `workshop:${bucket}:${createHmac('sha256', config.signingSecret)
    .update(`workshop-preview:v1:${config.password}:`).update(identity).digest('base64url')}`;
  const keys = [key('global'), key('address:test-client'), key('global', window + 1), key('address:test-client', window + 1), key('address:other-client')];
  const pool = databasePool();
  try {
    const req = { headers: {}, socket: { remoteAddress: 'test-client' } };
    const results = await Promise.all(Array.from({ length: 14 }, () => consumeWorkshopAttempt(req, config, now)));
    assert.equal(results.filter(result => result.allowed).length, 10);
    assert.ok(results.filter(result => !result.allowed).every(result => result.retryAfter > 0));
    assert.equal((await pool.query('SELECT attempts FROM santa_name_request_limits WHERE bucket_key=$1', [key('global')])).rows[0].attempts, 10);
    // Prove the global limit also works across different clients/instances.
    await pool.query('UPDATE santa_name_request_limits SET attempts=150 WHERE bucket_key=$1', [key('global')]);
    assert.equal((await consumeWorkshopAttempt({ headers: {}, socket: { remoteAddress: 'other-client' } }, config, now)).allowed, false);
    assert.equal((await consumeWorkshopAttempt(req, config, (window + 1) * 900000)).allowed, true);
  } finally {
    await pool.query('DELETE FROM santa_name_request_limits WHERE bucket_key=ANY($1::text[])', [keys]);
    await pool.end();
  }
});
