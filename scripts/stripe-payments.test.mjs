import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import Stripe from 'stripe';
import { sandboxCredentials, requireSandboxWorkspace } from '../server/stripeClient.js';
import { createStripeWebhookHandler } from '../server/stripe-webhook.js';
import { paidFamilySession, claimHash, confirmSandboxPurchase, createStudioPaidAccessHandler,
  STUDIO_TEST_PRICE, STUDIO_TEST_PRODUCT, STUDIO_PAID_COOKIE } from '../server/santa-studio-purchase.js';
import { STUDIO_OFFER } from '../server/stripe-sandbox.js';

test('native and legacy credential field names work; live, missing and ambiguous connections fail', () => {
  for (const field of ['secret', 'secret_key']) {
    const value = sandboxCredentials({ items: [{ connector_name: 'stripe', settings: { [field]: 'sk_test_fixture' } }] });
    assert.equal(value.secretKey, 'sk_test_fixture');
  }
  for (const data of [{}, { items: [] },
    { items: [{ connector_name: 'stripe', settings: { secret: 'sk_live_fixture' } }] },
    { items: [{ connector_name: 'stripe', settings: {} }] },
    { items: [{ connector_name: 'stripe' }, { connector_name: 'stripe' }] },
    { items: [{ connector_name: 'stripe', disabled: true }] }]) assert.throws(() => sandboxCredentials(data));
  for (const env of [{}, { REPL_IDENTITY: 'fixture', VERCEL: '1' },
    { REPL_IDENTITY: 'fixture', REPLIT_DEPLOYMENT: '1' }]) assert.throws(() => requireSandboxWorkspace(env));
});

const claim = randomBytes(32).toString('base64url');
const sessionId = 'cs_test_fixture';
function paidSession() {
  return {
    id: sessionId, livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid',
    amount_total: 650, currency: 'gbp',
    metadata: { offer: STUDIO_OFFER, access_claim_sha256: claimHash(claim) },
    payment_intent: { id: 'pi_fixture', livemode: false, status: 'succeeded',
      amount: 650, amount_received: 650, currency: 'gbp' },
    line_items: { has_more: false, data: [{ quantity: 1, amount_subtotal: 650, amount_total: 650,
      price: { id: STUDIO_TEST_PRICE, product: STUDIO_TEST_PRODUCT, livemode: false,
        unit_amount: 650, currency: 'gbp', type: 'one_time' } }] },
  };
}

test('paid access requires the correct private claim as well as Stripe payment proof', () => {
  assert.equal(paidFamilySession(paidSession(), claim), true);
  assert.equal(paidFamilySession(paidSession(), randomBytes(32).toString('base64url')), false);
  assert.equal(paidFamilySession(paidSession(), ''), false);
});

