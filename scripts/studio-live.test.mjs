import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';
import { liveStudioConfig, LIVE_STUDIO_ACCOUNT, LIVE_STUDIO_ORIGIN, LIVE_STUDIO_OFFER, LIVE_STUDIO_PRICE, LIVE_STUDIO_PRODUCT } from '../server/studio-live-config.js';
import { verifiedLiveSession, verifyLiveOffer, liveStripeClient } from '../server/studio-live-stripe.js';
import { createLiveCheckoutHandler, startLiveCheckout } from '../server/studio-live-checkout.js';
import { createLiveAccessHandler, LIVE_ACCESS_COOKIE, LIVE_CHECKOUT_COOKIE, LIVE_PENDING_COOKIE,
  signLiveClaim, hasLivePaidAccess } from '../server/studio-live-access.js';
import { createStudioReturnHandler, deliverStudioReturn, sendStudioReturnEmail, createStudioEmailRetryHandler } from '../server/studio-live-email.js';
import { createLiveWebhookHandler, processLiveStudioEvent } from '../server/studio-live-webhook.js';
import { digest, emailDigest, returnToken, transaction, reconcileLivePurchase, queueReturnEmail, liveStoreReady } from '../server/studio-live-store.js';
import { studioLiveReadiness } from '../server/studio-live-readiness.js';
import { hasStudioAccess } from '../server/santa-workshop-catalogue.js';
import { createWorkshopAccessHandler, hasWorkshopAccess } from '../server/santa-workshop-access.js';
import { createStudioMessageHandler } from '../server/santa-studio-message.js';
import { studioAllowanceIdentity, createStudioAllowanceStore } from '../server/studio-creation-allowance.js';
import { livePaidPurchaseId } from '../server/studio-live-access.js';

const validEnv = () => ({
  VERCEL: '1', VERCEL_ENV: 'production', DATABASE_URL: 'fixture-only-not-used',
  STUDIO_LIVE_ORIGIN: LIVE_STUDIO_ORIGIN, STUDIO_LIVE_ACCOUNT_ID: LIVE_STUDIO_ACCOUNT,
  STUDIO_LIVE_PRODUCT_ID: LIVE_STUDIO_PRODUCT, STUDIO_LIVE_PRICE_ID: LIVE_STUDIO_PRICE,
  STRIPE_LIVE_SECRET_KEY: 'sk_live_fixture', STUDIO_RETURN_SECRET: 'fixture-return-signing-secret'.repeat(2),
  STUDIO_LIVE_SALES_ENABLED: 'true', STUDIO_LIVE_DELIVERY_APPROVED: LIVE_STUDIO_OFFER,
  STUDIO_LIVE_WEBHOOK_SECRET: 'whsec_fixture', STUDIO_LIVE_WEBHOOK_ID: 'we_fixture',
  RESEND_API_KEY: 're_fixture', STUDIO_EMAIL_SENDER_APPROVED: 'true', STUDIO_EMAIL_FROM: 'santa@santaradio.co.uk',
  CRON_SECRET: 'fixture-cron-signing-secret'.repeat(2), STUDIO_EMAIL_RETRY_APPROVED: 'true',
});
const config = liveStudioConfig(validEnv(), { sales: true });
const claim = randomBytes(32).toString('base64url');
const id = 'cs_live_fixture1';
const requestCookies = `${LIVE_CHECKOUT_COOKIE}=${signLiveClaim(claim, config)}; ${LIVE_PENDING_COOKIE}=${id}`;
const req = cookie => ({ headers: { cookie } });
function paidSession(sessionId = id) {
  return {
    id: sessionId, livemode: true, mode: 'payment', status: 'complete', payment_status: 'paid',
    amount_total: 650, amount_subtotal: 650, currency: 'gbp',
    metadata: { offer: config.offer, access_claim_sha256: digest(claim) },
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    customer_details: { email: 'studio-buyer@example.invalid' },
    payment_intent: { id: `pi_${sessionId}`, livemode: true, status: 'succeeded', amount: 650, amount_received: 650,
      amount_capturable: 0, currency: 'gbp' },
    line_items: { has_more: false, data: [{ quantity: 1, amount_total: 650, amount_subtotal: 650,
      price: { id: config.priceId, livemode: true, unit_amount: 650, currency: 'gbp', type: 'one_time',
        product: { id: config.productId, livemode: true, active: true } } }] },
  };
}
let database, pool;
before(async () => { database = await studioTestDatabase(); pool = database.pool; });
after(async () => { await database?.close(); });
beforeEach(async () => {
  await pool.query('TRUNCATE public.santa_studio_creation_allowances');
  await pool.query(`TRUNCATE public.santa_studio_live_attempts,public.santa_studio_live_purchases,
    public.santa_studio_live_sessions,public.santa_studio_live_events,public.santa_studio_live_email,
    public.santa_studio_live_email_health,public.santa_studio_live_webhook_health,public.santa_studio_live_worker_health,
    public.santa_studio_live_limits CASCADE`);
  await pool.query("UPDATE public.santa_studio_live_sales_settings SET enabled=true WHERE key='public'");
});
async function attempt(sessionId = id) {
  await pool.query('INSERT INTO public.santa_studio_live_attempts(claim_sha256,checkout_session_id) VALUES($1,$2)', [digest(claim), sessionId]);
}
async function purchase() {
  await attempt();
  assert.equal(await transaction(pool, client => reconcileLivePurchase(client, paidSession(), config)), true);
}
async function count(table) {
  return Number((await pool.query(`SELECT count(*) FROM public.${table}`)).rows[0].count);
}
async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Host: new URL(config.origin).host, Origin: config.origin, 'Content-Type': 'application/json', Cookie: requestCookies };
  // Node's fetch ignores caller-supplied Host. Use a real HTTP request so the
  // production-host guard is exercised rather than weakened for tests.
  const send = (method, body, extra = {}) => new Promise((resolve, reject) => {
    const request = httpRequest(url, { method, headers: { ...headers, ...extra } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode, headers: Object.entries(response.headers)
          .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(v => [key, v])),
      })));
    });
    request.on('error', reject); request.end(body);
  });
  return {
    get: extra => send('GET', undefined, extra),
    post: (body = {}, extra = {}) => send('POST', JSON.stringify(body), extra),
    raw: (body, extra) => send('POST', body, extra),
  };
}

