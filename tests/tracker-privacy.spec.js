import { test, expect } from '@playwright/test';
import { isTrackingRequest } from '../src/privacy/trackerPrivacy.js';
import { readFile, stat } from 'node:fs/promises';
import { TRACKER_URL } from '../src/tracker/lib/trackerBrand.js';

const consentKey = 'santaradio-cookie-consent-v2';
const accepted = { version: 2, analytics: true, marketing: true, media: true, savedAt: Date.now() };
const settle = page => page.evaluate(() => new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function observe(page) {
  const requests = [];
  page.on('request', request => {
    if (isTrackingRequest(request.url())) requests.push(request.url());
  });
  await page.route('https://www.googletagmanager.com/gtag/**', route =>
    route.fulfill({ contentType: 'application/javascript', body: `
      const original = window.gtag;
      const send = args => {
        if (args[0] === 'event' && !window['ga-disable-G-FGL2HBXZ92']) {
          fetch('https://www.google-analytics.com/g/collect?en=' + args[1]).catch(() => {});
        }
      };
      window.gtag = (...args) => { original(...args); send(args); };
      for (const args of window.dataLayer) send(args);
    ` }));
  await page.route('https://connect.facebook.net/**', route =>
    route.fulfill({ contentType: 'application/javascript', body: `
      const pixel = window.fbq;
      let granted = false;
      pixel.callMethod = (...args) => {
        if (args[0] === 'consent') granted = args[1] === 'grant';
        if (args[0] === 'trackSingle' && granted) {
          fetch('https://www.facebook.com/tr/?ev=' + args[2]).catch(() => {});
        }
      };
      for (const args of pixel.queue) pixel.callMethod(...args);
      pixel.queue = [];
    ` }));
  await page.route(/https:\/\/(?:www\.google-analytics\.com|www\.facebook\.com\/tr)/, route =>
    route.fulfill({ status: 204, body: '' }));
  return requests;
}

for (const path of ['/santa-tracker', '/santa-tracker/preview', '/santa-tracker/nested/test']) {
  for (const saved of [false, true]) {
    test(`${path}: tracking stays off with ${saved ? 'saved acceptance and reload' : 'fresh consent then accept all'}`, async ({ page }) => {
      if (saved) await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
        { key: consentKey, value: accepted });
      const requests = await observe(page);
      await page.goto(path);
      if (!saved) await page.getByRole('button', { name: 'Accept all', exact: true }).click();
      await settle(page);
      await expect(page.locator('#santaradio-google-analytics, #santaradio-meta-pixel')).toHaveCount(0);
      expect(await page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(true);
      await page.reload();
      await settle(page);
      expect(requests).toEqual([]);
      if (saved) expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).analytics, consentKey)).toBe(true);
    });
  }
}

test('unmarked tracker remains tracking-free with Android-like blocked storage and changing choices', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, {
      get() { throw new DOMException('Storage disabled', 'SecurityError'); },
    });
  });
  const requests = await observe(page);
  await page.goto('/santa-tracker');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect(page.getByText('Your choice applies to this visit.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  const settings = page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true });
  await settings.focus();
  await settings.press('Enter');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await settle(page);
  expect(requests).toEqual([]);
  await expect(page.locator('.santa-tracker')).toBeVisible();
  await expect(page.locator('audio').first()).toHaveAttribute('src', 'https://global.citrus3.com:8164/');
});

