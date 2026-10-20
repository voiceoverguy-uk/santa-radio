import { test, expect } from '@playwright/test';
import { mockBrevo } from './helpers/message-access.js';

const key = 'santaradio-cookie-consent-v2';
const region = page => page.locator('.marketing-consent');
const footerSettings = page => page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true });
const decline = page => region(page).getByRole('button', { name: 'Decline optional cookies', exact: true });
const save = page => region(page).getByRole('button', { name: 'Save choices', exact: true });
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

test.beforeEach(async ({ context }) => {
  // Cover every tab and fail closed: these checks must never submit real forms.
  await context.route(/https:\/\/[^/]*sibforms\.com\//, route => route.fulfill({
    json: { success: false, message: 'Test only: no contact created.' },
  }));
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

async function isolateProviders(page) {
  const requests = [];
  await page.route(/https:\/\/(?:www\.googletagmanager\.com\/gtag\/|[^/]*google-analytics\.com\/|connect\.facebook\.net\/|www\.facebook\.com\/tr|www\.youtube\.com\/embed\/|tunein\.com\/embed\/)/, route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: route.request().resourceType() === 'document' ? 'text/html' : 'application/javascript', body: '' });
  });
  return requests;
}

test('compact first layer has equal one-click choices, optional settings, and player clearance', async ({ page }) => {
  await isolateProviders(page);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(region(page).getByRole('heading')).toHaveText('A quick word about cookies');
    await page.evaluate(() => document.fonts.ready);
    await expect(region(page).getByRole('checkbox')).toHaveCount(0);
    await expect(save(page)).toHaveCount(0);
    await expect(region(page).getByRole('link', { name: 'Privacy Policy', exact: true })).toBeVisible();
    await expect(region(page).getByRole('button', { name: 'Cookie settings', exact: true })).toBeVisible();
    const accept = region(page).getByRole('button', { name: 'Accept all', exact: true });
    const no = decline(page);
    const [a, b, box, dock] = await Promise.all([
      accept.boundingBox(), no.boundingBox(), region(page).boundingBox(), page.locator('.radio-dock').boundingBox(),
    ]);
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(a.width).toBeCloseTo(b.width, 0);
    expect(a.height).toBeCloseTo(b.height, 0);
    expect(await accept.evaluate(el => getComputedStyle(el).backgroundColor))
      .toBe(await no.evaluate(el => getComputedStyle(el).backgroundColor));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await region(page).screenshot({ path: test.info().outputPath(`cookie-banner-${width}.png`) });
  }
});

for (const accept of [true, false]) {
  test(`${accept ? 'accept' : 'decline'} completes once and persists equally across navigation and reload`, async ({ page }) => {
    await isolateProviders(page);
    await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
    await region(page).getByRole('button', { name: accept ? 'Accept all' : 'Decline optional cookies', exact: true }).click();
    await expect(region(page)).toHaveCount(0);
    const record = await stored(page);
    expect(record).toMatchObject({ version: 2, analytics: accept, marketing: accept, media: accept });
    await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
    await expect(region(page)).toHaveCount(0);
    await expect(footerSettings(page)).toHaveCount(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(region(page)).toHaveCount(0);
    expect(await stored(page)).toEqual(record);
  });
}

for (const analytics of [false, true]) {
  for (const marketing of [false, true]) {
    for (const media of [false, true]) {
      test(`independent choices: analytics=${analytics}, marketing=${marketing}, media=${media}`, async ({ page }) => {
        await isolateProviders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await region(page).getByRole('button', { name: 'Cookie settings', exact: true }).click();
        for (const [name, enabled] of [[/Analytics cookies/, analytics], [/Marketing cookies/, marketing], [/External media/, media]]) {
          const checkbox = region(page).getByRole('checkbox', { name });
          await expect(checkbox).not.toBeChecked();
          await checkbox.setChecked(enabled);
        }
        // Changing a draft must not contact providers.
        await expect(page.locator('#santaradio-google-analytics, #santaradio-meta-pixel, iframe')).toHaveCount(0);
        await save(page).click();
        await expect(region(page)).toHaveCount(0);
        expect(await stored(page)).toMatchObject({ analytics, marketing, media });
        await expect(page.locator('#santaradio-google-analytics')).toHaveCount(analytics ? 1 : 0);
        await expect(page.locator('#santaradio-meta-pixel')).toHaveCount(marketing ? 1 : 0);
        await expect(page.locator('iframe[src*="youtube.com"]')).toHaveCount(media ? 1 : 0);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(region(page)).toHaveCount(0);
        await expect(page.locator('iframe[src*="youtube.com"]')).toHaveCount(media ? 1 : 0);
      });
    }
  }
}

test('existing valid preferences keep their timestamp and never imply media permission', async ({ page }) => {
  await isolateProviders(page);
  const savedAt = Date.now() - 30 * 86400000;
  await page.addInitScript(({ key, savedAt }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      version: 2, analytics: true, marketing: false, savedAt,
    }));
  }, { key, savedAt });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#santaradio-google-analytics')).toHaveCount(1);
  await expect(region(page)).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect((await stored(page)).savedAt).toBe(savedAt);
  await footerSettings(page).click();
  await expect(region(page).getByRole('checkbox', { name: /Analytics cookies/ })).toBeChecked();
  await expect(region(page).getByRole('checkbox', { name: /External media/ })).not.toBeChecked();
  await region(page).getByRole('button', { name: 'Close settings' }).click();
  expect((await stored(page)).savedAt).toBe(savedAt);
});

