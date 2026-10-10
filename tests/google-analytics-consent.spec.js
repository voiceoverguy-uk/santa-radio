import { test, expect } from '@playwright/test';

const key = 'santaradio-cookie-consent-v2';
const legacyKey = 'santaradio-marketing-consent-v1';
const id = 'G-FGL2HBXZ92';
const analytics = page => page.getByRole('checkbox', { name: /Analytics cookies/ });
const marketing = page => page.getByRole('checkbox', { name: /Marketing cookies/ });
const save = page => page.getByRole('button', { name: 'Save choices', exact: true });
const settings = page => page.getByRole('button', { name: 'Cookie settings', exact: true });
const views = page => page.evaluate(() => (window.dataLayer || [])
  .map(args => Array.from(args)).filter(args => args[0] === 'event' && args[1] === 'page_view'));
const metaViews = page => page.evaluate(() => (window.__metaCalls || [])
  .filter(args => args[0] === 'trackSingle' && args[2] === 'PageView'));

async function mockTrackers(page) {
  const requests = { google: [], meta: [], beacons: [] };
  await page.route('https://www.googletagmanager.com/gtag/**', route => {
    requests.google.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await page.route('https://connect.facebook.net/**', route => {
    requests.meta.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: `
      window.__metaCalls = [];
      const pixel = window.fbq;
      pixel.callMethod = (...args) => window.__metaCalls.push(args);
      for (const args of pixel.queue) pixel.callMethod(...args);
      pixel.queue = [];
    ` });
  });
  await page.route(/https:\/\/([^/]*google-analytics\.com\/|www\.facebook\.com\/tr)/, route => {
    requests.beacons.push(route.request().url());
    return route.abort();
  });
  return requests;
}

test('neither optional tracker loads before choosing or after rejecting, including reload', async ({ page }) => {
  const requests = await mockTrackers(page);
  await page.goto('/privacy-policy');
  await expect(analytics(page)).not.toBeChecked();
  await expect(marketing(page)).not.toBeChecked();
  expect(requests).toEqual({ google: [], meta: [], beacons: [] });
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  await page.reload();
  await expect(save(page)).toHaveCount(0);
  expect(requests).toEqual({ google: [], meta: [], beacons: [] });
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
});