test('live configuration is production-only, exact-offer and fail-closed', () => {
  assert.equal(config.priceId, LIVE_STUDIO_PRICE);
  for (const change of [
    { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, { VERCEL: '' },
    { STUDIO_LIVE_SALES_ENABLED: 'false' }, { STUDIO_LIVE_PRICE_ID: 'price_other' },
    { STUDIO_LIVE_ACCOUNT_ID: 'acct_other' }, { STUDIO_LIVE_PRODUCT_ID: 'prod_other' },
    { STUDIO_LIVE_ORIGIN: 'https://evil.example' }, { STRIPE_LIVE_SECRET_KEY: 'sk_test_fixture' },
    { STRIPE_LIVE_SECRET_KEY: '' }, { STUDIO_RETURN_SECRET: '' }, { DATABASE_URL: '' },
    { STUDIO_LIVE_DELIVERY_APPROVED: '' }, { STUDIO_LIVE_WEBHOOK_SECRET: '' }, { RESEND_API_KEY: '' },
    { STUDIO_EMAIL_SENDER_APPROVED: '' }, { STUDIO_EMAIL_FROM: 'santa@studio.santaradio.co.uk' },
    { STUDIO_EMAIL_RETRY_APPROVED: '' }, { CRON_SECRET: '' },
  ]) assert.throws(() => liveStudioConfig({ ...validEnv(), ...change }, { sales: true }));
  assert.doesNotThrow(() => liveStudioConfig({ ...validEnv(), STUDIO_LIVE_SALES_ENABLED: 'false', STRIPE_LIVE_SECRET_KEY: '', RESEND_API_KEY: '' }));
  assert.doesNotThrow(() => liveStudioConfig({ ...validEnv(), STUDIO_EMAIL_TRACKING_DISABLED: '' }, { sales: true }),
    'Plain-text return email must not require a domain-wide HTML tracking setting');
});

test('only complete, correct live payment and every expanded resource can authorize', () => {
  assert.equal(verifiedLiveSession(paidSession(), config), true);
  const changes = [
    s => s.livemode = false, s => s.status = 'open', s => s.status = 'expired',
    s => s.payment_status = 'unpaid', s => s.payment_status = 'no_payment_required',
    s => s.mode = 'subscription', s => s.amount_total = 1, s => s.amount_subtotal = 1,
    s => s.currency = 'usd', s => s.metadata.offer = 'family', s => s.metadata.access_claim_sha256 = '',
    s => s.line_items.has_more = true, s => s.line_items.data.push(s.line_items.data[0]),
    s => s.line_items.data[0].quantity = 2, s => s.line_items.data[0].amount_total = 1,
    s => s.line_items.data[0].price.livemode = false, s => s.line_items.data[0].price.id = 'price_wrong',
    s => s.line_items.data[0].price.product.id = 'prod_wrong', s => s.line_items.data[0].price.product.livemode = false,
    s => s.line_items.data[0].price.recurring = { interval: 'month' }, s => s.payment_intent.livemode = false,
    s => s.payment_intent.status = 'processing', s => s.payment_intent.status = 'canceled',
    s => s.payment_intent.status = 'requires_payment_method', s => s.payment_intent.amount_received = 0,
    s => s.payment_intent.amount = 1, s => s.payment_intent.currency = 'usd', s => s.payment_intent.amount_capturable = 650,
    s => s.total_details.amount_discount = 50, s => delete s.payment_intent, s => delete s.line_items,
    s => delete s.total_details, s => delete s.payment_intent.amount_capturable,
  ];
  for (const change of changes) { const s = paidSession(); change(s); assert.equal(verifiedLiveSession(s, config), false); }
});

test('credential mode prefixes alone cannot prove the configured live account', async () => {
  for (const [balance, account] of [
    [{ livemode: false }, { id: config.accountId, charges_enabled: true }],
    [{ livemode: true }, { id: 'acct_wrong', charges_enabled: true }],
    [{ livemode: true }, { id: config.accountId, charges_enabled: false }],
  ]) await assert.rejects(liveStripeClient(config, validEnv(), () => ({
    balance: { retrieve: async () => balance }, accounts: { retrieve: async () => account },
  })), /STUDIO_LIVE_(KEY_NOT_LIVE|ACCOUNT_MISMATCH|CHARGES_DISABLED)/);
});

test('active exact £6.50 one-time price and active expanded product are required before checkout', async () => {
  const price = { ...paidSession().line_items.data[0].price, active: true, unit_amount_decimal: '650' };
  const stripe = { prices: { retrieve: async () => price } };
  assert.equal(await verifyLiveOffer(stripe, config), price);
  for (const decimal of ['650', Stripe.Decimal.from('650'), Stripe.Decimal.from('650.000')]) {
    const candidate = { ...price, unit_amount_decimal: decimal };
    assert.equal(await verifyLiveOffer({ prices: { retrieve: async () => candidate } }, config), candidate);
  }
  for (const decimal of ['649', '650.01', null, Stripe.Decimal.from('650.000000000001')]) {
    await assert.rejects(verifyLiveOffer({
      prices: { retrieve: async () => ({ ...price, unit_amount_decimal: decimal }) },
    }, config), /STUDIO_LIVE_PRICE_NOT_VERIFIED/);
  }
  for (const key of ['active', 'livemode']) {
    await assert.rejects(verifyLiveOffer({ prices: { retrieve: async () => ({ ...price, [key]: false }) } }, config));
  }
  await assert.rejects(verifyLiveOffer({ prices: { retrieve: async () => ({ ...price, product: { ...price.product, active: false } }) } }, config));
});

test('SQL migration is sufficient for full readiness and refuses absent columns/privileges', async () => {
  await liveStoreReady(pool);
  await pool.query('ALTER TABLE public.santa_studio_live_sessions RENAME token_sha256 TO broken_token');
  try { await assert.rejects(liveStoreReady(pool)); }
  finally { await pool.query('ALTER TABLE public.santa_studio_live_sessions RENAME broken_token TO token_sha256'); }
  await pool.query('ALTER TABLE public.santa_studio_live_purchases DROP CONSTRAINT santa_studio_live_purchases_payment_intent_id_key');
  try { await assert.rejects(liveStoreReady(pool), /CONSTRAINTS_REQUIRED/); }
  finally { await pool.query('ALTER TABLE public.santa_studio_live_purchases ADD UNIQUE(payment_intent_id)'); }
});

test('concurrent checkout uses one session and server-owned exact price, origin and idempotency key', async () => {
  let creates = 0, parameters, key;
  const price = { ...paidSession().line_items.data[0].price, active: true };
  let checkout;
  const stripe = { prices: { retrieve: async () => price }, checkout: { sessions: {
    retrieve: async () => checkout,
    create: async (p, options) => {
      creates++; parameters = p; key = options.idempotencyKey;
      checkout = { id, status: 'open', livemode: true, metadata: p.metadata, url: 'https://checkout.stripe.com/c/pay/fixture' };
      return checkout;
    },
  } } };
  const results = await Promise.all([1, 2, 3].map(() => startLiveCheckout({ claim, config, stripe, pool })));
  assert.equal(creates, 1); assert.equal(new Set(results.map(r => r.url)).size, 1);
  assert.deepEqual(parameters.line_items, [{ price: config.priceId, quantity: 1 }]);
  assert.equal(parameters.mode, 'payment'); assert.equal(parameters.success_url, `${config.origin}/bespoke-personalised-message-from-santa?checkout=return`);
  assert.match(key, /^studio-live:[a-f0-9]{64}:0$/); assert.equal(parameters.customer_creation, undefined);
  assert.equal(parameters.allow_promotion_codes, undefined);
  checkout.status = 'complete';
  assert.equal((await startLiveCheckout({ claim, config, stripe, pool })).pending, true);
  assert.equal(creates, 1);
});

test('forged, missing, duplicate and sandbox claims cannot create a live checkout', async t => {
  let starts = 0, upstream = 0;
  const server = await serve(t, createLiveCheckoutHandler({
    getConfig: () => config, getPool: () => pool, consume: async () => true,
    getStripe: async () => { upstream++; return {}; }, readiness: async () => true,
    start: async () => { starts++; return { sessionId: id, url: 'https://checkout.stripe.com/fixture' }; },
  }));
  for (const Cookie of ['', `${LIVE_CHECKOUT_COOKIE}=${claim}.forged`, `${requestCookies}; ${requestCookies}`, `santa-studio-sandbox=${id}.${claim}`]) {
    assert.equal((await server.post({}, { Cookie })).status, 409);
  }
  assert.equal(starts, 0); assert.equal(upstream, 0);
  const r = await server.post(); assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /__Host-santa-studio-pending=.*HttpOnly; Secure; SameSite=Lax/);
});

