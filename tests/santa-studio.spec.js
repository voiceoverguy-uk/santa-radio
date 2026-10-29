import { test, expect } from '@playwright/test';
import { mockBrevo, fillAccessForm } from './helpers/message-access.js';

async function visit(page, path) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

test.beforeEach(async ({ page }) => {
  await mockBrevo(page, { success: false });
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('mobile Studio promotion title fits and certificates belong only to the upcoming paid offer', async ({ page }) => {
  await page.route('**/api/santa-names?*', route => route.fulfill({
    json: { records: [], hostedCount: 9775, warning: null },
  }));
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/free-santa-message');
    await page.evaluate(() => document.fonts.ready);
    const heading = page.locator('#santa-studio-title');
    await expect(heading).toHaveText('Santa’s Message Maker Studio');
    const lines = await heading.evaluate(node => {
      const second = node.querySelector('span');
      const range = document.createRange();
      range.selectNodeContents(second);
      return { display: getComputedStyle(second).display, height: range.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(second).lineHeight), width: node.scrollWidth, available: node.clientWidth };
    });
    expect(lines.display).toBe(width < 768 ? 'block' : 'inline');
    expect(lines.height).toBeLessThanOrEqual(lines.lineHeight + 3);
    expect(lines.width).toBeLessThanOrEqual(lines.available + 1);
    const promotion = page.locator('.santa-studio-promotion');
    await expect(promotion).toContainText('When the Studio launches');
    await expect(promotion).toContainText('The paid Studio offer will include a personalised Nice List certificate as a gift.');
    await expect(promotion).not.toContainText(/basic free greeting|includes one too/i);
    await expect(promotion.getByText('Coming soon', { exact: true })).toBeVisible();
  }
});

test('unavailable sandbox purchase stays below the voucher submit and cannot open the Studio', async ({ page }) => {
  let accessRequests = 0;
  await page.route('**/api/santa-studio-checkout', route => route.fulfill({
    json: { available: false, sandbox: true },
  }));
  await page.route('**/api/santa-workshop-access', route => {
    accessRequests++;
    return route.fulfill({ status: 401, json: { authorized: false } });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await visit(page, '/free-santa-message');
  const promotion = page.locator('.santa-studio-promotion');
  const submit = promotion.getByRole('button', { name: 'Create your bespoke message', exact: true });
  const purchase = promotion.getByRole('button', { name: 'Purchase — £6.50 (test)', exact: true });
  await expect(purchase).toBeVisible();
  const submitBox = await submit.boundingBox(), purchaseBox = await purchase.boundingBox();
  expect(purchaseBox.y).toBeGreaterThanOrEqual(submitBox.y + submitBox.height);
  expect(purchaseBox.width).toBeGreaterThanOrEqual(submitBox.width - 1);
  expect(await purchase.evaluate(node => node.form)).toBeNull();
  await expect(purchase).toBeDisabled();
  await expect(purchase).toHaveCSS('min-height', '44px');
  await expect(page).toHaveURL(/\/free-santa-message$/);
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  expect(accessRequests).toBe(0);
});

for (const path of ['/', '/free-santa-message']) {
  test(`both counters handle loading, failure, retry, singular and count-up consistently on ${path}`, async ({ page }) => {
    await page.clock.install();
    let mode = 'hold', release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/santa-names?*', async route => {
      expect(new URL(route.request().url()).searchParams.get('q')).toBe('');
      if (mode === 'hold') await gate;
      if (mode === 'error') return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      return route.fulfill({ json: { records: [], hostedCount: mode === 'one' ? 1 : 12345, warning: null } });
    });
    await visit(page, path);
    const counter = page.locator('.message-name-count');
    const inline = page.locator('.message-intro-name-count');
    for (const locator of [counter, inline]) await expect(locator).toHaveText('Checking how many names are available…');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    mode = 'error';
    release();
    for (const locator of [counter, inline]) await expect(locator).toHaveText('Name total temporarily unavailable.');
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeEnabled();
    mode = 'one';
    await page.getByRole('button', { name: 'Retry name total' }).click();
    for (const locator of [counter, inline]) await expect(locator).toHaveText('0 names available');
    await page.clock.runFor(5000);
    for (const locator of [counter, inline]) await expect(locator).toHaveText('1 name available');
    await page.clock.runFor(5000);
    for (const locator of [counter, inline]) await expect(locator).toHaveText('1 name available');
    mode = 'many';
    await page.reload();
    for (const locator of [counter, inline]) await expect(locator).toHaveText('12,295 names available');
    await page.clock.runFor(5000);
    for (const locator of [counter, inline]) await expect(locator).toHaveText('12,296 names available');
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });
}

test('empty-query inventory is reused when access unlocks in place', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/santa-names?*', route => {
    requests++;
    return route.fulfill({ json: { records: [], hostedCount: 9775, warning: null } });
  });
  await mockBrevo(page);
  await visit(page, '/free-santa-message');
  await expect(page.locator('.message-name-count')).toHaveText('9,725 names available');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect(page.locator('.message-intro-name-count')).toHaveText('9,725 names available');
  expect(requests).toBe(1);
});
