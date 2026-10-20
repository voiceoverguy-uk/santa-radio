import { test, expect } from '@playwright/test';

const key = 'santaradio-marketing-consent-v1';
const pixelId = '2258928314674162';

async function mockPixel(page) {
  const requests = [];
  await page.route('https://www.googletagmanager.com/gtag/**', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route(/https:\/\/[^/]*google-analytics\.com\//, route => route.abort());
  await page.route('https://connect.facebook.net/**', async route => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: 'application/javascript', body: `
      window.__metaCalls = window.__metaCalls || [];
      const pixel = window.fbq;
      pixel.callMethod = function(...args) { window.__metaCalls.push(args); };
      for (const args of pixel.queue) pixel.callMethod(...args);
      pixel.queue = [];
    ` });
  });
  await page.route('https://www.facebook.com/tr**', route => route.abort());
  return requests;
}

const views = page => page.evaluate(() => (window.__metaCalls || [])
  .filter(args => args[0] === 'trackSingle' && args[2] === 'PageView'));
const accept = page => page.getByRole('button', { name: 'Accept all', exact: true });
const reject = page => page.getByRole('button', { name: 'Decline optional cookies', exact: true });
const settings = page => page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true });

test('no Meta request, script, beacon or events before consent, including navigation', async ({ page }) => {
  const requests = await mockPixel(page);
  await page.goto('/privacy-policy');
  await expect(accept(page)).toBeVisible();
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
  await expect(page.locator('#santaradio-meta-pixel')).toHaveCount(0);
  await expect(page.locator('img[src*="facebook.com/tr"]')).toHaveCount(0);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  await expect(accept(page)).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('accept loads once, sends the correct pixel PageView and tracks SPA navigation once', async ({ page }) => {
  const requests = await mockPixel(page);
  await page.goto('/privacy-policy');
  await accept(page).click();
  await expect.poll(() => views(page)).toEqual([['trackSingle', pixelId, 'PageView']]);
  expect(requests).toHaveLength(1);
  expect(await page.evaluate(() => window.__metaCalls.filter(args => args[0] === 'init')))
    .toEqual([['init', pixelId]]);
  expect(await page.evaluate(() => window.__metaCalls.filter(args => args[0] === 'set')))
    .toEqual([['set', 'autoConfig', false, pixelId]]);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  await expect.poll(async () => (await views(page)).length).toBe(2);
  await settings(page).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  expect((await views(page)).length).toBe(2);
  await page.reload();
  await expect.poll(async () => (await views(page)).length).toBe(1);
  await expect(accept(page)).toHaveCount(0);
  expect(requests).toHaveLength(2);
});

test('reject persists through navigation and reload without loading Meta', async ({ page }) => {
  const requests = await mockPixel(page);
  await page.goto('/privacy-policy');
  await reject(page).click();
  await page.reload();
  await expect(accept(page)).toHaveCount(0);
  expect(requests).toHaveLength(0);
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
  await settings(page).click();
  await expect(page.getByRole('checkbox', { name: /Marketing cookies/ })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Save choices', exact: true })).toBeVisible();
});

test('withdrawal revokes consent, removes Meta cookies and stops further PageViews', async ({ page, context }) => {
  const requests = await mockPixel(page);
  await page.goto('/privacy-policy');
  await accept(page).click();
  await expect.poll(async () => (await views(page)).length).toBe(1);
  await page.evaluate(() => { document.cookie = '_fbp=test; Path=/'; document.cookie = '_fbc=test; Path=/'; });
  await settings(page).click();
  await reject(page).click();
  expect(await page.evaluate(() => window.__metaCalls.at(-1))).toEqual(['consent', 'revoke']);
  expect((await context.cookies()).filter(cookie => ['_fbp', '_fbc'].includes(cookie.name))).toHaveLength(0);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect((await views(page)).length).toBe(1);
  await page.reload();
  expect(requests).toHaveLength(1);
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
});

test('expired and malformed choices require fresh consent', async ({ page }) => {
  const requests = await mockPixel(page);
  await page.addInitScript(({ key }) => localStorage.setItem(key,
    JSON.stringify({ version: 1, choice: 'accepted', savedAt: Date.now() - 181 * 86400000 })), { key });
  await page.goto('/privacy-policy');
  await expect(accept(page)).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.evaluate(({ key }) => window.dispatchEvent(new StorageEvent('storage',
    { key, newValue: 'bad-json' })), { key });
  await expect(accept(page)).toBeVisible();
});

test('blocked storage fails closed and gives an explicit save warning', async ({ page }) => {
  const requests = await mockPixel(page);
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Blocked'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Blocked'); } });
  });
  await page.goto('/privacy-policy');
  await expect(accept(page)).toBeVisible();
  expect(requests).toHaveLength(0);
  await reject(page).click();
  await expect(page.getByText('Your choice applies to this visit.', { exact: false })).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('rejecting in another tab stops tracking in an already accepted tab', async ({ page, context }) => {
  await mockPixel(page);
  await page.goto('/privacy-policy');
  await accept(page).click();
  await expect.poll(async () => (await views(page)).length).toBe(1);
  const second = await context.newPage();
  await mockPixel(second);
  await second.goto('/privacy-policy');
  await settings(second).click();
  await reject(second).click();
  await expect.poll(() => page.evaluate(() => window.__metaCalls.at(-1)))
    .toEqual(['consent', 'revoke']);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect((await views(page)).length).toBe(1);
});

for (const width of [320, 390, 1280]) {
  test(`consent choices are visible and equally prominent at ${width}px`, async ({ page }) => {
    await mockPixel(page);
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/privacy-policy');
    await expect(accept(page)).toBeVisible();
    await expect(reject(page)).toBeVisible();
    const dimensions = await page.locator('.marketing-consent').evaluate(node => {
      const box = node.getBoundingClientRect();
      const buttons = [...node.querySelectorAll('button')].map(button => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, background: getComputedStyle(button).backgroundColor };
      });
      return { left: box.left, right: box.right, top: box.top, buttons };
    });
    expect(dimensions.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.right).toBeLessThanOrEqual(width);
    expect(dimensions.top).toBeGreaterThanOrEqual(0);
    for (const button of dimensions.buttons) expect(button.bottom).toBeLessThanOrEqual(720);
    expect(dimensions.buttons[0].background).toBe(dimensions.buttons[1].background);
  });
}