test('cross-site, client overrides, outages and sales-off never start checkout or set proof cookies', async t => {
  let starts = 0;
  const server = await serve(t, createLiveCheckoutHandler({
    getConfig: () => config, getPool: () => pool, consume: async () => true,
    getStripe: async () => ({}), readiness: async () => true,
    start: async () => { starts++; return {}; },
  }));
  assert.equal((await server.post({}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await server.post({}, { Host: 'preview.vercel.app' })).status, 403);
  assert.equal((await server.post({}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await server.post({ price: 'cheap' })).status, 400);
  const unavailable = await serve(t, createLiveCheckoutHandler({ getConfig: () => { throw new Error('disabled'); } }));
  const r = await unavailable.get(); assert.equal(r.status, 503); assert.equal(r.headers.get('set-cookie'), null);
  const outage = await serve(t, createLiveCheckoutHandler({
    getConfig: () => config, getPool: () => pool, consume: async () => true, getStripe: async () => { throw new Error('PRIVATE'); },
  }));
  const failed = await outage.post(); assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /PRIVATE/);
  assert.equal(starts, 0);
});

test('claim-bound reconciliation and concurrent returns grant once and queue only one initial email', async () => {
  await attempt();
  const results = await Promise.all([1, 2, 3].map(() => transaction(pool, client => reconcileLivePurchase(client, paidSession(), config))));
  assert.ok(results.every(Boolean));
  assert.equal(await count('santa_studio_live_purchases'), 1);
  assert.equal(await count('santa_studio_live_email'), 1);
  const wrong = paidSession(); wrong.metadata.access_claim_sha256 = digest('wrong');
  assert.equal(await transaction(pool, client => reconcileLivePurchase(client, wrong, config)), false);
});

test('pending and tampered sessions do not persist any paid entitlement', async () => {
  await attempt();
  const s = paidSession(); s.payment_intent.status = 'processing';
  assert.equal(await transaction(pool, client => reconcileLivePurchase(client, s, config)), false);
  assert.equal(await count('santa_studio_live_purchases'), 0);
});

test('existing server-verified access survives Stripe/email outages and disabled new sales', async t => {
  await purchase();
  await pool.query("UPDATE public.santa_studio_live_sales_settings SET enabled=false WHERE key='public'");
  await assert.rejects(startLiveCheckout({ claim, config, stripe: {}, pool }), /STUDIO_LIVE_SALES_DISABLED/);
  assert.equal(await hasLivePaidAccess(req(requestCookies), { config, pool }), true);
  assert.equal(await hasLivePaidAccess(req(`santa-studio-sandbox=${id}.${claim}`), { config, pool }), false);
  assert.equal(await hasLivePaidAccess(req(requestCookies.replace(claim, randomBytes(32).toString('base64url'))), { config, pool }), false);
  const server = await serve(t, createLiveAccessHandler({
    getConfig: () => liveStudioConfig({ ...validEnv(), STUDIO_LIVE_SALES_ENABLED: 'false', STRIPE_LIVE_SECRET_KEY: '', RESEND_API_KEY: '' }),
    getPool: () => pool, getStripe: async () => { throw new Error('must not call Stripe'); },
  }));
  assert.equal((await (await server.get()).json()).authorized, true);
});

test('a successful bound browser return verifies Stripe before issuing live HttpOnly access', async t => {
  await attempt();
  const server = await serve(t, createLiveAccessHandler({
    getConfig: () => config, getPool: () => pool, consume: async () => true,
    getStripe: async () => ({ checkout: { sessions: { retrieve: async () => paidSession() } } }),
  }));
  const response = await server.get();
  assert.equal((await response.json()).authorized, true);
  assert.match(response.headers.get('set-cookie'), /__Host-santa-studio-paid=.*HttpOnly; Secure; SameSite=Lax/);
  assert.equal(await count('santa_studio_live_purchases'), 1);
});

test('signed raw live webhooks reconcile tab-closed payments once, wrong-mode and bad signatures never do', async t => {
  await attempt();
  const event = { id: 'evt_fixture', type: 'checkout.session.completed', livemode: true, data: { object: { id } } };
  const stripe = { events: { retrieve: async () => event }, checkout: { sessions: { retrieve: async () => paidSession() } } };
  const results = await Promise.all([1, 2].map(() => processLiveStudioEvent(event, { config, stripe, pool })));
  assert.equal(results.filter(r => r.authorized).length, 1);
  assert.equal(await count('santa_studio_live_purchases'), 1);
  assert.equal(await count('santa_studio_live_events'), 1);
  const server = await serve(t, createLiveWebhookHandler({ getConfig: () => config, getStripe: async () => stripe, getPool: () => pool }));
  const body = JSON.stringify({ ...event, livemode: false });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret });
  assert.equal((await server.raw(body, { 'Stripe-Signature': signature })).status, 400);
  assert.equal((await server.raw(JSON.stringify(event), { 'Stripe-Signature': 'forged' })).status, 400);
  const liveBody = JSON.stringify(event);
  const liveSignature = Stripe.webhooks.generateTestHeaderString({ payload: liveBody, secret: config.webhookSecret });
  assert.equal((await server.raw(liveBody, { 'Stripe-Signature': liveSignature })).status, 200);
  const wrongAccount = { ...stripe, events: { retrieve: async () => ({ ...event, livemode: false }) } };
  await assert.rejects(processLiveStudioEvent(event, { config, stripe: wrongAccount, pool }));
});