test('analytics only loads one head tag, records the right property, and survives reload', async ({ page }) => {
  const requests = await mockTrackers(page);
  await page.goto('/privacy-policy');
  await analytics(page).check();
  // Ticking a box is not consent until saved.
  expect(requests.google).toHaveLength(0);
  await save(page).click();
  await expect.poll(() => views(page)).toHaveLength(1);
  expect(requests.google).toEqual([`https://www.googletagmanager.com/gtag/js?id=${id}`]);
  expect(requests.meta).toHaveLength(0);
  await expect(page.locator('head #santaradio-google-analytics')).toHaveCount(1);
  const config = await page.evaluate(() => Array.from(window.dataLayer.find(args => args[0] === 'config')));
  expect(config[1]).toBe(id);
  expect(config[2]).toMatchObject({ send_page_view: false, allow_google_signals: false,
    allow_ad_personalization_signals: false, cookie_expires: 15552000, cookie_update: false });
  const defaults = await page.evaluate(() => Array.from(window.dataLayer[0]));
  expect(defaults).toEqual(['consent', 'default', { analytics_storage: 'denied',
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  expect((await views(page))[0][2].send_to).toBe(id);
  await settings(page).click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  expect(await views(page)).toHaveLength(1);
  await page.reload();
  await expect.poll(() => views(page)).toHaveLength(1);
  expect(requests.google).toHaveLength(2);
  expect(requests.meta).toHaveLength(0);
});

test('marketing only never loads Google', async ({ page }) => {
  const requests = await mockTrackers(page);
  await page.goto('/privacy-policy');
  await marketing(page).check();
  await save(page).click();
  await expect.poll(() => metaViews(page)).toHaveLength(1);
  expect(requests.google).toHaveLength(0);
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
  await page.reload();
  await expect.poll(() => metaViews(page)).toHaveLength(1);
  expect(requests.google).toHaveLength(0);
});

test('accept all enables both; SPA links and browser back add one manual page view each', async ({ page }) => {
  const requests = await mockTrackers(page);
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect.poll(() => views(page)).toHaveLength(1);
  await expect.poll(() => metaViews(page)).toHaveLength(1);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  await expect.poll(() => views(page)).toHaveLength(2);
  expect((await views(page))[1][2].page_location).toMatch(/\/apps$/);
  expect((await views(page))[1][2].page_referrer).toMatch(/\/privacy-policy$/);
  await page.goBack();
  await expect.poll(() => views(page)).toHaveLength(3);
  await expect.poll(() => metaViews(page)).toHaveLength(3);
  expect(requests.google).toHaveLength(1);
  expect(requests.meta).toHaveLength(1);
});

test('withdrawing analytics disables collection and removes GA cookies without rejecting Meta', async ({ page, context }) => {
  const requests = await mockTrackers(page);
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect.poll(() => views(page)).toHaveLength(1);
  await page.evaluate(() => {
    document.cookie = '_ga=test; Path=/';
    document.cookie = '_ga_FGL2HBXZ92=test; Path=/';
  });
  await settings(page).click();
  await analytics(page).uncheck();
  await save(page).click();
  expect(await page.evaluate(id => window[`ga-disable-${id}`], id)).toBe(true);
  expect((await context.cookies()).filter(cookie => cookie.name.startsWith('_ga'))).toHaveLength(0);
  const last = await page.evaluate(() => Array.from(window.dataLayer.at(-1)));
  expect(last).toEqual(['consent', 'update', { analytics_storage: 'denied',
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await views(page)).toHaveLength(1);
  await expect.poll(() => metaViews(page)).toHaveLength(2);
  await settings(page).click();
  await analytics(page).check();
  await save(page).click();
  await expect.poll(() => views(page)).toHaveLength(2);
  expect(await page.evaluate(id => window[`ga-disable-${id}`], id)).toBe(false);
  expect(requests.google).toHaveLength(1);
});

test('withdrawing marketing keeps analytics working', async ({ page }) => {
  await mockTrackers(page);
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect.poll(() => metaViews(page)).toHaveLength(1);
  await settings(page).click();
  await marketing(page).uncheck();
  await save(page).click();
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  await expect.poll(() => views(page)).toHaveLength(2);
  expect(await metaViews(page)).toHaveLength(1);
});

test('old Meta acceptance does not silently grant analytics permission', async ({ page }) => {
  const requests = await mockTrackers(page);
  await page.addInitScript(key => localStorage.setItem(key,
    JSON.stringify({ version: 1, choice: 'accepted', savedAt: Date.now() })), legacyKey);
  await page.goto('/privacy-policy');
  await expect(marketing(page)).toBeChecked();
  await expect(analytics(page)).not.toBeChecked();
  await expect.poll(() => metaViews(page)).toHaveLength(1);
  expect(requests.google).toHaveLength(0);
  await expect(page.getByText('Your earlier Meta choice is kept.', { exact: false })).toBeVisible();
  await save(page).click();
  await expect(save(page)).toHaveCount(0);
  expect(requests.google).toHaveLength(0);
});

test('expired or malformed new choices cannot revive old Meta acceptance', async ({ page }) => {
  const requests = await mockTrackers(page);
  await page.addInitScript(({ key, legacyKey }) => {
    localStorage.setItem(legacyKey, JSON.stringify({ version: 1, choice: 'accepted', savedAt: Date.now() }));
    localStorage.setItem(key, JSON.stringify({ version: 2, analytics: true,
      marketing: true, savedAt: Date.now() - 181 * 86400000 }));
  }, { key, legacyKey });
  await page.goto('/privacy-policy');
  await expect(save(page)).toBeVisible();
  expect(requests).toEqual({ google: [], meta: [], beacons: [] });
  await page.evaluate(key => localStorage.setItem(key, 'bad-json'), key);
  await page.reload();
  await expect(analytics(page)).not.toBeChecked();
  await expect(marketing(page)).not.toBeChecked();
  expect(requests).toEqual({ google: [], meta: [], beacons: [] });
});

test('another tab changing choices stops analytics in the original tab', async ({ page, context }) => {
  await mockTrackers(page);
  await page.goto('/privacy-policy');
  await analytics(page).check();
  await save(page).click();
  await expect.poll(() => views(page)).toHaveLength(1);
  const second = await context.newPage();
  await mockTrackers(second);
  await second.goto('/privacy-policy');
  await settings(second).click();
  await analytics(second).uncheck();
  await save(second).click();
  await expect.poll(() => page.evaluate(id => window[`ga-disable-${id}`], id)).toBe(true);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await views(page)).toHaveLength(1);
});

test('page view payloads exclude query strings and fragments', async ({ page }) => {
  await mockTrackers(page);
  await page.goto('/privacy-policy?email=should-not-be-tracked@example.test#private');
  await analytics(page).check();
  await save(page).click();
  await expect.poll(() => views(page)).toHaveLength(1);
  const payload = (await views(page))[0][2];
  expect(payload.page_location).toMatch(/\/privacy-policy$/);
  expect(JSON.stringify(payload)).not.toContain('should-not-be-tracked');
  expect(JSON.stringify(payload)).not.toContain('#private');
});

test('blocked storage warns that the saved selections apply only to the visit', async ({ page }) => {
  await mockTrackers(page);
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Blocked'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Blocked'); } });
  });
  await page.goto('/privacy-policy');
  await analytics(page).check();
  await save(page).click();
  await expect.poll(() => views(page)).toHaveLength(1);
  await expect(page.getByText('Your choice applies to this visit.', { exact: false })).toBeVisible();
});
