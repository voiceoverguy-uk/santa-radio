// Explicit integration check: creates test-mode Checkout sessions only.
// It does not wire the site's Purchase button or create a real-money charge.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import Stripe from 'stripe';
import { getUncachableStripeClient } from '../server/stripeClient.js';
import { databasePool } from '../server/name-request-store.js';
import { claimHash, confirmSandboxPurchase, STUDIO_TEST_PRICE, STUDIO_TEST_PRODUCT,
  STUDIO_PAID_COOKIE } from '../server/santa-studio-purchase.js';
import { STUDIO_OFFER } from '../server/stripe-sandbox.js';

if (!process.argv.includes('--run-sandbox-payments')) {
  console.error('Pass --run-sandbox-payments to create and pay test-mode Checkout sessions.');
  process.exit(1);
}
const report = {};
let browser;
let stage = 'sandbox-mode';
try {
  const stripe = await getUncachableStripeClient();
  const price = await stripe.prices.retrieve(STUDIO_TEST_PRICE);
  assert.equal(price.product, STUDIO_TEST_PRODUCT);
  assert.equal(price.unit_amount, 650);
  assert.equal(price.currency, 'gbp');
  assert.equal(price.type, 'one_time');
  assert.equal(price.livemode, false);
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const pool = databasePool();
  const claim = randomBytes(32).toString('base64url');
  const createSession = () => stripe.checkout.sessions.create({
    mode: 'payment', payment_method_types: ['card'],
    line_items: [{ price: STUDIO_TEST_PRICE, quantity: 1 }],
    success_url: `${base}/?stripe-sandbox-check=success`,
    cancel_url: `${base}/?stripe-sandbox-check=cancelled`,
    metadata: { offer: STUDIO_OFFER, access_claim_sha256: claimHash(claim), purpose: 'sandbox-integration-check' },
  });
  stage = 'unpaid-and-expired-access';
  const session = await createSession();
  assert.equal(session.livemode, false);
  const check = (sessionId = session.id, claimToken = claim) =>
    confirmSandboxPurchase({ sessionId, claimToken, stripe, pool });
  assert.deepEqual(await check(), { authorized: false });
  const expired = await createSession();
  await stripe.checkout.sessions.expire(expired.id);
  assert.deepEqual(await check(expired.id), { authorized: false });
  report.actualUnpaidAndExpiredDenied = true;

  stage = 'hosted-test-checkout';
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'], headless: true,
  });
  const page = await browser.newPage();
  await page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#email').fill('sandbox-check@example.com', { timeout: 30000 });
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('1230');
  await page.locator('#cardCvc').fill('123');
  await page.locator('#billingName').fill('Sandbox Payment Check');
  const country = page.locator('#billingCountry');
  if (await country.count()) await country.selectOption('GB');
  const postcode = page.locator('#billingPostalCode');
  if (await postcode.isVisible()) await postcode.fill('SW1A 1AA');
  await page.locator('button[type="submit"]').click();
  let paid;
  for (let attempt = 0; attempt < 30; attempt++) {
    paid = await stripe.checkout.sessions.retrieve(session.id);
    if (paid.status === 'complete' && paid.payment_status === 'paid') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(paid.status, 'complete');
  assert.equal(paid.payment_status, 'paid');
  assert.equal(paid.livemode, false);
  report.hostedCheckoutTestPaymentPaid = true;
  await browser.close();
  browser = undefined;

  stage = 'automatic-stripe-notification';
  let synced = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const rows = await pool.query(`SELECT 1 FROM stripe.checkout_sessions
      WHERE id=$1 AND payment_status='paid'`, [session.id]);
    if (rows.rowCount === 1) { synced = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(synced, true, 'Stripe-delivered notification was not synced');
  report.automaticStripeNotificationSynced = true;

  stage = 'signed-replays-and-tampering';
  const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 100 });
  const event = events.data.find(item => item.data.object.id === session.id);
  assert.ok(event);
  const hooks = await pool.query('SELECT secret FROM stripe._managed_webhooks WHERE url=$1', [`${base}/api/stripe/webhook`]);
  assert.equal(hooks.rowCount, 1);
  const secret = hooks.rows[0].secret;
  const body = JSON.stringify(event);
  const signature = () => Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  const post = (payload, sig) => fetch(`${base}/api/stripe/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': sig }, body: payload,
  });
  assert.equal((await post(`${body} `, signature())).status, 400);
  assert.equal((await post(body, 't=1,v1=forged')).status, 400);
  const replays = await Promise.all([post(body, signature()), post(body, signature()), post(body, signature())]);
  assert.deepEqual(replays.map(r => r.status), [200, 200, 200]);
  const counts = await pool.query('SELECT count(*)::int AS count FROM stripe.checkout_sessions WHERE id=$1', [session.id]);
  assert.equal(counts.rows[0].count, 1);
  report.threeSignedReplaysOneSyncedSession = true;
  report.actualWebhookTamperingAndForgeryRejected = true;

  stage = 'private-claim-and-durable-access';
  assert.deepEqual(await check(session.id, randomBytes(32).toString('base64url')), { authorized: false });
  // A paid event alone must not have created a bearer entitlement.
  const before = await pool.query('SELECT count(*)::int AS count FROM public.santa_studio_sandbox_access WHERE checkout_session_id=$1', [session.id]);
  assert.equal(before.rows[0].count, 0);
  const grants = await Promise.all([check(), check(), check(), check()]);
  assert.equal(grants.filter(value => value.newlyGranted === true).length, 1);
  assert.ok(grants.every(value => value.authorized === true));
  const after = await pool.query('SELECT count(*)::int AS count FROM public.santa_studio_sandbox_access WHERE checkout_session_id=$1', [session.id]);
  assert.equal(after.rows[0].count, 1);
  report.fourConcurrentClaimsOneEntitlement = true;
  const endpoint = `${base}/api/santa-studio-access`;
  assert.equal((await (await fetch(`${endpoint}?paid=true&session_id=${session.id}`)).json()).authorized, false);
  const headers = { cookie: `${STUDIO_PAID_COOKIE}=${session.id}.${claim}` };
  assert.equal((await (await fetch(endpoint, { headers })).json()).authorized, true);
  const wrong = { cookie: `${STUDIO_PAID_COOKIE}=${session.id}.${randomBytes(32).toString('base64url')}` };
  assert.equal((await (await fetch(endpoint, { headers: wrong })).json()).authorized, false);
  report.actualHttpAccessCorrectClaimOnly = true;
  console.log(JSON.stringify({ passed: true, ...report }, null, 2));
} catch {
  // Do not print upstream errors, session URLs, signatures, cookies or secrets.
  console.error(JSON.stringify({ passed: false, stage, ...report }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await databasePool().end();
}
