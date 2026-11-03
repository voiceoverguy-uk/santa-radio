import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';

const counts = page => page.locator('.message-name-count, .santa-studio-promotion__name-count');

async function open(page, { total = 9730, status = 200, headers = {}, path = '/' } = {}) {
  let requests = 0, searches = 0;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com/, route => route.abort());
  await page.route('**/api/santa-name-count', route => {
    requests++;
    return route.fulfill({ status, headers, json: status === 200 ? { total } : { error: 'Unavailable' } });
  });
  await page.route('**/api/santa-names', route => {
    searches++;
    return route.fulfill({ json: { records: [], warning: null } });
  });
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  // Development StrictMode probes effect cleanup with an aborted first request.
  await expect.poll(() => requests).toBeGreaterThanOrEqual(1);
  return { requests: () => requests, searches: () => searches };
}

for (const width of [320, 390, 1440]) {
  test(`shared real-total counter is available before signup and capped at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1100 });
    const network = await open(page);
    await expect(counts(page)).toHaveText(['9,680 names available', '9,680 names available']);
    await expect(page.locator('.santa-message-box .message-recording-indicator')).toHaveText('Recording');
    await expect(page.locator('.santa-studio-promotion .message-recording-indicator')).toHaveText('Recording');
    expect(network.searches()).toBe(0);
    await page.clock.runFor(4999);
    await expect(counts(page)).toHaveText(['9,680 names available', '9,680 names available']);
    await page.clock.runFor(1);
    await expect(counts(page)).toHaveText(['9,681 names available', '9,681 names available']);
    // React must commit each timeout before the next five-second interval.
    for (let index = 0; index < 49; index++) await page.clock.runFor(5000);
    await expect(counts(page)).toHaveText(['9,730 names available', '9,730 names available']);
    await page.clock.runFor(20000);
    await expect(counts(page)).toHaveText(['9,730 names available', '9,730 names available']);
    expect(network.requests()).toBeLessThanOrEqual(2);
    expect(network.searches()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync('generated-artifacts', { recursive: true });
    await page.locator('.santa-message-box').screenshot({
      path: `generated-artifacts/recorded-name-counter-${width}.jpg`, animations: 'disabled',
    });
  });
}

test('small and zero totals stay non-negative, including on the standalone maker', async ({ page }) => {
  await open(page, { total: 2, path: '/free-santa-message' });
  await expect(counts(page)).toHaveText(['0 names available', '0 names available']);
  await page.clock.runFor(5000);
  await expect(counts(page)).toHaveText(['1 name available', '1 name available']);
  await page.clock.runFor(5000);
  await expect(counts(page)).toHaveText(['2 names available', '2 names available']);
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 0 } }));
  await page.reload();
  await expect(counts(page)).toHaveText(['0 names available', '0 names available']);
});

test('initial failures and malformed totals retain the honest fallback', async ({ page }) => {
  await open(page, { status: 503 });
  await expect(counts(page)).toHaveText(Array(2).fill('Recorded names available to search'));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: '9730' } }));
  await page.reload();
  await expect(counts(page)).toHaveText(Array(2).fill('Recorded names available to search'));
  await expect(page.locator('.santa-message-box .message-recording-indicator')).toHaveCount(0);
});

for (const path of ['/', '/free-santa-message']) {
  test(`a failed count recovers automatically within seconds without a page reload on ${path}`, async ({ page }) => {
    const network = await open(page, { status: 503, path });
    await page.clock.runFor(50);
    await expect(counts(page)).toHaveText(Array(2).fill('Recorded names available to search'));
    const failedCalls = network.requests();
    await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 9774 } }));
    await page.clock.runFor(4000);
    expect(network.requests()).toBe(failedCalls);
    await page.clock.runFor(1000);
    await expect(counts(page)).toHaveText(Array(2).fill('9,724 names available'));
    await page.clock.runFor(5000);
    await expect(counts(page)).toHaveText(Array(2).fill('9,725 names available'));
    expect(network.searches()).toBe(0);
  });
}

test('counter retry respects server rate-limit timing before recovering', async ({ page }) => {
  const network = await open(page, { status: 429, headers: { 'Retry-After': '120' } });
  await page.clock.runFor(50);
  const failedCalls = network.requests();
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 100 } }));
  await page.clock.runFor(119000);
  await expect(counts(page)).toHaveText(Array(2).fill('Recorded names available to search'));
  expect(network.requests()).toBe(failedCalls);
  await page.clock.runFor(1000);
  await expect(counts(page)).toHaveText(Array(2).fill('50 names available'));
});

test('refresh clamps a lower total, fails without a fake count, and resumes when visible', async ({ page }) => {
  const network = await open(page);
  await expect(counts(page)).toHaveText(Array(2).fill('9,680 names available'));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 12 } }));
  await page.clock.fastForward(300000);
  await expect(counts(page)).toHaveText(Array(2).fill('12 names available'));
  await page.route('**/api/santa-name-count', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.clock.fastForward(300000);
  await expect(counts(page)).toHaveText(Array(2).fill('Recorded names available to search'));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 100 } }));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(300000);
  await expect(counts(page)).toHaveText(Array(2).fill('Recorded names available to search'));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(counts(page)).toHaveText(Array(2).fill('50 names available'));
  expect(network.searches()).toBe(0);
});

test('selected-child wording and the shared counter survive failed and successful signup', async ({ page }) => {
  const network = await open(page);
  await page.route('**/api/santa-names', route => route.fulfill({ json: { warning: null, records: [{
    id: 'arabella', name: 'Arabella', selectionToken: 'controlled-counter-test-token',
    previewUrl: '/api/santa-name-preview?token=controlled-counter-test-token',
  }] } }));
  const checker = page.locator('.hero-name-checker');
  await checker.getByRole('combobox').fill('Arabella');
  await page.clock.runFor(250);
  await checker.getByRole('option', { name: 'Arabella', exact: true }).click();
  await checker.getByRole('button', { name: 'Create my free Santa message →' }).click();
  await expect(page.locator('#santa-messages .santa-message-access__intro')).toHaveText(
    'Add your details and access a free personalised downloadable message for Arabella from Santa.');
  await expect(counts(page)).toHaveText(Array(2).fill('9,680 names available'));
  await mockBrevo(page, { message: 'Controlled refusal' }, 503);
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.locator('.santa-message-access__error')).toBeVisible();
  await expect(counts(page)).toHaveText(Array(2).fill('9,680 names available'));
  await mockBrevo(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Arabella');
  await expect(counts(page)).toHaveText(Array(2).fill('9,680 names available'));
  await page.clock.runFor(5000);
  await expect(counts(page)).toHaveText(Array(2).fill('9,681 names available'));
  expect(network.requests()).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Arabella');
  await page.getByRole('link', { name: 'Apps', exact: true }).first().click();
  const calls = network.requests();
  await page.clock.runFor(600000);
  expect(network.requests()).toBe(calls);
});
