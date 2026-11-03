import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { createWorkshopAccessHandler, consumeWorkshopAttempt, issueWorkshopToken, hasWorkshopAccess, workshopSession, WORKSHOP_COOKIE, WORKSHOP_SESSION_MS } from '../server/santa-workshop-access.js';
import { databasePool } from '../server/name-request-store.js';
import { workshopSettings, workshopConfigured, SCHOOL_TEST_START, SCHOOL_TEST_DEADLINE } from '../server/santa-workshop-settings.js';
import { createStudioMessageHandler } from '../server/santa-studio-message.js';
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
    recordUsage: async () => {},
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

const schoolConfig = workshopSettings({
  ...Object.fromEntries(config.codes.map(entry => [`SANTA_STUDIO_TEST_CODE_${entry.id}`, entry.code])),
  SANTA_STUDIO_TEST_CODE_6: randomBytes(24).toString('hex'),
  SESSION_SECRET: config.signingSecret,
  SANTA_STUDIO_TEST_EXPIRES_AT: '2026-11-30T23:59:59Z',
});

test('school slot adds capacity without changing existing signed sessions or global deadlines', () => {
  const now = SCHOOL_TEST_START;
  const legacy = { ...schoolConfig, codes: schoolConfig.codes.slice(0, 5) };
  for (const entry of legacy.codes) {
    const token = issueWorkshopToken(legacy, now, entry.id);
    assert.equal(hasWorkshopAccess(request(token), schoolConfig, now), true);
    assert.equal(workshopSession(request(token), schoolConfig, now).expiresAt, now + WORKSHOP_SESSION_MS);
  }
  const first = workshopSession(request(issueWorkshopToken(schoolConfig, now, '6')), schoolConfig, now);
  const second = workshopSession(request(issueWorkshopToken(schoolConfig, now, '6')), schoolConfig, now);
  assert.notEqual(first.generationKey, second.generationKey);
  assert.equal(first.expiresAt, now + WORKSHOP_SESSION_MS);
  const earlier = { ...schoolConfig, expiresAt: now + 1000 };
  assert.equal(workshopSession(request(issueWorkshopToken(earlier, now, '6')), earlier, now).expiresAt, now + 1000);
  for (const invalid of [{ expiresAt: NaN }, { startsAt: NaN }, { startsAt: SCHOOL_TEST_DEADLINE }]) {
    assert.equal(workshopConfigured({ ...schoolConfig, codes: schoolConfig.codes.map(entry =>
      entry.id === '6' ? { ...entry, ...invalid } : entry) }), false);
  }
});

test('school login, sessions and another-message requests enforce exact fixed dates without closing other slots', async () => {
  for (const time of [SCHOOL_TEST_START - 1, SCHOOL_TEST_START, SCHOOL_TEST_DEADLINE - 1, SCHOOL_TEST_DEADLINE, SCHOOL_TEST_DEADLINE + 1]) {
    const open = time >= SCHOOL_TEST_START && time < SCHOOL_TEST_DEADLINE;
    await withServer({ getSettings: () => schoolConfig, now: () => time }, async ({ url, post }) => {
      const reply = await post(schoolConfig.codes[5].code);
      assert.equal(reply.status, open ? 200 : 410);
      assert.equal(!!reply.headers.get('set-cookie'), open);
      if (open) assert.equal((await reply.json()).expiresAt, Math.min(time + WORKSHOP_SESSION_MS, SCHOOL_TEST_DEADLINE));
      const token = issueWorkshopToken(schoolConfig, SCHOOL_TEST_DEADLINE - 60000, '6');
      const cookie = `${WORKSHOP_COOKIE}=${token}`;
      const active = time >= SCHOOL_TEST_DEADLINE - 60000 && time < SCHOOL_TEST_DEADLINE;
      assert.equal((await (await fetch(url, { headers: { Cookie: cookie } })).json()).authorized, active);
      const another = await fetch(url, { method: 'POST',
        headers: { Origin: url, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ another: true }) });
      assert.equal(another.status, active ? 200 : 403);
      if (active) assert.equal((await another.json()).expiresAt, SCHOOL_TEST_DEADLINE);
      assert.equal((await post(schoolConfig.codes[0].code)).status, 200);
    });
  }
  assert.throws(() => issueWorkshopToken(schoolConfig, SCHOOL_TEST_START - 1, '6'));
  assert.throws(() => issueWorkshopToken(schoolConfig, SCHOOL_TEST_DEADLINE, '6'));
  const token = issueWorkshopToken(schoolConfig, SCHOOL_TEST_DEADLINE - 60000, '6');
  // Even a correctly signed old session cannot outlive a newly applicable code deadline.
  const uncapped = issueWorkshopToken({ ...schoolConfig, codes: schoolConfig.codes.map(entry =>
    entry.id === '6' ? { ...entry, expiresAt: undefined } : entry) }, SCHOOL_TEST_DEADLINE - 60000, '6');
  assert.equal(hasWorkshopAccess(request(uncapped), schoolConfig, SCHOOL_TEST_DEADLINE - 1), false);
  assert.equal(hasWorkshopAccess(request(token), schoolConfig, SCHOOL_TEST_DEADLINE), false);
});

