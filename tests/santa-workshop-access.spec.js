import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const accessURL = '/api/santa-workshop-access';
const codeLabel = /^(Voucher code|Tester code \(required\))$/;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await mockBrevo(page);
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-names?*', route => route.fulfill({
    json: {
      records: [{ id: 'demrie', name: 'Demrie', downloadName: 'santa-recorded-message-for-Demrie.mp3' }],
      hostedCount: new URL(route.request().url()).searchParams.get('inventory') === 'hosted' ? 1 : 9780,
      warning: null,
    },
  }));
});

async function visit(page, path) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const minimise = page.getByRole('button', { name: 'Minimise radio player', exact: true });
  if (await minimise.isVisible()) await minimise.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

test('mobile voucher entry and arrival lock document panning without locking vertical scroll or zoom', async ({ page }) => {
  let authorized = false;
  await page.route('**/api/santa-workshop-access', route => {
    if (route.request().method() === 'POST') authorized = true;
    return route.fulfill({
      status: authorized ? 200 : 401,
      json: { authorized, ...(authorized ? { expiresAt: Date.now() + 120000 } : {}) },
    });
  });
  await page.route('**/api/santa-studio-access', route => route.fulfill({ json: { authorized: false } }));
  await visit(page, '/santa-message-workshop');
  const voucher = page.getByLabel(codeLabel, { exact: true });
  await expect(voucher).toBeVisible();

  const expectStableDocument = async () => {
    for (const width of [320, 390, 430, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      const geometry = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        canScrollVertically: document.documentElement.scrollHeight > innerHeight,
        roots: [document.documentElement, document.body].map(node => {
          const style = getComputedStyle(node);
          return { overflowX: style.overflowX, overflowY: style.overflowY,
            overscrollX: style.overscrollBehaviorX, touch: style.touchAction,
            position: style.position };
        }),
        panels: [...document.querySelectorAll('.workshop-gate-card, .workshop-password-form, .workshop-password-form input, .smw-builder')]
          .map(node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })),
      }));
      expect(geometry.width).toBeLessThanOrEqual(width + 1);
      for (const root of geometry.roots) {
        expect(root.overflowX).toBe('clip');
        expect(root.overflowY).not.toMatch(/hidden|clip/);
        expect(root.overscrollX).toBe('none');
        expect(root.touch).toContain('pan-y');
        expect(root.touch).toContain('pinch-zoom');
        expect(root.position).not.toBe('fixed');
      }
      for (const panel of geometry.panels) {
        expect(panel.left).toBeGreaterThanOrEqual(-1);
        expect(panel.right).toBeLessThanOrEqual(width + 1);
      }
      await page.evaluate(() => window.scrollTo({ left: 150, top: 100, behavior: 'instant' }));
      expect(await page.evaluate(() => scrollX)).toBe(0);
      if (geometry.canScrollVertically) expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    }
  };

  await expectStableDocument();
  await page.setViewportSize({ width: 390, height: 844 });
  await voucher.fill('MOBILE-LAYOUT-TEST');
  await page.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  await expect(page.locator('.smw-builder')).toBeVisible();
  await expectStableDocument();
  const names = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await names.fill('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  expect(await names.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => scrollX)).toBe(0);
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('auto');
});

