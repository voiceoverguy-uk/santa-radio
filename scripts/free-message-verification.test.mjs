import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { requestFreeMessageCode, confirmFreeMessageCode, sendFreeMessageCode, VERIFICATION_COOKIE } from '../server/free-message-verification.js';
import { createMessageAccessHandler, freeSession, FREE_ACCESS_COOKIE, issueFreeAccess } from '../server/santa-message-access.js';
import { subscribeFreeMessageContact } from '../server/free-message-marketing.js';
import { freeMessageCodeEmail } from '../server/free-message-code-email.js';
process.env.SESSION_SECRET = 'test-free-verification-secret-at-least-thirty-two';
const adult = { action: 'request-code', FIRSTNAME: 'Test', LASTNAME: 'Parent', EMAIL: 'parent@example.test' };
function database() {
  const rows = new Map(), limits = new Map();
  const consents = [];
  const pool = { rows, consents, async query(sql, args = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return {};
    if (sql.includes('INSERT INTO santa_free_message_consents')) { consents.push(args); return {}; }
    if (sql.includes('INSERT INTO santa_name_request_limits')) {
      const count = limits.get(args[0]) || 0; limits.set(args[0], count + 1); return { rowCount: count < 3 ? 1 : 0 };
    }
    if (sql.includes('INSERT INTO santa_free')) {
      rows.set(args[0], { id: args[0], binding_hash: args[1], code_hash: args[2], contact: args[3], fresh: true, delivered: false, attempts: 0 }); return {};
    }
    if (sql.includes('SELECT *')) { const row = rows.get(args[0]); return { rows: row?.binding_hash === args[1] ? [row] : [] }; }
    if (sql.includes('SET delivered')) { rows.get(args[0]).delivered = true; return {}; }
    if (sql.includes('SET attempts')) { rows.get(args[0]).attempts++; return {}; }
    if (sql.includes('DELETE') && args[0]) rows.delete(args[0]);
    return {};
  }, async connect() { return { query: pool.query, release() {} }; } };
  return pool;
}
async function challenge(pool, overrides = {}, fields = adult) {
  let delivered;
  const result = await requestFreeMessageCode(fields, { pool, send: async value => { delivered = value; }, ...overrides });
  return { ...result, code: delivered.code };
}
test('code is private, browser-bound, single-use, and limited per address', async () => {
  const pool = database(), value = await challenge(pool);
  assert.match(value.code, /^\d{6}$/);
  assert.doesNotMatch(JSON.stringify([...pool.rows.values()]), /parent@example/);
  assert.notEqual(pool.rows.get(value.id).code_hash, value.code);
  await assert.rejects(confirmFreeMessageCode({ ...value, binding: 'different-browser' }, pool), /expired/);
  assert.deepEqual(await confirmFreeMessageCode(value, pool), { email: adult.EMAIL, marketingStatus: 'not-requested' });
  await assert.rejects(confirmFreeMessageCode(value, pool), /expired/);
  await challenge(pool); await challenge(pool);
  await assert.rejects(challenge(pool), error => error.status === 429);
});
test('expiry, five wrong attempts and failed delivery cannot grant access', async () => {
  const pool = database(), value = await challenge(pool);
  const wrong = value.code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) await assert.rejects(confirmFreeMessageCode({ ...value, code: wrong }, pool), /doesn’t match/);
  await assert.rejects(confirmFreeMessageCode(value, pool), /expired/);
  const expired = await challenge(pool); pool.rows.get(expired.id).fresh = false;
  await assert.rejects(confirmFreeMessageCode(expired, pool), /expired/);
  const before = pool.rows.size;
  await assert.rejects(challenge(pool, { send: async () => { throw new Error('Delivery failed'); } }), /Delivery failed/);
  assert.equal(pool.rows.size, before);
});
test('Brevo receives transactional HTML and text, never a subscription request', async () => {
  let payload;
  await sendFreeMessageCode({ email: adult.EMAIL, code: '012345' }, async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); payload = JSON.parse(options.body);
    return Response.json({ messageId: 'test-id' }, { status: 201 });
  }, { BREVO_API_KEY: 'test-only' });
  assert.deepEqual(payload.to, [{ email: adult.EMAIL }]);
  assert.match(payload.htmlContent, /012345/); assert.match(payload.textContent, /not opted in/);
  assert.equal(payload.listIds, undefined);
  await assert.rejects(sendFreeMessageCode({ email: adult.EMAIL, code: '012345' }, async () => Response.json({}), { BREVO_API_KEY: 'test-only' }), /send your code/);
  const email = freeMessageCodeEmail('012345');
  assert.match(email.html, /#10382a/); assert.match(email.html, /santa-radio-logo.png/);
  assert.doesNotMatch(email.html, /<script|<form|CHRISTMAS CONTENDERS/);
  assert.throws(() => freeMessageCodeEmail('<bad>'));
});
test('HTTP flow grants nothing before confirmation; old cookies, legacy POST and cross-site calls fail closed', async () => {
  const pool = database(); let sent;
  const app = createMessageAccessHandler({ limit: async () => {}, readAllowance: async () => 0,
    requestCode: fields => requestFreeMessageCode(fields, { pool, send: async value => { sent = value; } }),
    confirmCode: value => confirmFreeMessageCode(value, pool) });
  const server = createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, cookie = '', origin = base) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie }, body: JSON.stringify(body) });
  try {
    assert.equal((await post(adult, '', 'https://untrusted.test')).status, 403);
    assert.equal((await post({ ...adult, action: undefined })).status, 400);
    const requested = await post(adult), data = await requested.json();
    const cookie = requested.headers.getSetCookie()[0].split(';')[0];
    assert.match(cookie, new RegExp(`^${VERIFICATION_COOKIE}=`));
    assert.equal(freeSession({ headers: { cookie } }), null);
    const confirm = { action: 'confirm-code', verificationId: data.verificationId, code: sent.code };
    assert.equal((await post(confirm)).status, 400);
    const accepted = await post(confirm, cookie); assert.equal(accepted.status, 200);
    const access = accepted.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
    assert.equal(freeSession({ headers: { cookie: access } }).verified, true);
    assert.equal((await (await fetch(base, { headers: { cookie: access } })).json()).authorized, true);
    assert.equal((await post(confirm, cookie)).status, 409);
    const valid = issueFreeAccess(adult.EMAIL), value = JSON.parse(Buffer.from(valid.split('.')[0], 'base64url'));
    delete value.verified;
    const old = Buffer.from(JSON.stringify(value)).toString('base64url');
    const signature = createHmac('sha256', process.env.SESSION_SECRET).update(`free-access:${old}`).digest('base64url');
    assert.equal(freeSession({ headers: { cookie: `${FREE_ACCESS_COOKIE}=${old}.${signature}` } }), null);
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('only the recorded opt-in is subscribed, after a correct code, with an audit record', async () => {
  const pool = database(); let calls = 0;
  const subscribe = async contact => { calls++; assert.equal(contact.email, adult.EMAIL); return 'subscribed'; };
  const opted = await challenge(pool, {}, { ...adult, marketingOptIn: true });
  assert.equal(calls, 0);
  const result = await confirmFreeMessageCode(opted, pool, subscribe);
  assert.equal(result.marketingStatus, 'subscribed'); assert.equal(calls, 1);
  assert.equal(pool.consents.length, 1); assert.match(pool.consents[0][3], /unsubscribe/);
  const plain = await challenge(pool);
  await confirmFreeMessageCode({ ...plain, marketingOptIn: true }, pool, subscribe);
  assert.equal(calls, 1, 'confirm payload cannot add consent');
});
test('Brevo subscription uses the free-message list and preserves existing suppressions', async () => {
  const calls = [];
  const contact = { email: adult.EMAIL, firstName: 'Test', lastName: 'Parent' };
  assert.equal(await subscribeFreeMessageContact(contact, { env: { BREVO_API_KEY: 'test-only' }, fetcher: async (url, options) => {
    calls.push({ url, ...options });
    return options.method === 'GET' ? new Response('', { status: 404 }) : Response.json({ id: 1 }, { status: 201 });
  } }), 'subscribed');
  const payload = JSON.parse(calls[1].body);
  assert.deepEqual(payload.listIds, [8]); assert.equal(payload.attributes.OPT_IN, true);
  assert.equal(payload.updateEnabled, false); assert.equal(payload.emailBlacklisted, undefined);
  assert.equal(await subscribeFreeMessageContact(contact, { env: { BREVO_API_KEY: 'test-only' }, fetcher: async (_url, options) => {
    assert.equal(options.method, 'GET'); return Response.json({ emailBlacklisted: true });
  } }), 'suppressed');
  assert.match(freeMessageCodeEmail('123456', { marketingOptIn: true }).text, /also confirms that signup/);
});