test('school expiry is rechecked after a delayed login attempt', async () => {
  let time = SCHOOL_TEST_DEADLINE - 1;
  await withServer({ getSettings: () => schoolConfig, now: () => time,
    consumeAttempt: async () => { time++; return { allowed: true }; } }, async ({ post }) => {
    const reply = await post(schoolConfig.codes[5].code);
    assert.equal(reply.status, 410);
    assert.equal(reply.headers.get('set-cookie'), null);
  });
});

test('school entries and deliberate new messages never call the legacy usage writer', async () => {
  const events = [];
  await withServer({ getSettings: () => schoolConfig, now: () => SCHOOL_TEST_START,
    recordUsage: async (session, kind) => { events.push({ session, kind }); } }, async ({ url, post }) => {
    await fetch(url);
    assert.equal((await post('invalid-code')).status, 401);
    assert.equal(events.length, 0);
    const response = await post(schoolConfig.codes[5].code);
    assert.equal(response.status, 200);
    assert.equal(events.length, 0);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const first = workshopSession({ headers: { cookie } }, schoolConfig, SCHOOL_TEST_START);
    await fetch(url, { headers: { Cookie: cookie } });
    assert.equal(events.length, 0);
    const next = await fetch(url, { method: 'POST', headers: {
      Origin: url, Cookie: cookie, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ another: true }) });
    assert.equal(next.status, 200);
    assert.equal(events.length, 0);
    const rotated = workshopSession({ headers: { cookie: next.headers.get('set-cookie').split(';')[0] } },
      schoolConfig, SCHOOL_TEST_START);
    assert.notEqual(first.generationKey, rotated.generationKey);
    assert.equal(first.expiresAt, rotated.expiresAt);
  });
});

test('all valid vouchers and new tests succeed without touching a missing reporting table', async () => {
  const logs = [];
  const time = SCHOOL_TEST_START;
  await withServer({ getSettings: () => schoolConfig, now: () => time,
    log: event => logs.push(event),
    recordUsage: async () => { throw Object.assign(new Error('private-do-not-log'), { code: '42P01' }); },
  }, async ({ url, post }) => {
    assert.equal((await post('invalid-code')).status, 401);
    assert.equal(logs.length, 0);
    for (const entry of schoolConfig.codes) {
      const response = await post(entry.code);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.authorized, true);
      const cookie = response.headers.get('set-cookie').split(';')[0];
      const session = workshopSession({ headers: { cookie } }, schoolConfig, time);
      assert.equal(session.codeId, entry.id);
      assert.equal(session.expiresAt, data.expiresAt);
      const another = await fetch(url, { method: 'POST', headers: {
        Origin: url, Cookie: cookie, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ another: true }) });
      assert.equal(another.status, 200);
      assert.deepEqual(await another.json(), { authorized: true, expiresAt: session.expiresAt });
      assert.equal(workshopSession({ headers: { cookie: another.headers.get('set-cookie').split(';')[0] } },
        schoolConfig, time).codeId, entry.id);
    }
  });
  assert.equal(logs.length, 0);
});

