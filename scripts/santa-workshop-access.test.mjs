import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { createWorkshopAccessHandler, consumeWorkshopAttempt, issueWorkshopToken, hasWorkshopAccess, workshopSession, WORKSHOP_COOKIE, WORKSHOP_SESSION_MS } from '../server/santa-workshop-access.js';
import { databasePool } from '../server/name-request-store.js';
import { workshopSettings, workshopConfigured } from '../server/santa-workshop-settings.js';
import { configurationReport, storageReport } from './workshop-access-preflight.mjs';

const at = 1800000000000;
const config = {
  codes: Array.from({ length: 5 }, (_, index) => ({ id: String(index + 1), code: randomBytes(24).toString('hex') })),
  signingSecret: randomBytes(48).toString('hex'),
  expiresAt: at + 14 * 86400000,
};
const request = token => ({ headers: { cookie: `${WORKSHOP_COOKIE}=${token}` } });

test('signed sessions reject missing, tampered, future, expired and duplicate cookies', () => {
  const token = issueWorkshopToken(config, at);
  assert.equal(hasWorkshopAccess(request(token), config, at), true);
  assert.equal(workshopSession(request(token), config, at).expiresAt, at + WORKSHOP_SESSION_MS);
  assert.equal(hasWorkshopAccess({ headers: {} }, config, at), false);
  assert.equal(hasWorkshopAccess(request(`${token.slice(0, -1)}!`), config, at), false);
  const parts = token.split('.');
  parts[1] = '2';
  assert.equal(hasWorkshopAccess(request(parts.join('.')), config, at), false);
  assert.equal(hasWorkshopAccess(request(token), config, at + WORKSHOP_SESSION_MS), false);
  assert.equal(hasWorkshopAccess(request(token), config, at - 1), false);
  assert.equal(hasWorkshopAccess(request(token), { ...config, signingSecret: '' }, at), false);
  assert.equal(hasWorkshopAccess({ headers: { cookie: `${WORKSHOP_COOKIE}=${token}; ${WORKSHOP_COOKIE}=${token}` } }, config, at), false);
});

test('all five codes grant separate sessions; rotation or removal revokes only that code', () => {
  const tokens = config.codes.map(entry => issueWorkshopToken(config, at, entry.id));
  for (const token of tokens) assert.equal(hasWorkshopAccess(request(token), config, at), true);
  for (let revoked = 0; revoked < 5; revoked++) {
    for (const codes of [
      config.codes.filter((_, index) => index !== revoked),
      config.codes.map((entry, index) => index === revoked ? { ...entry, code: randomBytes(24).toString('hex') } : entry),
    ]) {
      tokens.forEach((token, index) => assert.equal(hasWorkshopAccess(request(token), { ...config, codes }, at), index !== revoked));
    }
  }
});

test('the global test deadline caps sessions and closes access regardless of cookie lifetime', () => {
  const closing = { ...config, expiresAt: at + 60000 };
  const token = issueWorkshopToken(closing, at);
  assert.equal(workshopSession(request(token), closing, at).expiresAt, closing.expiresAt);
  assert.equal(hasWorkshopAccess(request(token), closing, closing.expiresAt), false);
  assert.throws(() => issueWorkshopToken(closing, closing.expiresAt));
  assert.equal(hasWorkshopAccess(request(issueWorkshopToken(config, at)), { ...config, expiresAt: at + 1 }, at), false);
});