test('media is opt-in on home, song, karaoke and TuneIn, and withdrawal unloads it across tabs', async ({ page, context }) => {
  test.setTimeout(60000);
  const requests = await isolateProviders(page);
  for (const path of ['/', '/christmas-artist/60-chris-rea-driving-home-for-christmas',
    '/christmas-karaoke-lyrics/60-chris-rea-driving-home-for-christmas', '/links']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('.external-media-placeholder')).toHaveCount(1);
  }
  expect(requests).toHaveLength(0);
  await decline(page).click();
  await page.locator('.external-media-placeholder').getByRole('button', { name: 'Enable external media' }).click();
  await expect(page.locator('iframe[src*="tunein.com/embed"]')).toHaveCount(1);
  expect(await stored(page)).toMatchObject({ analytics: false, marketing: false, media: true });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('iframe[src*="youtube.com"]')).toHaveCount(1);
  const second = await context.newPage();
  await isolateProviders(second);
  await second.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  await second.locator('.cookie-policy-summary').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await decline(second).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('.external-media-placeholder')).toHaveCount(1);
  await expect(region(page)).toHaveCount(0);
});

test('one-click withdrawal cleans optional cookies without resetting functional storage or playing radio', async ({ page, context }) => {
  await isolateProviders(page);
  await page.addInitScript(() => {
    window.__radioCalls = { play: 0, pause: 0 };
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      window.__radioCalls.play++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () { window.__radioCalls.pause++; };
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // WebKit can finish DOMContentLoaded before React mounts the radio.
  await expect(page.locator('.radio-dock')).toBeVisible();
  await page.evaluate(() => { window.__originalAudio = document.querySelector('audio'); });
  await page.locator('.radio-dock').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  await region(page).getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.evaluate(() => {
    for (const name of ['_ga', '_ga_FGL2HBXZ92', '_fbp', '_fbc', 'functional-test']) {
      document.cookie = `${name}=test; Path=/`;
    }
    localStorage.setItem('functional-test', 'keep');
    sessionStorage.setItem('functional-test', 'keep');
  });
  await footerSettings(page).click();
  await decline(page).click();
  await expect(region(page)).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  const names = (await context.cookies()).map(cookie => cookie.name);
  expect(names).toContain('functional-test');
  expect(names.filter(name => name.startsWith('_ga') || ['_fbp', '_fbc'].includes(name))).toHaveLength(0);
  expect(await page.evaluate(() => [localStorage.getItem('functional-test'), sessionStorage.getItem('functional-test')])).toEqual(['keep', 'keep']);
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => window.__originalAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.__radioCalls)).toEqual({ play: 1, pause: 0 });
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  // Repeat with withdrawal from another tab while this tab keeps playing.
  await footerSettings(page).click();
  await region(page).getByRole('checkbox', { name: /Analytics cookies/ }).check();
  await region(page).getByRole('checkbox', { name: /Marketing cookies/ }).check();
  await region(page).getByRole('checkbox', { name: /External media/ }).check();
  await save(page).click();
  const second = await context.newPage();
  await isolateProviders(second);
  await second.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  await footerSettings(second).click();
  await decline(second).click();
  await expect.poll(() => page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(true);
  expect(await page.evaluate(() => window.fbq.queue.at(-1).slice(0, 2))).toEqual(['consent', 'revoke']);
  expect(await page.evaluate(() => window.__originalAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.__radioCalls)).toEqual({ play: 1, pause: 0 });
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
});

test('settings are keyboard operable, cancel restores focus, and policy details are optional', async ({ page }) => {
  await isolateProviders(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  const trigger = region(page).getByRole('button', { name: 'Cookie settings', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(region(page).getByRole('heading')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(region(page).getByRole('checkbox', { name: /Analytics cookies/ })).toBeFocused();
  await expect(region(page).getByRole('checkbox', { name: /Analytics cookies/ })).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Space');
  await save(page).focus();
  await page.keyboard.press('Enter');
  expect(await stored(page)).toMatchObject({ analytics: true, marketing: false, media: false });
  const policy = page.locator('.cookie-policy-summary');
  await expect(policy.locator('details')).toHaveCount(5);
  expect(await policy.locator('details').evaluateAll(els => els.every(el => !el.open))).toBe(true);
  await policy.getByRole('button', { name: 'Cookie settings', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(region(page).getByRole('heading')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(policy.getByRole('button', { name: 'Cookie settings', exact: true })).toBeFocused();
  await policy.locator('summary').first().click();
  await expect(policy.getByText('Your browser remembers your snow preference', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('enlarged text keeps choices reachable without covering the player', async ({ page }) => {
  await isolateProviders(page);
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await region(page).getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await region(page).getByRole('checkbox', { name: /Marketing cookies/ }).check();
  await save(page).focus();
  await page.keyboard.press('Enter');
  await expect(region(page)).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ analytics: false, marketing: true, media: false });
  await footerSettings(page).click();
  // ResizeObserver must also clear the expanded radio, not only the mini dock.
  const expand = page.getByRole('button', { name: 'Expand radio player', exact: true });
  if (await expand.isVisible()) await expand.click();
  await expect.poll(async () => {
    const panel = await region(page).boundingBox();
    const dock = await page.locator('.radio-dock').boundingBox();
    return panel.y >= 0 && panel.y + panel.height <= dock.y + 1;
  }).toBe(true);
  await decline(page).focus();
  await page.keyboard.press('Enter');
  await expect(region(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('expiry withdraws media and trackers in an already-open tab', async ({ page }) => {
  await isolateProviders(page);
  await page.clock.install();
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    version: 2, analytics: true, marketing: true, media: true,
    savedAt: Date.now() - 180 * 86400000 + 15000,
  })), key);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.clock.fastForward(16000);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(region(page).getByRole('button', { name: 'Accept all', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(true);
});

test('withdrawal clears queued events when it happens before provider scripts finish loading', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(/https:\/\/(?:www\.googletagmanager\.com\/gtag\/|connect\.facebook\.net\/)/, async route => {
    await gate;
    await route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  await region(page).getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect(page.locator('#santaradio-google-analytics')).toHaveCount(1);
  await footerSettings(page).click();
  await decline(page).click();
  const pending = await page.evaluate(() => ({
    analytics: window.dataLayer.filter(args => args[0] === 'event' ||
      (args[0] === 'consent' && args[2]?.analytics_storage === 'granted')).length,
    marketing: window.fbq.queue.filter(args => args[0] === 'trackSingle' ||
      (args[0] === 'consent' && args[1] === 'grant')).length,
  }));
  expect(pending).toEqual({ analytics: 0, marketing: 0 });
  release();
  await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(true);
});

for (const failure of ['write', 'all']) {
  test(`unavailable ${failure === 'write' ? 'writable' : 'readable and writable'} storage keeps visit choices and explains persistence failure`, async ({ page }) => {
    await isolateProviders(page);
    await page.addInitScript(failure => {
      const blocked = () => { throw new DOMException('Storage blocked for test', 'SecurityError'); };
      if (failure === 'all') {
        Object.defineProperty(window, 'localStorage', { get: blocked });
      } else {
        Storage.prototype.setItem = blocked;
      }
    }, failure);
    await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
    await region(page).getByRole('button', { name: 'Accept all', exact: true }).click();
    await expect(region(page)).toContainText('Your choice applies to this visit');
    await expect(region(page)).toContainText('could not save it for future visits');
    await expect(page.locator('#santaradio-google-analytics, #santaradio-meta-pixel')).toHaveCount(2);
    await region(page).getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.locator('.navbar').getByRole('link', { name: 'Apps', exact: true }).click();
    await expect(region(page)).toHaveCount(0);
    await footerSettings(page).click();
    await decline(page).click();
    await expect(region(page)).toContainText('Your choice applies to this visit');
    // Loaded provider scripts cannot be undone. Assert revocation, not removal.
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(await page.evaluate(() => ({
      disabled: window['ga-disable-G-FGL2HBXZ92'],
      meta: window.fbq.queue.at(-1).slice(0, 2),
    }))).toEqual({ disabled: true, meta: ['consent', 'revoke'] });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(region(page).getByRole('button', { name: 'Accept all', exact: true })).toBeVisible();
    await expect(page.locator('#santaradio-google-analytics, #santaradio-meta-pixel, iframe')).toHaveCount(0);
  });
}

test('fresh private contexts keep choices within the session but not a later session', async ({ browser, baseURL, ignoreHTTPSErrors }) => {
  // Playwright contexts are isolated/non-persistent, not the branded Private
  // Browsing UI. See docs/cookie-browser-verification.md for the device boundary.
  for (const accept of [true, false]) {
    const session = await browser.newContext({ baseURL, ignoreHTTPSErrors });
    try {
      await session.route(/https:\/\/[^/]*sibforms\.com\//, route => route.abort());
      const page = await session.newPage();
      await isolateProviders(page);
      await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
      await expect(region(page).getByRole('button', { name: 'Accept all', exact: true })).toBeVisible();
      await region(page).getByRole('button', { name: accept ? 'Accept all' : 'Decline optional cookies', exact: true }).click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(region(page)).toHaveCount(0);
      expect(await stored(page)).toMatchObject({ analytics: accept, marketing: accept, media: accept });
    } finally {
      await session.close();
    }
  }
});

test('blocked third-party storage does not break consent-gated players or adult access', async ({ page }) => {
  const frames = [];
  await mockBrevo(page);
  await page.route(/https:\/\/(?:www\.googletagmanager\.com\/|connect\.facebook\.net\/)/,
    route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route(/https:\/\/(?:www\.youtube\.com\/embed\/|tunein\.com\/embed\/)/, route => {
    frames.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <script>
        Object.defineProperty(window, 'localStorage', { get() {
          throw new DOMException('Third-party storage blocked', 'SecurityError');
        } });
        let blocked = false;
        try { localStorage.setItem('test', 'test'); } catch { blocked = true; }
        document.addEventListener('DOMContentLoaded', () => {
          document.body.textContent = blocked ? 'Mock player: storage blocked' : 'Unexpected storage access';
        });
      </script>` });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await decline(page).click();
  expect(frames).toHaveLength(0);
  await page.locator('.external-media-placeholder').getByRole('button', { name: 'Enable external media' }).click();
  await expect(page.frameLocator('iframe').getByText('Mock player: storage blocked')).toBeVisible();
  await page.goto('/links', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load TuneIn player', exact: true }).click();
  await expect(page.frameLocator('iframe').getByText('Mock player: storage blocked')).toBeVisible();
  expect(frames.some(url => url.includes('youtube.com'))).toBe(true);
  expect(frames.some(url => url.includes('tunein.com'))).toBe(true);
  expect(await stored(page)).toMatchObject({ analytics: false, marketing: false, media: true });
  await footerSettings(page).click();
  await decline(page).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.goto('/free-santa-message', { waitUntil: 'domcontentloaded' });
  const access = page.locator('.santa-message-access');
  await access.locator('input[name="FIRSTNAME"]').fill('Test');
  await access.locator('input[name="LASTNAME"]').fill('Parent');
  await access.locator('input[name="EMAIL"]').fill('parent@example.test');
  await access.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  expect(await stored(page)).toMatchObject({ analytics: false, marketing: false, media: false });
});