test('email retries are durable and concurrent workers do not duplicate a send', async () => {
  await purchase();
  const stripe = { checkout: { sessions: { retrieve: async () => paidSession() } } };
  let sent = 0, emailToken;
  const send = async data => { sent++; emailToken = data.token; };
  const result = await deliverStudioReturn({ config, stripe, pool, send: async () => { throw new Error('provider down'); } });
  assert.equal(result.retry, true);
  assert.equal((await pool.query('SELECT attempts FROM public.santa_studio_live_email')).rows[0].attempts, 1);
  await pool.query('UPDATE public.santa_studio_live_email SET next_attempt_at=now()');
  await Promise.all([1, 2, 3].map(() => deliverStudioReturn({ config, stripe, pool, send })));
  assert.equal(sent, 1); assert.match(emailToken, /^[A-Za-z0-9_-]{43}$/);
  const row = (await pool.query('SELECT * FROM public.santa_studio_live_email')).rows[0];
  assert.equal(row.token_sha256, digest(emailToken)); assert.notEqual(row.token_sha256, emailToken);
  assert.equal(row.email, undefined);
});

test('return tokens redeem atomically once, do not expire purchase, and reject forged/expired tokens', async t => {
  await purchase();
  const { rows: [row] } = await pool.query('SELECT * FROM public.santa_studio_live_email');
  const token = returnToken(row.nonce, config);
  await pool.query('UPDATE public.santa_studio_live_email SET sent_at=now()');
  const server = await serve(t, createStudioReturnHandler({ getConfig: () => config, getPool: () => pool, consume: async () => true }));
  const responses = await Promise.all([server.post({ token }), server.post({ token })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 410]);
  const granted = responses.find(r => r.status === 200);
  assert.match(granted.headers.get('set-cookie'), /__Host-santa-studio-paid=.*HttpOnly; Secure; SameSite=Lax/);
  assert.equal(await count('santa_studio_live_sessions'), 1);
  assert.equal((await server.post({ token: randomBytes(32).toString('base64url') })).status, 410);
  await pool.query('UPDATE public.santa_studio_live_email SET consumed_at=NULL,token_expires_at=now()-interval \'1 second\'');
  assert.equal((await server.post({ token })).status, 410);
  assert.equal(await count('santa_studio_live_purchases'), 1);
});

