import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createOwnerHandler, validOwnerToken } from '../server/studio-owner-handler.js';
import { simulateOwnerEmail, ownerCanary, probeOwnerWorker, ownerReadiness, safeCheckFailure } from '../server/studio-owner-readiness.js';
import { createStudioEmailRetryHandler } from '../server/studio-live-email.js';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';
import { startOwnerCanary, startLiveCheckout } from '../server/studio-live-checkout.js';
import { createHash } from 'node:crypto';
import usageApp from '../server/santa-workshop-usage.js';

const config = { origin: 'http://127.0.0.1', secret: 'fixture-secret'.repeat(4), cronSecret: 'fixture-cron'.repeat(4),
  emailKey: 'fixture-not-a-real-key', emailFrom: 'santa@santaradio.co.uk' };
async function serve(app, run) {
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { const url = `http://127.0.0.1:${server.address().port}`; await run(url); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('deployed owner route rejects anonymous, voucher and invalid scoped-token access', async () => {
  await serve(usageApp, async url => {
    for (const headers of [{}, { Cookie: 'santa-workshop-preview=fixture' },
      { Authorization: `Bearer studio-owner.${'x'.repeat(43)}` }]) {
      const response = await fetch(`${url}?diagnostic=live-launch`, { headers });
      assert.equal(response.status, 401);
      const text = await response.text();
      assert(!text.includes(config.secret));
      assert(!text.includes('checks'));
    }
  });
});
test('owner token is high entropy, exact and scoped; no missing-secret fallback', () => {
  const token = 'a'.repeat(43), env = { STUDIO_OWNER_TOKEN: token };
  assert.equal(validOwnerToken({ headers: { authorization: `Bearer studio-owner.${token}` } }, env), true);
  for (const authorization of ['', `Bearer ${token}`, `Bearer studio-owner.${'b'.repeat(43)}`, 'Bearer studio-owner.short']) {
    assert.equal(validOwnerToken({ headers: { authorization } }, env), false);
  }
  assert.equal(validOwnerToken({ headers: { authorization: `Bearer studio-owner.${token}` } }, {}), false);
});
test('owner API rejects non-owner, wrong origins, non-JSON and arbitrary actions before side effects', async () => {
  for (const allowed of [401, 403, 200]) {
    let calls = 0, origin;
    const app = createOwnerHandler({ checkAdmin: async () => allowed, getConfig: () => ({ ...config, origin }),
      consume: async () => true, report: async () => { calls++; return { checks: {} }; },
      simulator: async () => { calls++; return { simulatorAccepted: true }; } });
    await serve(app, async url => {
      origin = url;
      assert.equal((await fetch(url)).status, allowed);
      if (allowed !== 200) { assert.equal(calls, 0); return; }
      assert.equal((await fetch(url, { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{"action":"simulator"}' })).status, 403);
      assert.equal((await fetch(url, { method: 'POST', headers: { Origin: url }, body: '{}' })).status, 415);
      assert.equal((await fetch(url, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: '{"action":"enable-sales"}' })).status, 400);
      assert.equal(calls, 1);
      const r = await fetch(url, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: '{"action":"simulator"}' });
      assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-store/);
      assert.equal(calls, 2);
    });
  }
});
test('simulator refuses pending emails and writes sender health only after actual acceptance', async () => {
  const db = await studioTestDatabase();
  try {
    let sends = 0;
    const fetcher = async (_url, init) => {
      sends++; const body = JSON.parse(init.body);
      assert.deepEqual(body.to, ['delivered+studio-health@resend.dev']);
      assert(!body.text.includes('#studio-return='));
      return { ok: true, json: async () => ({ id: 'simulated' }) };
    };
    await simulateOwnerEmail({ config, pool: db.pool, fetcher });
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.santa_studio_live_email_health')).rows[0].n, 1);
    await db.pool.query("INSERT INTO public.santa_studio_live_purchases(checkout_session_id,payment_intent_id,claim_sha256,email_sha256) VALUES('fixture','fixture',$1,$1)", ['a'.repeat(64)]);
    await db.pool.query("INSERT INTO public.santa_studio_live_email(id,request_key,checkout_session_id,nonce,token_sha256,token_expires_at) VALUES('00000000-0000-4000-8000-000000000000','fixture','fixture','nonce',$1,now())", ['b'.repeat(64)]);
    await assert.rejects(simulateOwnerEmail({ config, pool: db.pool, fetcher }), /OUTBOX_NOT_EMPTY/);
    assert.equal(sends, 1);
  } finally { await db.close(); }
});
test('real retry handler authenticates simulator mode and never drains customer outbox', async () => {
  let sends = 0, writes = 0;
  await serve(createStudioEmailRetryHandler({ getProbeConfig: () => config,
    getConfig: () => { throw new Error('Scheduled retry still off'); },
    getPool: () => ({ query: async () => { writes++; } }),
    deliver: async () => assert.fail('Customer delivery forbidden'),
    simulator: async () => { sends++; },
  }), async url => {
    assert.equal((await fetch(url, { headers: { 'X-Studio-Simulator-Only': '1' } })).status, 403);
    assert.equal(sends, 0);
    assert.equal((await fetch(url)).status, 503);
    const result = await probeOwnerWorker({ config: { ...config, origin: url } });
    assert.equal(result.workerVerified, true);
    assert.equal(sends, 1); assert.equal(writes, 1);
  });
});
test('canary requires fresh non-webhook checks and cannot grant paid access', async () => {
  const res = { status(code) { this.code = code; return this; }, json(data) { return data; }, cookie() { this.cookies = (this.cookies || 0) + 1; } };
  let starts = 0;
  const options = { config, pool: {}, getStripe: async () => ({}), readiness: async () => ({ canaryReady: false }),
    start: async () => { starts++; return { sessionId: 'cs_live_fixture', url: 'https://checkout.stripe.com/fixture' }; } };
  await ownerCanary({}, res, options); assert.equal(res.code, 409); assert.equal(starts, 0);
  await ownerCanary({}, res, { ...options, readiness: async () => ({ canaryReady: true }) });
  assert.equal(starts, 1); assert.equal(res.cookies, 2);
});
test('owner checkout reuses one claim while the normal sales switch stays closed', async () => {
  const db = await studioTestDatabase();
  try {
    const claim = 'a'.repeat(43), hash = createHash('sha256').update(claim).digest('hex');
    let creates = 0;
    const offerConfig = { ...config, offer: 'fixture', priceId: 'price_fixture', productId: 'prod_fixture' };
    const session = { id: 'cs_live_fixture', status: 'open', livemode: true, url: 'https://checkout.stripe.com/fixture', metadata: { offer: 'fixture', access_claim_sha256: hash } };
    const stripe = { prices: { retrieve: async () => ({ id: 'price_fixture', livemode: true, active: true, type: 'one_time', currency: 'gbp', unit_amount: 650, product: { id: 'prod_fixture', livemode: true, active: true } }) },
      checkout: { sessions: { create: async params => { creates++; assert.deepEqual(params.line_items, [{ price: 'price_fixture', quantity: 1 }]); return session; }, retrieve: async () => session } } };
    const options = { claim, config: offerConfig, stripe, pool: db.pool };
    await assert.rejects(startLiveCheckout(options), /SALES_DISABLED/);
    await startOwnerCanary(options); await startOwnerCanary(options);
    assert.equal(creates, 1);
    assert.equal((await db.pool.query('SELECT enabled FROM public.santa_studio_live_sales_settings')).rows[0].enabled, false);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.santa_studio_live_purchases')).rows[0].n, 0);
  } finally { await db.close(); }
});
test('readiness can bootstrap without sales or webhook health, but never without other checks', async () => {
  const db = await studioTestDatabase();
  try {
    await db.pool.query('INSERT INTO public.santa_studio_live_email_health(sender) VALUES($1)', [config.emailFrom]);
    await db.pool.query("INSERT INTO public.santa_studio_live_worker_health(worker) VALUES('email-retry')");
    const c = { ...config, offer: 'fixture', priceId: 'price_fixture', productId: 'prod_fixture', webhookId: 'we_fixture', webhookSecret: 'fixture-webhook' };
    const stripe = { prices: { retrieve: async () => ({ id: c.priceId, livemode: true, active: true, type: 'one_time', currency: 'gbp', unit_amount: 650, product: { id: c.productId, livemode: true, active: true } }) },
      webhookEndpoints: { retrieve: async () => ({ livemode: true, status: 'enabled', url: c.origin + '/api/stripe/webhook', enabled_events: ['checkout.session.completed','checkout.session.async_payment_succeeded'] }) } };
    const options = { config: c, pool: db.pool, stripe, env: { STUDIO_EMAIL_RETRY_APPROVED: 'true' },
      fetcher: async () => ({ ok: true, json: async () => ({ ready: true, offer: c.offer }) }) };
    const report = await ownerReadiness(options);
    assert.equal(report.canaryReady, true);
    assert.equal(report.deliveryReady, false);
    assert.equal(report.checks.webhookDelivery, false);
    assert.equal(JSON.stringify(report).includes(c.secret), false);
    assert.equal((await ownerReadiness({ ...options, env: {} })).canaryReady, false);
    assert.equal((await ownerReadiness({ ...options, fetcher: async () => { throw new Error('Unavailable'); } })).canaryReady, false);
    assert.equal((await db.pool.query('SELECT enabled FROM public.santa_studio_live_sales_settings')).rows[0].enabled, false);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.santa_studio_live_webhook_health')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('readiness reports safe Stripe failure stages and codes without messages or credentials', async () => {
  const leaked = 'sk_live_' + 'S'.repeat(24), webhookSecret = 'whsec_' + 'W'.repeat(24);
  const stripeError = (stage, status, type, code) => Object.assign(new Error(`Invalid API Key provided: ${leaked}`),
    { statusCode: status, type, code, raw: { message: leaked }, studioStage: stage });
  assert.deepEqual(safeCheckFailure(stripeError('account', 403, 'StripePermissionError', 'secret_key_required')),
    { stage: 'account', type: 'StripePermissionError', stripeCode: 'secret_key_required', status: 403 });
  assert.deepEqual(safeCheckFailure(new Error(`network ${leaked}`)), { code: 'UNCLASSIFIED' });
  assert.deepEqual(safeCheckFailure(Object.assign(new Error(leaked), { code: `bad ${leaked}` })), { code: 'UNCLASSIFIED' });
  const report = await ownerReadiness({ config: { ...config, webhookId: 'we_fixture', webhookSecret, priceId: 'price_fixture' },
    pool: { query: async () => { throw new Error(`database ${leaked}`); } },
    stripe: { prices: { retrieve: async () => { throw stripeError(undefined, 401, 'StripeAuthenticationError', undefined); } },
      webhookEndpoints: { retrieve: async () => { throw stripeError(undefined, 404, 'StripeInvalidRequestError', 'resource_missing'); } } },
    fetcher: async () => { throw new Error(leaked); }, env: {} });
  assert.deepEqual(report.failures.stripe, { stage: 'price', type: 'StripeAuthenticationError', status: 401 });
  assert.deepEqual(report.failures.webhookEndpoint, { stage: 'webhook', type: 'StripeInvalidRequestError', stripeCode: 'resource_missing', status: 404 });
  const text = JSON.stringify(report);
  for (const secret of [leaked, webhookSecret, config.secret, config.cronSecret, config.emailKey]) assert(!text.includes(secret));
  assert.equal(report.canaryReady, false);
});

import { stripeCredentialShape } from '../server/studio-live-stripe.js';
test('Stripe credential diagnostics are booleans and accept both live key families', async () => {
  const body = 'A1b2'.repeat(10);
  for (const prefix of ['sk_live_', 'rk_live_']) assert.equal(stripeCredentialShape(prefix + body).accepted, true);
  const cases = [[undefined, 'present', false], [` sk_live_${body}\n`, 'surroundingWhitespace', true],
    [`"sk_live_${body}"`, 'quotes', true], [`sk_test_${body}`, 'testMode', true],
    [`pk_live_${body}`, 'publishableKey', true], [`sk_live_${body}_x`, 'unsupportedCharacters', true]];
  for (const [value, field, expected] of cases) {
    const shape = stripeCredentialShape(value);
    assert.equal(shape[field], expected); assert.equal(shape.accepted, false);
    assert(Object.values(shape).every(v => typeof v === 'boolean'));
    assert(!JSON.stringify(shape).includes(body));
  }
  const report = await ownerReadiness({ config, pool: { query: async () => ({ rowCount: 0 }) }, stripe: { prices: {}, webhookEndpoints: {} },
    fetcher: async () => { throw new Error('x'); }, env: { STRIPE_LIVE_SECRET_KEY: `sk_live_${body}` } });
  assert.equal(report.stripeCredential.accepted, true);
  assert(!JSON.stringify(report).includes(body));
});