async function withServer(options, run) {
  const server = createServer(createWorkshopAccessHandler({
    getSettings: () => config, now: () => at,
    consumeAttempt: async () => ({ allowed: true }), ...options,
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (code = config.codes[0].code, extra = {}) => fetch(url, {
    method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...extra.headers },
    body: JSON.stringify({ code }), ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'headers')),
  });
  try { await run({ url, post }); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('five valid codes set non-persistent HttpOnly same-site cookies; responses never reveal codes', async () => {
  await withServer({}, async ({ url, post }) => {
    assert.deepEqual(await (await fetch(url)).json(), { authorized: false });
    for (const entry of config.codes) {
      const reply = await post(entry.code);
      assert.equal(reply.status, 200);
      const cookie = reply.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly; SameSite=Strict/);
      assert.doesNotMatch(cookie, /Max-Age|Expires|Secure/);
      assert.equal(reply.headers.get('cache-control'), 'private, no-store');
      const body = await reply.text();
      assert.deepEqual(JSON.parse(body), { authorized: true, expiresAt: at + WORKSHOP_SESSION_MS });
      for (const { code } of config.codes) {
        assert.ok(!cookie.includes(code));
        assert.ok(!body.includes(code));
      }
      const session = await fetch(url, { headers: { Cookie: cookie.split(';')[0] } });
      assert.deepEqual(await session.json(), { authorized: true, expiresAt: at + WORKSHOP_SESSION_MS });
    }
    const https = await post(config.codes[0].code, { headers: { Origin: url.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https' } });
    assert.match(https.headers.get('set-cookie'), /; Secure/);
  });
});

test('incorrect codes, legacy password requests, origin checks and body bounds never grant access', async () => {
  let attempts = 0;
  await withServer({ consumeAttempt: async () => { attempts++; return { allowed: true }; } }, async ({ url, post }) => {
    const wrong = await post('incorrect');
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get('set-cookie'), null);
    for (const origin of ['https://other.example', 'null', 'not a URL', `${url}.evil.test`]) {
      assert.equal((await post(config.codes[0].code, { headers: { Origin: origin } })).status, 403);
    }
    assert.equal((await fetch(url, { method: 'POST' })).status, 403);
    assert.equal((await post('a', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await post('a', { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await post('x'.repeat(81))).status, 400);
    assert.equal((await post('x'.repeat(3000))).status, 413);
    for (const body of ['{', '{"code":42}', '{"code":"a","extra":true}', '{"password":"a"}']) {
      assert.equal((await post('', { body })).status, 400);
    }
    for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) {
      const reply = await fetch(url, { method });
      assert.equal(reply.status, 405);
      assert.equal(reply.headers.get('allow'), 'GET, POST');
      assert.match(reply.headers.get('cache-control'), /no-store/);
    }
    assert.equal(attempts, 1);
  });
});

test('expired testing window returns a closed message without issuing any cookie', async () => {
  await withServer({ now: () => config.expiresAt }, async ({ url, post }) => {
    assert.equal((await fetch(url)).status, 410);
    const reply = await post();
    assert.equal(reply.status, 410);
    assert.equal(reply.headers.get('set-cookie'), null);
    assert.equal((await reply.json()).authorized, false);
  });
});

test('missing or duplicate codes, bad expiry and unavailable shared limiter fail closed', async () => {
  for (const missing of [
    { ...config, codes: [] }, { ...config, signingSecret: '' },
    { ...config, expiresAt: NaN }, { ...config, codes: [{ id: '1', code: '' }] },
    { ...config, codes: [{ id: '1', code: 'duplicate' }, { id: '2', code: 'duplicate' }] },
    { ...config, signingSecret: randomBytes(15).toString('hex') },
    { ...config, codes: [{ id: '6', code: randomBytes(24).toString('hex') }] },
    { ...config, codes: [{ id: '1', code: 'x'.repeat(81) }] },
    { ...config, codes: [{ id: '1', code: randomBytes(24).toString('hex') }, { id: '1', code: randomBytes(24).toString('hex') }] },
    { ...config, codes: null }, { ...config, codes: [null] },
  ]) {
    await withServer({ getSettings: () => missing, consumeAttempt: () => assert.fail('Configuration failure must not reach storage') }, async ({ url, post }) => {
      for (const reply of [await fetch(url), await post()]) {
        assert.equal(reply.status, 503);
        assert.equal(reply.headers.get('set-cookie'), null);
        assert.deepEqual(await reply.json(), { error: 'Tester access is not configured yet. Please try again later.' });
      }
    });
  }
  await withServer({ consumeAttempt: async () => { throw new Error(config.codes[0].code); } }, async ({ post }) => {
    const reply = await post();
    assert.equal(reply.status, 503);
    assert.equal(reply.headers.get('set-cookie'), null);
    assert.deepEqual(await reply.json(), { error: 'Workshop access is temporarily unavailable. Please try again.' });
  });
  await withServer({ consumeAttempt: async () => ({ allowed: false, retryAfter: 300 }) }, async ({ post }) => {
    const reply = await post();
    assert.equal(reply.status, 429);
    assert.equal(reply.headers.get('retry-after'), '300');
    assert.equal(reply.headers.get('set-cookie'), null);
  });
});

test('safe preflight shares runtime validation and never emits configured values', () => {
  const env = {
    ...Object.fromEntries(config.codes.map(entry => [`SANTA_STUDIO_TEST_CODE_${entry.id}`, entry.code])),
    SESSION_SECRET: config.signingSecret,
    SANTA_STUDIO_TEST_EXPIRES_AT: '2026-11-30T23:59:59Z',
  };
  const report = configurationReport(env, Date.parse('2026-10-27T00:00:00Z'));
  assert.equal(report.configured, true);
  assert.equal(report.approvedDeadline, true);
  assert.equal(report.testOpen, true);
  assert.equal(report.slots.filter(slot => slot.active).length, 5);
  for (const value of Object.values(env)) assert.ok(!JSON.stringify(report).includes(value));
  assert.equal(configurationReport(env, Date.parse(env.SANTA_STUDIO_TEST_EXPIRES_AT)).testOpen, false);
  for (const [key, value, failedCheck] of [
    ['SANTA_STUDIO_TEST_CODE_2', env.SANTA_STUDIO_TEST_CODE_1, 'codesDistinct'],
    ['SESSION_SECRET', randomBytes(15).toString('hex'), 'signingSecretValid'],
    ['SANTA_STUDIO_TEST_EXPIRES_AT', 'not-a-date', 'expiryParseable'],
    ['SANTA_STUDIO_TEST_CODE_1', 'x'.repeat(81), 'activeCodesValid'],
  ]) {
    const invalid = { ...env, [key]: value };
    const result = configurationReport(invalid);
    assert.equal(result.checks[failedCheck], false);
    assert.equal(result.configured, workshopConfigured(workshopSettings(invalid)));
    assert.equal(result.configured, false);
  }
  assert.equal(configurationReport({ SANTA_WORKSHOP_PASSWORD: randomBytes(24).toString('hex') }).configured, false);
  const revoked = { ...env, SANTA_STUDIO_TEST_CODE_1: '  ' };
  assert.equal(configurationReport(revoked).configured, true);
  assert.equal(configurationReport(revoked).slots[0].active, false);
  assert.equal(workshopSettings({ ...env, SANTA_STUDIO_TEST_CODE_1: ` ${env.SANTA_STUDIO_TEST_CODE_1} ` }).codes[0].code, env.SANTA_STUDIO_TEST_CODE_1);
});

test('storage preflight uses only read-only queries, releases clients and redacts failures', async () => {
  for (const failure of [null, '42P01', '42703', '42501', '08006']) {
    const queries = [];
    let released = false;
    const client = {
      query: async sql => {
        queries.push(sql);
        if (failure && sql.startsWith('SELECT bucket_key')) throw Object.assign(new Error(config.signingSecret), { code: failure });
        return { rows: [{ privileges: true, uniqueKey: true, attemptDefault: true, noRowSecurity: true }] };
      },
      release: () => { released = true; },
    };
    const report = await storageReport({ connect: async () => client });
    assert.equal(report.ready, !failure);
    assert.equal(report.checked, true);
    assert.equal(released, true);
    assert.equal(queries[0], 'BEGIN READ ONLY');
    assert.equal(queries.at(-1), 'ROLLBACK');
    assert.ok(queries.slice(1, -1).every(sql => sql.trim().startsWith('SELECT')));
    assert.ok(!JSON.stringify(report).includes(config.signingSecret));
  }
  for (const key of ['privileges', 'uniqueKey', 'attemptDefault', 'noRowSecurity']) {
    const checks = { privileges: true, uniqueKey: true, attemptDefault: true, noRowSecurity: true, [key]: false };
    const report = await storageReport({ connect: async () => ({ query: async () => ({ rows: [checks] }), release() {} }) });
    assert.equal(report.ready, false);
  }
  const disconnected = await storageReport({ connect: async () => { throw new Error(config.signingSecret); } });
  assert.deepEqual(disconnected, { checked: true, ready: false, reason: 'database_unavailable' });
});

test('shared database limiter bounds parallel attempts and resets at the window boundary', { skip: !process.env.DATABASE_URL }, async () => {
  const now = Date.now();
  const window = Math.floor(now / 900000);
  const key = (identity, bucket = window) => `workshop-tests:${bucket}:${createHmac('sha256', config.signingSecret)
    .update('studio-test:v2:').update(`rate:${identity}`).digest('base64url')}`;
  const keys = [key('global'), key('address:test-client'), key('global', window + 1), key('address:test-client', window + 1), key('address:other-client')];
  const pool = databasePool();
  try {
    const req = { headers: {}, socket: { remoteAddress: 'test-client' } };
    const results = await Promise.all(Array.from({ length: 14 }, () => consumeWorkshopAttempt(req, config, now)));
    assert.equal(results.filter(result => result.allowed).length, 10);
    assert.ok(results.filter(result => !result.allowed).every(result => result.retryAfter > 0));
    assert.equal((await pool.query('SELECT attempts FROM santa_name_request_limits WHERE bucket_key=$1', [key('global')])).rows[0].attempts, 10);
    await pool.query('UPDATE santa_name_request_limits SET attempts=150 WHERE bucket_key=$1', [key('global')]);
    assert.equal((await consumeWorkshopAttempt({ headers: {}, socket: { remoteAddress: 'other-client' } }, config, now)).allowed, false);
    assert.equal((await consumeWorkshopAttempt(req, config, (window + 1) * 900000)).allowed, true);
  } finally {
    await pool.query('DELETE FROM santa_name_request_limits WHERE bucket_key=ANY($1::text[])', [keys]);
    await pool.end();
  }
});
