import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { render } from '../dist/server/entry-server.js';

const routes = [
  { path: '/', html: 'dist/index.html' },
  { path: '/free-santa-message', html: 'dist/free-santa-message/index.html' },
];
const stalePromotionCopy = /Black Friday|£4\.50/i;
const sandboxPromotionCopy = /sandbox|test checkout|Purchase — £6\.50 \(test\)|Checking test checkout|4242 4242/i;
let child;
let origin;

function promotionMarkup(html, description) {
  const promotion = html.match(/<section\b(?=[^>]*\bid="santa-studio-promotion")[\s\S]*?<\/section>/)?.[0];
  assert.ok(promotion, `${description} must contain the Studio promotion`);
  assert.match(promotion, /class="santa-studio-promotion__offer-label">Price<\/span>/);
  assert.match(promotion, /class="santa-studio-promotion__offer-price">£6\.50<\/span>/);
  assert.doesNotMatch(promotion, stalePromotionCopy, `${description} must not contain stale visible or accessible promotion copy`);
  assert.match(promotion, /<label\b[^>]*>Voucher code<\/label>/, `${description} must retain voucher access`);
  assert.match(promotion, /Create your bespoke message/, `${description} must retain the voucher submit control`);
  assert.doesNotMatch(promotion, /santa-studio-promotion__purchase|studio-purchase-note|Sandbox purchases are available/i,
    `${description} must not contain sandbox purchase controls`);
  return promotion;
}

before(async () => {
  child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Production server did not start'));
    }, 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Production server exited before becoming ready: ${code}`));
    });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    child.stderr.on('data', data => process.stderr.write(data));
  });
});

after(async () => {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
});

for (const route of routes) {
  test(`production Studio promotion is neutral and voucher-accessible on ${route.path}`, async t => {
    const builtHtml = await readFile(route.html, 'utf8');
    promotionMarkup(builtHtml, `Generated public HTML for ${route.path}`);

    const serverRender = render(route.path).markup;
    promotionMarkup(serverRender, `Production React render for ${route.path}`);

    const response = await fetch(`${origin}${route.path}`);
    assert.equal(response.status, 200);
    const servedHtml = await response.text();
    promotionMarkup(servedHtml, `Production server response for ${route.path}`);

    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    });
    t.after(() => browser.close());
    const page = await browser.newPage();
    let checkoutReadinessRequests = 0;
    await page.route('**/api/santa-studio-checkout', route => {
      checkoutReadinessRequests++;
      return route.fulfill({ json: { available: true, sandbox: true } });
    });
    await page.goto(`${origin}${route.path}`, { waitUntil: 'domcontentloaded' });

    const promotion = page.locator('#santa-studio-promotion');
    await expect(promotion).toBeVisible();
    const visibleCopy = await promotion.innerText();
    assert.match(visibleCopy, /Price\s*£6\.50/);
    assert.doesNotMatch(visibleCopy, stalePromotionCopy);

    const accessibleCopy = await promotion.ariaSnapshot();
    assert.match(accessibleCopy, /Price £6\.50/);
    assert.doesNotMatch(accessibleCopy, stalePromotionCopy);
    const accessibleAttributes = await promotion.evaluate(root =>
      [root, ...root.querySelectorAll('[aria-label], [title], [alt]')]
        .flatMap(element => ['aria-label', 'title', 'alt'].map(attribute => element.getAttribute(attribute) || ''))
        .join('\n'));
    assert.doesNotMatch(accessibleAttributes, stalePromotionCopy);

    await expect(promotion.getByLabel('Voucher code', { exact: true })).toBeVisible();
    await expect(promotion.getByRole('button', { name: 'Create your bespoke message', exact: true })).toBeVisible();
    await expect(promotion.locator('.santa-studio-promotion__purchase, #studio-purchase-note')).toHaveCount(0);
    assert.doesNotMatch(visibleCopy, sandboxPromotionCopy);
    assert.doesNotMatch(accessibleCopy, sandboxPromotionCopy);
    assert.equal(checkoutReadinessRequests, 0, 'Public pages must not probe sandbox checkout readiness');
  });
}