test('emailed returns replace credentials without resetting either purchase creation', async t => {
  await purchase();
  const store = createStudioAllowanceStore(pool);
  const resolve = cookie => studioAllowanceIdentity(req(cookie), {
    visitorSession: () => null, production: () => true,
    livePurchase: request => livePaidPurchaseId(request, { config, pool }),
  });
  const original = await resolve(requestCookies);
  const operation = () => crypto.randomUUID();
  await store.succeed(original, await store.reserve(original, operation()));
  const server = await serve(t, createStudioReturnHandler({
    getConfig: () => config, getEmailConfig: () => config, getPool: () => pool, consume: async () => true,
  }));
  for (let turn = 0; turn < 2; turn++) {
    if (turn) await server.post({ email: 'studio-buyer@example.invalid' });
    const { rows: [email] } = await pool.query(`SELECT * FROM public.santa_studio_live_email
      WHERE consumed_at IS NULL ORDER BY token_expires_at DESC LIMIT 1`);
    await pool.query('UPDATE public.santa_studio_live_email SET sent_at=now() WHERE id=$1', [email.id]);
    const response = await server.post({ token: returnToken(email.nonce, config) });
    assert.equal(response.status, 200);
    const returned = await resolve(response.headers.get('set-cookie').split(';')[0]);
    assert.deepEqual(returned, original);
    assert.equal((await store.status(returned)).remaining, turn ? 0 : 1);
    if (!turn) await store.succeed(returned, await store.reserve(returned, operation()));
    else await assert.rejects(store.reserve(returned, operation()), { status: 409 });
  }
});

