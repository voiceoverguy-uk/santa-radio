import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { render } from '../dist/server/entry-server.js';

// Run after npm run build, with the development workflow running.
// No Stripe writes or payments: the checkout POST is intercepted.
const forbidden = /Purchase — £6\.50 \(test\)|Sandbox purchases are available in the development preview only|Checking test checkout|4242 4242/;
const markup = render('/?studioCheckout=cancelled').markup;
assert.doesNotMatch(markup, forbidden);
assert.match(markup, /Coming soon/);
assert.doesNotMatch(await readFile('dist/index.html', 'utf8'), forbidden);

const server = await preview({ preview: { host: '127.0.0.1', port: 5117, strictPort: true } });
const browser = await chromium.launch({
  executablePath: existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined,
  args: ['--no-sandbox'],
});
try {
  const publicPage = await browser.newPage();
  let publicCheckoutRequests = 0;
  await publicPage.route('**/api/santa-studio-checkout', route => {
    publicCheckoutRequests++;
    return route.fulfill({ json: { available: true, sandbox: true } });
  });
  await publicPage.goto('http://127.0.0.1:5117/?studioCheckout=cancelled');
  const publicPromotion = publicPage.locator('#santa-studio-promotion');
  await expect(publicPromotion.getByText('Coming soon', { exact: true })).toBeVisible();
  await expect(publicPromotion.locator('input')).toBeVisible();
  await expect(publicPromotion.locator('.santa-studio-promotion__purchase')).toHaveCount(0);
  await expect(publicPage.locator('#studio-purchase-note')).toHaveCount(0);
  assert.doesNotMatch(await publicPromotion.innerText(), /sandbox|test checkout/i);
  assert.equal(publicCheckoutRequests, 0, 'Production must not even probe sandbox readiness');

  const dev = await browser.newPage();
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  // Use real development readiness; only intercept the write to avoid a purchase.
  let checkoutPosts = 0;
  await dev.route('**/api/santa-studio-checkout', route => {
    if (route.request().method() !== 'POST') return route.continue();
    checkoutPosts++;
    assert.deepEqual(route.request().postDataJSON(), {});
    return route.fulfill({ status: 503, json: { error: 'Display verification: checkout POST reached.' } });
  });
  await dev.goto(`${base}/?studioCheckout=cancelled`);
  const decline = dev.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  const purchase = dev.getByRole('button', { name: 'Purchase — £6.50 (test)', exact: true });
  await expect(purchase).toBeEnabled({ timeout: 30000 });
  await expect(dev.locator('#studio-purchase-note')).toContainText('Sandbox only — no real money moves.');
  await expect(dev.getByText('Test checkout was cancelled.', { exact: false })).toBeVisible();
  await expect(dev.locator('#santa-studio-promotion input')).toBeVisible();
  await purchase.click();
  await expect(dev.getByRole('alert').filter({ hasText: 'Display verification' })).toBeVisible();
  assert.equal(checkoutPosts, 1);
  console.log('PASS: production SSR/static/hydrated rendering hides all sandbox controls; Coming soon and voucher form remain. Development readiness, test label, cancellation and checkout POST work.');
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