test('direct generation rejects absent and expired school sessions before storage or rendering', async () => {
  const token = issueWorkshopToken(schoolConfig, SCHOOL_TEST_DEADLINE - 60000, '6');
  for (const time of [SCHOOL_TEST_DEADLINE, SCHOOL_TEST_DEADLINE + 1]) {
    const handler = createStudioMessageHandler({
      authorize: req => hasWorkshopAccess(req, schoolConfig, time),
      accessKey: () => assert.fail('Unauthorized request must not reach storage'),
      render: () => assert.fail('Unauthorized request must not render'),
    });
    const server = createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const cookie of ['', `${WORKSHOP_COOKIE}=${token}`]) {
        const response = await fetch(url, { method: 'POST',
          headers: { Origin: url, Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(response.status, 403);
        assert.match(response.headers.get('content-type'), /json/);
      }
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  }
});

test('voucher testers can start further messages without extending access; paid or missing sessions cannot', async () => {
  await withServer({}, async ({ url }) => {
    const another = cookie => fetch(url, {
      method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ another: true }),
    });
    assert.equal((await another()).status, 403);
    assert.equal((await another(`santa-studio-sandbox=cs_test_fake.${'a'.repeat(43)}`)).status, 403);
    for (const entry of config.codes) {
      let token = issueWorkshopToken(config, at - 60000, entry.id);
      const original = workshopSession(request(token), config, at);
      for (let repeat = 0; repeat < 3; repeat++) {
        const response = await another(`${WORKSHOP_COOKIE}=${token}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { authorized: true, expiresAt: original.expiresAt });
        const cookie = response.headers.get('set-cookie');
        assert.match(cookie, /HttpOnly; SameSite=Strict/);
        const next = cookie.split(';')[0].slice(WORKSHOP_COOKIE.length + 1);
        assert.notEqual(next, token);
        const session = workshopSession(request(next), config, at);
        assert.equal(session.expiresAt, original.expiresAt);
        assert.equal(session.codeId, entry.id);
        assert.notEqual(session.generationKey, original.generationKey);
        token = next;
      }
    }
    const expired = issueWorkshopToken(config, at - WORKSHOP_SESSION_MS);
    assert.equal((await another(`${WORKSHOP_COOKIE}=${expired}`)).status, 403);
  });
});

test('starting another voucher test fails closed on rate limits and cross-origin requests', async () => {
  await withServer({ consumeAttempt: async () => ({ allowed: false, retryAfter: 60 }) }, async ({ url }) => {
    const cookie = `${WORKSHOP_COOKIE}=${issueWorkshopToken(config, at)}`;
    const headers = { Origin: url, Cookie: cookie, 'Content-Type': 'application/json' };
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ another: true }) });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('set-cookie'), null);
    const foreign = await fetch(url, {
      method: 'POST', headers: { ...headers, Origin: 'https://other.test' }, body: JSON.stringify({ another: true }),
    });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.headers.get('set-cookie'), null);
  });
});

test('five codes set secure sessions and show only the authenticated user’s own voucher', async () => {
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
      const metadata = await session.json();
      assert.deepEqual(metadata, { authorized: true, expiresAt: at + WORKSHOP_SESSION_MS,
        voucher: { code: entry.code, unlimited: true } });
      for (const other of config.codes.filter(item => item.id !== entry.id)) {
        assert.ok(!JSON.stringify(metadata).includes(other.code));
      }
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
    { ...config, codes: [{ id: '7', code: randomBytes(24).toString('hex') }] },
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