test('direct documents, navigation and reload stay locked, and the catalogue requires a server session', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const document = await page.request.get('/santa-message-workshop');
  const html = await document.text();
  expect(html).toContain('workshop-gate');
  expect(html).not.toContain('smw-builder');
  expect(document.headers()['cache-control']).toContain('no-store');
  expect(document.headers()['x-robots-tag']).toContain('noindex');
  // APIRequest bypasses browser fixtures: exercise the real server guard.
  const catalogue = await page.request.get('/api/santa-workshop-catalogue');
  expect(catalogue.status()).toBe(403);
  expect((await catalogue.json()).categories).toBeUndefined();
  const loads = [];
  page.on('request', request => {
    if (request.url().includes('santa-workshop-catalogue')) loads.push(request.url());
  });
  await visit(page, '/santa-message-workshop');
  await expect(page.getByLabel(codeLabel, { exact: true })).toBeVisible();
  await expect(page.getByLabel(codeLabel, { exact: true })).toHaveAttribute('placeholder', 'Enter a voucher code for early access');
  await expect(page.getByRole('button', { name: 'Create your bespoke message', exact: true })).toBeVisible();
  await expect(page.getByText('Enter your tester code to join the private friends test.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel(codeLabel, { exact: true })).toBeVisible();
  for (const size of [100, 200]) {
    await page.addStyleTag({ content: `html { font-size: ${size}%; }` });
    expect(await page.locator('.workshop-gate-card').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  expect(loads).toEqual([]);
});

for (const path of ['/', '/free-santa-message']) {
  test(`a real isolated tester code opens the Studio from ${path} and survives a refresh`, async ({ page }) => {
    const code = process.env.WORKSHOP_TEST_PASSWORD;
    expect(code).toBeTruthy();
    await visit(page, path);
    const form = page.locator('.santa-studio-promotion .workshop-password-form');
    await form.getByLabel(codeLabel, { exact: true }).fill(code);
    await form.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
    await expect(page).toHaveURL(/\/santa-message-workshop$/);
    await expect(page.getByRole('heading', { name: 'What name should Santa say?' })).toBeVisible();
    const cookie = (await page.context().cookies()).find(item => item.name === 'santa-workshop-preview');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(cookie.value).not.toContain(code);
    expect(await page.evaluate(value => JSON.stringify({ localStorage, sessionStorage, history: history.state, url: location.href }).includes(value), code)).toBe(false);
    await page.reload();
    await expect(page.locator('.smw-builder')).toBeVisible();
    await page.goto(path);
    await expect(page.locator('.santa-studio-promotion').getByLabel(codeLabel, { exact: true })).toHaveValue('');
  });
}

test('the completion card retains its voucher route into the authorized Studio', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('santa-message-access', 'granted'));
  await page.route('**/api/santa-workshop-access', route => route.fulfill({
    json: { authorized: true, expiresAt: Date.now() + 120000 },
  }));
  await page.route('**/api/santa-message', route => route.fulfill({
    contentType: 'audio/mpeg', body: Buffer.from('ID3-workshop-access-fixture'),
  }));
  await visit(page, '/free-santa-message');
  await page.getByLabel('First Name').fill('Demrie');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'To Demrie from Santa' })).toBeVisible();
  const promotion = page.locator('#santa-studio-promotion');
  await expect(promotion).toHaveCount(1);
  await promotion.getByLabel(codeLabel, { exact: true }).fill('COMPLETION-CARD-TEST-CODE');
  await promotion.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  await expect(page).toHaveURL(/\/santa-message-workshop$/);
  await expect(page.getByRole('heading', { name: 'What name should Santa say?' })).toBeVisible();
});

test('all five isolated codes are accepted by the real endpoint, not the former shared password', async ({ page }) => {
  const origin = new URL((await page.request.get(accessURL)).url()).origin;
  for (let slot = 1; slot <= 5; slot++) {
    const code = process.env[slot === 1 ? 'WORKSHOP_TEST_PASSWORD' : `WORKSHOP_TEST_CODE_${slot}`];
    expect(code).toBeTruthy();
    const response = await page.request.post(accessURL, { headers: { Origin: origin }, data: { code } });
    expect(response.status()).toBe(200);
    expect((await response.json()).authorized).toBe(true);
    expect((await (await page.request.get(accessURL)).json()).authorized).toBe(true);
  }
  const legacy = await page.request.post(accessURL, { headers: { Origin: origin }, data: { password: process.env.WORKSHOP_TEST_PASSWORD } });
  expect(legacy.status()).toBe(400);
});