test('fresh return requests never enumerate purchasers or depend on a new-sales switch', async t => {
  await purchase();
  const server = await serve(t, createStudioReturnHandler({
    getConfig: () => config, getEmailConfig: () => config, getPool: () => pool, consume: async () => true,
  }));
  const known = await server.post({ email: 'studio-buyer@example.invalid' });
  const unknown = await server.post({ email: 'not-a-buyer@example.invalid' });
  assert.deepEqual(await known.json(), await unknown.json());
  await server.post({ email: 'STUDIO-BUYER@example.invalid' });
  assert.equal(await count('santa_studio_live_email'), 2); // initial + one per-window renewal
  await pool.query("UPDATE public.santa_studio_live_email SET consumed_at=now() WHERE request_key LIKE 'initial:%'");
  await server.post({ email: 'studio-buyer@example.invalid' });
  assert.equal(await count('santa_studio_live_email'), 3, 'A used link must not prevent a fresh return within the same abuse-limit window');
  assert.equal((await server.post({ token: claim }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await server.get()).status, 405);
});

test('return-email content uses a canonical fragment link without child details or an archive promise', async () => {
  let payload, headers;
  await sendStudioReturnEmail({ config, email: 'studio-buyer@example.invalid', token: claim, key: 'fixture-key',
    fetcher: async (_url, options) => { payload = JSON.parse(options.body); headers = options.headers; return { ok: true, json: async () => ({ id: 'mail_fixture' }) }; } });
  assert.equal(payload.from, 'Santa Radio <santa@santaradio.co.uk>');
  assert.deepEqual(Object.keys(payload).sort(), ['from', 'subject', 'text', 'to'],
    'Security emails must remain plain text: no HTML, provider templates or tracking wrappers');
  assert.match(payload.text, /\/bespoke-personalised-message-from-santa#studio-return=/);
  assert.doesNotMatch(payload.text, /\?token=/);
  assert.match(payload.text, /does not expire your purchase/); assert.match(payload.text, /not saved/);
  assert.equal(headers['Idempotency-Key'], 'fixture-key');
});

test('readiness requires live webhook URL, verified delivery, sender health and renderer readiness', async () => {
  const price = { ...paidSession().line_items.data[0].price, active: true };
  const endpoint = { id: config.webhookId, livemode: true, status: 'enabled', url: `${config.origin}/api/stripe/webhook`,
    enabled_events: ['checkout.session.completed', 'checkout.session.async_payment_succeeded'] };
  const stripe = { prices: { retrieve: async () => price }, webhookEndpoints: { retrieve: async () => endpoint } };
  const fetcher = async url => url.endsWith('/stripe/webhook')
    ? { status: 405, headers: new Headers({ 'x-studio-webhook-mode': 'live' }) }
    : { ok: true, json: async () => ({ ready: true, offer: config.offer }) };
  await assert.rejects(studioLiveReadiness({ config, stripe, pool, fetcher }));
  await pool.query('INSERT INTO public.santa_studio_live_webhook_health(endpoint_id,secret_sha256) VALUES($1,$2)', [config.webhookId, digest(config.webhookSecret)]);
  await assert.rejects(studioLiveReadiness({ config, stripe, pool, fetcher }));
  await pool.query('INSERT INTO public.santa_studio_live_email_health(sender) VALUES($1)', [config.emailFrom]);
  await assert.rejects(studioLiveReadiness({ config, stripe, pool, fetcher }));
  await pool.query("INSERT INTO public.santa_studio_live_worker_health(worker) VALUES('email-retry')");
  assert.equal((await studioLiveReadiness({ config, stripe, pool, fetcher })).available, true);
  endpoint.url = 'https://evil.example/api/stripe/webhook';
  await assert.rejects(studioLiveReadiness({ config, stripe, pool, fetcher }));
});

test('the retry worker is authenticated and refuses requests without a secret', async t => {
  let deliveries = 0;
  const server = await serve(t, createStudioEmailRetryHandler({
    getConfig: () => config, getPool: () => pool, deliver: async () => { deliveries++; return { sent: true }; },
  }));
  assert.equal((await server.get()).status, 403); assert.equal(deliveries, 0);
  assert.equal((await server.get({ Authorization: `Bearer ${config.cronSecret}` })).status, 200);
});

for (const stripeState of ['absent', 'unavailable', 'switched off']) {
  test(`voucher entry, invalid feedback and Studio access remain independent with Stripe ${stripeState}`, async t => {
    const voucher = { codes: [{ id: '1', code: 'fixture-voucher-code' }],
      signingSecret: 'fixture-voucher-signing-secret'.repeat(2), expiresAt: Date.now() + 86400000 };
    const access = await serve(t, createWorkshopAccessHandler({
      getSettings: () => voucher, consumeAttempt: async () => ({ allowed: true }),
    }));
    const invalid = await access.post({ code: 'wrong' }, { 'X-Forwarded-Proto': 'https' });
    assert.equal(invalid.status, 401); assert.match((await invalid.json()).error, /not valid/);
    const valid = await access.post({ code: voucher.codes[0].code }, { 'X-Forwarded-Proto': 'https' });
    assert.equal(valid.status, 200); assert.equal((await valid.json()).authorized, true);
    const cookie = valid.headers.get('set-cookie').split(';')[0];
    let paidCalls = 0;
    const studio = await serve(t, createStudioMessageHandler({
      allowanceIdentity: async () => null, // this fixture uses a non-limited voucher
      authorize: request => hasStudioAccess(request, {
        hasVoucher: r => hasWorkshopAccess(r, voucher),
        hasPaid: async () => { paidCalls++; throw new Error(`Stripe ${stripeState}`); },
      }),
    }));
    const response = await studio.get({ Cookie: cookie });
    assert.equal(response.status, 200); assert.equal((await response.json()).temporary, true);
    assert.equal(paidCalls, 0);
  });
}