const denials = [
  ['unpaid', s => { s.payment_status = 'unpaid'; }],
  ['pending', s => { s.payment_intent.status = 'processing'; }],
  ['failed', s => { s.payment_intent.status = 'requires_payment_method'; }],
  ['cancelled', s => { s.payment_intent.status = 'canceled'; }],
  ['expired checkout', s => { s.status = 'expired'; }],
  ['open checkout', s => { s.status = 'open'; }],
  ['no-payment-required', s => { s.payment_status = 'no_payment_required'; }],
  ['live checkout', s => { s.livemode = true; }],
  ['live payment', s => { s.payment_intent.livemode = true; }],
  ['wrong amount', s => { s.amount_total = 1; }],
  ['wrong payment amount', s => { s.payment_intent.amount_received = 1; }],
  ['wrong currency', s => { s.currency = 'usd'; }],
  ['wrong price', s => { s.line_items.data[0].price.id = 'price_other'; }],
  ['wrong product', s => { s.line_items.data[0].price.product = 'prod_other'; }],
  ['subscription', s => { s.mode = 'subscription'; }],
  ['recurring price', s => { s.line_items.data[0].price.recurring = { interval: 'month' }; }],
  ['extra items', s => { s.line_items.data.push(s.line_items.data[0]); }],
  ['wrong quantity', s => { s.line_items.data[0].quantity = 2; }],
  ['hidden additional items', s => { s.line_items.has_more = true; }],
  ['missing items', s => { delete s.line_items; }],
  ['missing payment', s => { s.payment_intent = null; }],
  ['wrong offer', s => { s.metadata.offer = 'other'; }],
  ['missing claim hash', s => { delete s.metadata.access_claim_sha256; }],
];
for (const [label, change] of denials) test(`${label} does not create an entitlement`, async () => {
  const session = paidSession();
  change(session);
  const result = await confirmSandboxPurchase({ sessionId, claimToken: claim,
    stripe: { checkout: { sessions: { async retrieve() { return session; } } } },
    pool: { query() { throw new Error('Unpaid or invalid sessions must not touch the access store'); } },
  });
  assert.deepEqual(result, { authorized: false });
});

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('raw webhook rejects missing, forged, stale and tampered signatures; valid signatures reach processing', async t => {
  const secret = randomBytes(32).toString('hex');
  let processed = 0;
  const url = await serve(t, createStripeWebhookHandler({ getSync: async () => ({
    async processWebhook(body, signature) {
      assert.ok(Buffer.isBuffer(body));
      Stripe.webhooks.constructEvent(body, signature, secret);
      processed++;
    },
  }) }));
  const body = JSON.stringify({ id: 'evt_fixture', object: 'event', livemode: false, type: 'checkout.session.completed' });
  const sign = (payload, timestamp) => Stripe.webhooks.generateTestHeaderString({ payload, secret, ...(timestamp ? { timestamp } : {}) });
  const send = (payload, signature) => fetch(url, { method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', ...(signature ? { 'stripe-signature': signature } : {}) } });
  assert.equal((await send(body)).status, 400);
  assert.equal((await send(body, 't=1,v1=forged')).status, 400);
  assert.equal((await send(body, sign(body, Math.floor(Date.now() / 1000) - 600))).status, 400);
  assert.equal((await send(`${body} `, sign(body))).status, 400);
  const live = body.replace('"livemode":false', '"livemode":true');
  assert.equal((await send(live, sign(live))).status, 400);
  assert.equal(processed, 0);
  assert.equal((await send(body, sign(body))).status, 200);
  assert.equal(processed, 1);
});

test('public access endpoint ignores success redirects, missing, malformed and duplicate cookies', async t => {
  let calls = 0;
  const url = await serve(t, createStudioPaidAccessHandler({
    getStripe: async () => { calls++; return {}; },
    confirm: async () => ({ authorized: true }),
  }));
  for (const cookie of ['', `${STUDIO_PAID_COOKIE}=paid`, `${STUDIO_PAID_COOKIE}=cs_live_x.${claim}`,
    `${STUDIO_PAID_COOKIE}=${sessionId}.${claim}; ${STUDIO_PAID_COOKIE}=${sessionId}.${claim}`]) {
    const response = await fetch(`${url}?success=true&paid=true&session_id=${sessionId}`,
      { headers: { cookie } });
    assert.deepEqual(await response.json(), { authorized: false });
  }
  assert.equal(calls, 0);
  const valid = await fetch(url, { headers: { cookie: `${STUDIO_PAID_COOKIE}=${sessionId}.${claim}` } });
  assert.deepEqual(await valid.json(), { authorized: true });
  assert.equal(calls, 1);
});

test('payment-check failure denies access rather than using a stored success', async t => {
  const url = await serve(t, createStudioPaidAccessHandler({
    getStripe: async () => { throw new Error('unavailable'); },
  }));
  const response = await fetch(url, { headers: { cookie: `${STUDIO_PAID_COOKIE}=${sessionId}.${claim}` } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).authorized, false);
});