test('empty, wrong, blocked, expired and unavailable code submissions stay closed with useful errors', async ({ page }) => {
  let calls = 0;
  let status = 401;
  await page.route(`**${accessURL}`, route => {
    calls++;
    return route.fulfill({ status, json: { authorized: false } });
  });
  await visit(page, '/');
  const form = page.locator('.santa-studio-promotion .workshop-password-form');
  const input = form.getByLabel(codeLabel, { exact: true });
  await form.getByRole('button').click();
  await expect(form.getByRole('alert')).toHaveText('Enter your tester code to continue.');
  await expect(input).toBeFocused();
  expect(calls).toBe(0);
  const messages = [
    [401, 'not recognised'], [403, 'cannot be used'], [429, 'Too many attempts'],
    [503, 'temporarily unavailable'], [410, 'test has ended'],
  ];
  for (const [nextStatus, message] of messages) {
    status = nextStatus;
    await input.fill('ISOLATED-UI-TEST');
    await input.press('Enter');
    await expect(form.getByRole('alert')).toContainText(message);
    await expect(form.getByRole('button')).toBeEnabled();
    await expect(page).not.toHaveURL(/\/santa-message-workshop$/);
  }
  expect(calls).toBe(messages.length);
});

test('a pending submission cannot be sent twice and can be retried after failure', async ({ page }) => {
  let pendingRoute;
  let calls = 0;
  await page.route(`**${accessURL}`, route => { pendingRoute = route; calls++; });
  await visit(page, '/');
  const form = page.locator('.santa-studio-promotion .workshop-password-form');
  await form.getByLabel(codeLabel).fill('ISOLATED-UI-TEST');
  await form.getByRole('button').click();
  await expect(form.getByRole('button')).toHaveText('Checking code…');
  await expect(form.getByLabel(codeLabel)).toBeDisabled();
  await form.evaluate(node => node.requestSubmit());
  expect(calls).toBe(1);
  await pendingRoute.fulfill({ status: 401, json: { authorized: false } });
  await expect(form.getByRole('alert')).toContainText('not recognised');
  await expect(form.getByLabel(codeLabel)).toBeEnabled();
});

test('a hung code check times out rather than leaving the form disabled', async ({ page }) => {
  await page.clock.install();
  await page.route(`**${accessURL}`, () => {});
  await visit(page, '/');
  const form = page.locator('.santa-studio-promotion .workshop-password-form');
  await form.getByLabel(codeLabel).fill('ISOLATED-UI-TEST');
  await form.getByRole('button').click();
  await expect(form.getByRole('button')).toBeDisabled();
  await page.clock.runFor(16000);
  await expect(form.getByRole('alert')).toContainText('too long');
  await expect(form.getByRole('button')).toBeEnabled();
});

for (const trigger of ['focus', 'interval', 'expiry', 'service failure']) {
  test(`an open Studio locks and unmounts on ${trigger}`, async ({ page }) => {
    await page.clock.install();
    let allowed = true;
    const expiresAt = Date.now() + (trigger === 'expiry' ? 45000 : 120000);
    await page.route(`**${accessURL}`, route => route.fulfill({
      status: !allowed && trigger === 'service failure' ? 503 : 200,
      json: allowed ? { authorized: true, expiresAt } : { authorized: false },
    }));
    await visit(page, '/santa-message-workshop');
    await expect(page.locator('.smw-builder')).toBeVisible();
    allowed = false;
    if (trigger === 'interval') await page.clock.runFor(61000);
    else if (trigger === 'expiry') await page.clock.runFor(46000);
    else await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.smw-builder')).toHaveCount(0);
    await expect(page.getByLabel(codeLabel, { exact: true })).toBeVisible();
    if (trigger === 'service failure') await expect(page.getByRole('button', { name: 'Retry access check' })).toBeVisible();
  });
}