test('entering tracker stops existing tags, late network transports and custom events; leaving restores ordinary consent', async ({ page }) => {
  const requests = await observe(page);
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect.poll(() => requests.some(url => url.includes('/g/collect'))).toBe(true);
  await expect.poll(() => requests.some(url => url.includes('facebook.com/tr'))).toBe(true);
  await page.evaluate(() => { window.__originalRadio = document.querySelector('audio'); });
  await page.locator('.navbar').getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page).toHaveURL(/\/santa-tracker$/);
  await settle(page);
  const count = requests.length;
  await page.evaluate(async () => {
    const url = 'https://www.google-analytics.com/g/collect?en=late_event';
    await fetch(url);
    navigator.sendBeacon(url, 'late');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.send('late');
    new Image().src = 'https://www.facebook.com/tr/?ev=late';
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/fbevents.js?late';
    document.head.append(script);
    const image = document.createElement('img');
    image.setAttribute('src', 'https://www.facebook.com/tr/?ev=attribute');
    document.body.append(image);
    await fetch('https://www.googleadservices.com/pagead/conversion/test');
    await fetch('https://www.hotjar.com/late');
    await fetch('/_vercel/insights/event');
    const analytics = await import('/src/privacy/googleAnalytics.js');
    const marketing = await import('/src/privacy/marketingConsent.js');
    analytics.trackAnalyticsPageView('/apps');
    analytics.trackAnalyticsEvent('tracker_custom_event', {});
    marketing.trackPageView('/apps');
  });
  await settle(page);
  expect(requests).toHaveLength(count);
  expect(await page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(true);
  expect(await page.evaluate(() => window.__originalRadio === document.querySelector('audio'))).toBe(true);
  await page.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(count);
  expect(await page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/\/santa-tracker$/);
  await settle(page);
  const backCount = requests.length;
  await page.evaluate(() => fetch('https://www.google-analytics.com/g/collect?en=back'));
  await settle(page);
  expect(requests).toHaveLength(backCount);
});

test('slow-loading tags from a different route cannot replay grants or events on the tracker', async ({ page }) => {
  const requests = await observe(page);
  const delayed = [];
  await page.route(/https:\/\/(?:www\.googletagmanager\.com\/gtag|connect\.facebook\.net)/, route => {
    delayed.push(route);
  });
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect.poll(() => delayed.length).toBe(2);
  await page.locator('.navbar').getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page).toHaveURL(/\/santa-tracker$/);
  await settle(page);
  const count = requests.length;
  for (const route of delayed) await route.fallback();
  await settle(page);
  expect(requests).toHaveLength(count);
  const queue = await page.evaluate(() => ({
    google: (window.dataLayer || []).filter(args => args[0] === 'event'),
    meta: (window.fbq?.queue || []).filter(args => args[0] === 'trackSingle' || (args[0] === 'consent' && args[1] === 'grant')),
  }));
  expect(queue).toEqual({ google: [], meta: [] });
});

test('tracker privacy transitions retain the playing radio, volume and single audio element', async ({ page }) => {
  await observe(page);
  await page.addInitScript(() => {
    window.playCalls = 0;
    window.pauseCalls = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { window.pauseCalls++; };
    HTMLMediaElement.prototype.play = function () {
      window.playCalls++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await page.locator('.navbar').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await page.getByRole('slider', { name: 'Radio volume' }).fill('0.25');
  await page.evaluate(() => { window.originalAudio = document.querySelector('audio'); });
  await page.locator('.navbar').getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Track Santa/);
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => ({
    same: window.originalAudio === document.querySelector('audio'),
    volume: document.querySelector('audio').volume,
    plays: window.playCalls, pauses: window.pauseCalls,
  }))).toEqual({ same: true, volume: 0.25, plays: 1, pauses: 0 });
});

test('tracking-free tracker still downloads a PNG postcard when embedded sharing is blocked', async ({ page }) => {
  test.setTimeout(60000);
  const requests = await observe(page);
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async data => {
      window.sharedTrackerURL = data.url;
      throw new DOMException('Sharing blocked by embedded preview', 'NotAllowedError');
    }, configurable: true });
  });
  await page.goto('/santa-tracker');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  const minimise = page.getByRole('button', { name: 'Minimise radio player' });
  if (await minimise.isVisible()) await minimise.click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share this postcard' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('santa-postcard.png');
  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(10000);
  expect((await readFile(path)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(await page.evaluate(() => window.sharedTrackerURL)).toBe(TRACKER_URL);
  expect(requests).toEqual([]);
});
