import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';
import { getUncachableStripeClient } from '../server/stripeClient.js';
import { startSandboxCheckout } from '../server/santa-studio-checkout.js';
import { confirmSandboxPurchase, prepareSandboxPurchaseStore } from '../server/santa-studio-purchase.js';

if (!process.argv.includes('--run-sandbox-payments')) {
  console.error('Pass --run-sandbox-payments to authorise an actual hosted Stripe test-mode payment.');
  process.exit(1);
}
let database, browser, stripe, sessionId, stage = 'sandbox-mode';
try {
  // Never reads a live Stripe key or connects to the project database.
  stripe = await getUncachableStripeClient();
  assert.equal((await stripe.balance.retrieve()).livemode, false);
  database = await studioTestDatabase();
  const pool = database.pool;
  await prepareSandboxPurchaseStore(pool);
  const claim = randomBytes(32).toString('base64url');
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  stage = 'create-and-reuse';
  const results = await Promise.all([1, 2, 3].map(() => startSandboxCheckout({ claim, origin, stripe, pool })));
  assert.equal(new Set(results.map(r => r.sessionId)).size, 1);
  sessionId = results[0].sessionId;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  assert.equal(session.livemode, false); assert.equal(session.amount_total, 650); assert.equal(session.currency, 'gbp');
  assert.deepEqual(await confirmSandboxPurchase({ sessionId, claimToken: claim, stripe, pool }), { authorized: false });
  stage = 'hosted-test-payment';
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#email').fill('studio-sandbox@example.invalid', { timeout: 30000 });
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('1230');
  await page.locator('#cardCvc').fill('123');
  await page.locator('#billingName').fill('Santa Studio Sandbox Test');
  const country = page.locator('#billingCountry');
  if (await country.count()) await country.selectOption('GB');
  const postcode = page.locator('#billingPostalCode');
  if (await postcode.isVisible()) await postcode.fill('SW1A 1AA');
  await page.locator('button[type="submit"]').click();
  let paid;
  for (let retry = 0; retry < 40; retry++) {
    paid = await stripe.checkout.sessions.retrieve(sessionId);
    if (paid.status === 'complete' && paid.payment_status === 'paid') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(paid.livemode, false); assert.equal(paid.payment_status, 'paid'); assert.equal(paid.status, 'complete');
  stage = 'verify-and-repeat';
  assert.deepEqual(await confirmSandboxPurchase({ sessionId, claimToken: randomBytes(32).toString('base64url'), stripe, pool }), { authorized: false });
  const access = await confirmSandboxPurchase({ sessionId, claimToken: claim, stripe, pool });
  assert.equal(access.authorized, true);
  assert.equal((await startSandboxCheckout({ claim, origin, stripe, pool })).openStudio, true);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM public.santa_studio_sandbox_access')).rows[0].count, 1);
  console.log(JSON.stringify({ passed: true, mode: 'sandbox', isolatedDatabase: true,
    actualHostedPayment: true, amount: 650, currency: 'gbp', concurrentCheckoutReused: true,
    unpaidAndWrongClaimDenied: true, verifiedAccessAndRepeatIdempotent: true }));
} catch {
  console.error(JSON.stringify({ passed: false, mode: 'sandbox', isolatedDatabase: true, stage }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (stripe && sessionId) {
    try {
      const open = await stripe.checkout.sessions.retrieve(sessionId);
      if (open.livemode === false && open.status === 'open') await stripe.checkout.sessions.expire(sessionId);
    } catch { /* Do not print provider response or affect unrelated sessions. */ }
  }
  await database?.close();
}