for (const path of ['/', '/free-santa-message']) {
  for (const width of [320, 390, 1280]) {
    test(`Coming soon and required tester entry fit at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await visit(page, path);
      const promo = page.locator('.santa-studio-promotion');
      await expect(promo.getByRole('heading', { level: 3 })).toHaveText('Santa’s Message Maker Studio');
      await expect(promo.getByText('NEW', { exact: true })).toHaveCount(0);
      await expect(promo.locator('.santa-studio-promotion__eyebrow')).toHaveText('A little more magic');
      await expect(promo.locator('.santa-studio-promotion__preview-label')).toHaveText('Coming soon');
      const artwork = promo.getByRole('img', { name: 'Santa wearing headphones at a festive message-making microphone' });
      await expect(artwork).toBeVisible();
      expect(await artwork.evaluate(image => image.complete && image.naturalWidth === 256)).toBe(true);
      expect((await artwork.boundingBox()).width).toBeGreaterThanOrEqual(60);
      await expect(promo).not.toContainText('Have a voucher? You can enter it below.');
      await expect(promo.getByLabel('Voucher code', { exact: true })).toBeVisible();
      await expect(promo).not.toContainText('(optional)');
      const voucherSubmit = promo.getByRole('button', { name: 'Create your bespoke message', exact: true });
      const purchase = promo.getByRole('button', { name: /Purchase — £6.50 \(test\)|Checking test checkout/ });
      await expect(voucherSubmit).toBeVisible();
      await expect(purchase).toBeVisible();
      const submitBox = await voucherSubmit.boundingBox();
      const purchaseBox = await purchase.boundingBox();
      expect(purchaseBox.y).toBeGreaterThanOrEqual(submitBox.y + submitBox.height);
      await expect(promo.getByLabel(codeLabel, { exact: true })).toHaveAttribute('placeholder', 'Enter a voucher code for early access');
      await expect(promo.getByLabel(codeLabel, { exact: true })).toHaveAttribute('required', '');
      await expect(promo.locator('a[href="/santa-message-workshop"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Get my free Santa message', exact: true })).toBeEnabled();
      if (width === 1280) {
        await page.evaluate(() => document.fonts.ready);
        expect(await promo.evaluate(card => {
          const topline = card.querySelector('.santa-studio-promotion__topline').getBoundingClientRect();
          const heading = card.querySelector('h3').getBoundingClientRect();
          return heading.top - topline.bottom;
        })).toBeLessThanOrEqual(48);
        expect(await promo.getByRole('heading', { level: 3 }).evaluate(node => {
          const lineHeight = parseFloat(getComputedStyle(node).lineHeight);
          return node.getBoundingClientRect().height <= lineHeight * 3 + 1;
        })).toBe(true);
      }
      for (const size of [100, 200]) {
        await page.addStyleTag({ content: `html { font-size: ${size}%; }` });
        expect(await promo.locator('.santa-studio-promotion__preview').evaluate(group => {
          const label = group.querySelector('.santa-studio-promotion__preview-label').getBoundingClientRect();
          const image = group.querySelector('img').getBoundingClientRect();
          return label.right <= image.left && Math.abs((label.top + label.bottom) / 2 - (image.top + image.bottom) / 2) < (image.height + label.height) / 2 + 1;
        })).toBe(true);
        expect(await promo.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        // The promotion now has its own full-width row, outside the free form.
        expect(await promo.locator('.santa-studio-promotion__details').evaluate(node =>
          node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
      await page.addStyleTag({ content: 'html { font-size: 100%; }' });
      await promo.screenshot({
        path: `generated-artifacts/studio-tester-access/${path === '/' ? 'home' : 'maker'}-${width}.png`,
        animations: 'disabled',
        style: '.navbar, .radio-dock, .skip-link { visibility:hidden !important; }',
      });
    });
  }
}

test('free-greeting signup still opens its own maker without requiring a tester code', async ({ page }) => {
  await visit(page, '/');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page).toHaveURL(/\/free-santa-message$/);
  await expect(page.getByLabel('First Name', { exact: true })).toBeVisible();
  await expect(page.locator('.santa-studio-promotion').getByLabel(codeLabel)).toHaveValue('');
});
