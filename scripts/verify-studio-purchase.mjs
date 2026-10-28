import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { databasePool } from '../server/name-request-store.js';
import { getUncachableStripeClient } from '../server/stripeClient.js';
import { STUDIO_PAID_COOKIE } from '../server/santa-studio-purchase.js';

if (!process.argv.includes('--run-sandbox-payments')) process.exit(1);
let browser;
let stage = 'open-purchase';
const report = {};
try {
  const stripe = await getUncachableStripeClient();
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Decline optional cookies' }).click();
  const purchase = () => page.getByRole('button', { name: 'Purchase — £6.50 (test)' });
  await purchase().click();
  stage = 'purchase-redirect';
  await page.waitForURL('https://checkout.stripe.com/**');
  stage = 'private-browser-cookie';
  const paidCookie = (await context.cookies(base)).find(cookie => cookie.name === STUDIO_PAID_COOKIE);
  // The preview proxy rewrites SameSite=Lax to None for iframe compatibility.
  // Unit checks assert the server's Lax header; here require HttpOnly + Secure.
  assert.ok(paidCookie?.httpOnly && paidCookie?.secure);
  const sessionId = paidCookie.value.split('.')[0];
  stage = 'created-session-details';
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  assert.equal(session.livemode, false); assert.equal(session.amount_total, 650);
  assert.equal((await (await context.request.get(`${base}/api/santa-studio-access`)).json()).authorized, false);
  stage = 'concurrent-starts-and-cancel';
  const requests = await Promise.all([1, 2, 3].map(() => context.request.post(`${base}/api/santa-studio-checkout`, {
    headers: { Origin: base }, data: {},
  })));
  for (const response of requests) { assert.equal(response.status(), 200); assert.equal((await response.json()).url, session.url); }
  await page.goto(session.cancel_url, { waitUntil: 'domcontentloaded' });
  await page.getByText('Test checkout was cancelled.', { exact: false }).waitFor();
  assert.equal((await (await context.request.get(`${base}/api/santa-studio-access`)).json()).authorized, false);
  report.concurrentStartsReuseSessionAndCancelStaysLocked = true;
  stage = 'spoofed-return';
  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await outsiderPage.goto(`${base}/santa-message-workshop?checkout=return&paid=true&session_id=${sessionId}`);
  await outsiderPage.getByText('A successful sandbox payment has not been confirmed.', { exact: false }).waitFor();
  assert.equal(await outsiderPage.locator('.smw-builder').count(), 0);
  assert.equal((await outsider.request.get(`${base}/api/santa-workshop-catalogue`)).status(), 403);
  await outsider.close();
  report.spoofedReturnAndUnpaidCatalogueDenied = true;

  stage = 'complete-hosted-test-payment';
  await purchase().click();
  await page.waitForURL('https://checkout.stripe.com/**');
  await page.locator('#email').fill('sandbox-browser-check@example.com');
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('1230');
  await page.locator('#cardCvc').fill('123');
  await page.locator('#billingName').fill('Sandbox Browser Check');
  if (await page.locator('#billingCountry').count()) await page.locator('#billingCountry').selectOption('GB');
  if (await page.locator('#billingPostalCode').isVisible()) await page.locator('#billingPostalCode').fill('SW1A 1AA');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${base}/santa-message-workshop?checkout=return`, { timeout: 60000 });
  await page.getByText('Sandbox test payment confirmed', { exact: false }).waitFor({ timeout: 30000 });
  await page.locator('.smw-builder').waitFor();
  const catalogue = await context.request.get(`${base}/api/santa-workshop-catalogue`);
  assert.equal(catalogue.status(), 200);
  assert.ok((await catalogue.json()).categories);
  assert.equal((await page.evaluate(() => document.cookie)).includes(STUDIO_PAID_COOKIE), false);
  report.purchaseButtonCheckoutReturnAndProtectedChoicesWork = true;

  stage = 'reload-and-repeat';
  await page.reload();
  await page.getByText('Sandbox test payment confirmed', { exact: false }).waitFor({ timeout: 30000 });
  const repeat = await context.request.post(`${base}/api/santa-studio-checkout`, { headers: { Origin: base }, data: {} });
  assert.equal((await repeat.json()).openStudio, true);
  const rows = await databasePool().query('SELECT count(*)::int AS count FROM public.santa_studio_sandbox_access WHERE checkout_session_id=$1', [sessionId]);
  assert.equal(rows.rows[0].count, 1);
  report.reloadAndRepeatKeepOneEntitlement = true;
  console.log(JSON.stringify({ passed: true, ...report }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passed: false, stage, errorType: error.name,
    assertionActual: typeof error.actual === 'number' || typeof error.actual === 'boolean' ? error.actual : undefined,
    ...report }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await databasePool().end();
}
