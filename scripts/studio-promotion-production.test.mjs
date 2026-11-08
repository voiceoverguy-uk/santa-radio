import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { render } from '../dist/server/entry-server.js';
import { workshopCatalogueFixture } from '../tests/fixtures/workshop-catalogue.js';

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

function assertHomepageJourney(html) {
  assert.doesNotMatch(html, /class="message-intro"|class="santa-message-box|class="santa-message-access /,
    'the homepage must not mount the free introduction or adult signup/maker');
  const start = html.indexOf('<div class="homepage-section-heading homepage-santa-studio__heading">');
  assert.ok(start >= 0, 'homepage premium section heading exists');
  const heading = html.slice(start, html.indexOf('<section id="santa-studio-promotion"'));
  const parts = ['A unique Christmas treat.', 'aria-hidden="true"', 'MESSAGE FROM SANTA',
    'OUR PREMIUM EXPERIENCE', 'Ask Santa for a bespoke message to your little one.'];
  let previous = -1;
  for (const part of parts) {
    const next = heading.indexOf(part);
    assert.ok(next > previous, `${part} is in the requested reading order`);
    previous = next;
  }
  let previousSection = -1;
  for (const marker of ['hero-name-preview__hero', 'homepage-santa-studio', 'id="santa-studio-promotion"',
    'class="santa-message-reviews', 'aria-label="Santa Tracker"', 'santa-dash-promo',
    'id="nice-list"', 'id="christmas-pairs"', 'class="soundboard"', 'id="homepage-mugshots"',
    'class="youtube-section', 'class="partnership-strip"', 'class="contact-section"']) {
    const index = html.indexOf(marker);
    assert.ok(index > previousSection, `${marker} stays in homepage order`);
    previousSection = index;
  }
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
    if (route.path === '/') {
      for (const html of [builtHtml, serverRender, servedHtml]) assertHomepageJourney(html);
    } else {
      assert.match(servedHtml, /class="message-intro"/, 'the dedicated free page retains its introduction');
      assert.doesNotMatch(servedHtml, /A unique Christmas treat\./, 'the premium heading is homepage-only');
    }

    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    });
    t.after(() => browser.close());
    const page = await browser.newPage();
    let checkoutReadinessRequests = 0;
    let liveReady = false;
    await page.route('**/api/santa-studio-checkout', route => {
      checkoutReadinessRequests++;
      if (route.request().method() === 'POST') return route.fulfill({ status: 503, json: { error: 'Controlled checkout refusal' } });
      return route.fulfill({ json: liveReady
        ? { available: true, mode: 'live', sandbox: false, amount: 650, currency: 'gbp' }
        : { available: true, sandbox: true } });
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
    assert.ok(checkoutReadinessRequests > 0, 'Public pages must check runtime readiness and reject sandbox availability');
    liveReady = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    const purchase = promotion.getByRole('button', { name: 'Purchase — £6.50', exact: true });
    await expect(purchase).toBeEnabled();
    await expect(promotion).toContainText('one child');
    await expect(promotion.locator('.santa-studio-promotion__launch-countdown-remaining')).toHaveCount(0);
    await purchase.click();
    await expect(promotion.getByRole('alert')).toHaveText('Controlled checkout refusal');
    await expect(promotion.getByLabel('Voucher code', { exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(purchase).toBeVisible();
    const box = await purchase.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 391, 'Mobile purchase stays within viewport');
    assert.doesNotMatch(await promotion.innerText(), sandboxPromotionCopy);
  });
}

test('production email fragments require an explicit redemption and open live Studio without sandbox notices', async t => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let authorized = false, redeemed = 0;
  const token = 'a'.repeat(43);
  await page.route('**/api/santa-workshop-access', route => route.fulfill({ json: { authorized: false } }));
  await page.route('**/api/santa-studio-access', route => route.fulfill({ json: { authorized, mode: 'live' } }));
  await page.route('**/api/santa-studio-checkout', route => route.fulfill({ status: 503, json: { available: false } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-studio-message', route => route.fulfill({ json: { temporary: true } }));
  await page.route('**/api/santa-studio-return', route => {
    assert.equal(route.request().method(), 'POST');
    assert.deepEqual(route.request().postDataJSON(), { token });
    authorized = true; redeemed++;
    return route.fulfill({ json: { authorized: true } });
  });
  await page.goto(`${origin}/santa-message-workshop#studio-return=${token}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(`${origin}/santa-message-workshop`);
  assert.equal(redeemed, 0, 'Visiting/scanning a link must not consume it');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.getByRole('button', { name: 'Open my Studio', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Tester code (required)', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Open my Studio', exact: true }).click();
  await expect(page.locator('.smw-builder')).toBeVisible();
  assert.equal(redeemed, 1);
  await expect(page.getByLabel('Sandbox test notice')).toHaveCount(0);
});

test('production payment outage never hides voucher controls or blocks a valid voucher', async t => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  let voucher = false;
  await page.route('**/api/santa-workshop-access', route => {
    if (route.request().method() === 'POST') {
      if (route.request().postDataJSON().code !== 'fixture-voucher') return route.fulfill({ status: 401, json: { error: 'That tester code is not valid. Please check it and try again.' } });
      voucher = true;
    }
    return route.fulfill({ json: { authorized: voucher, expiresAt: Date.now() + 3600000 } });
  });
  await page.route('**/api/santa-studio-access', route => route.fulfill({ status: 503, json: { authorized: false } }));
  await page.route('**/api/santa-studio-checkout', route => route.fulfill({ status: 503, json: { available: false } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-studio-message', route => route.fulfill({ json: { temporary: true } }));
  await page.goto(`${origin}/santa-message-workshop?checkout=return`, { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const code = page.getByLabel('Tester code (required)', { exact: true });
  await expect(code).toBeEnabled();
  await code.fill('wrong');
  await page.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  await expect(page.getByText('That tester code was not recognised. Please check it and try again.')).toBeVisible();
  await code.fill('fixture-voucher');
  await page.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  await expect(page.locator('.smw-builder')).toBeVisible();
});
