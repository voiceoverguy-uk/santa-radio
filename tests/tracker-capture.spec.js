import { test, expect } from '@playwright/test';
import { isTrackingRequest } from '../src/privacy/trackerPrivacy.js';

const key = 'santaradio-cookie-consent-v2';
const duration = 180 * 24 * 60 * 60 * 1000;
const absent = '.navbar, footer, .radio-dock, .snowfall, .marketing-consent, .santa-offer, .tracker-stage-stats, .tj-tl, .tracker-questions, .tracker-preview-panel, .tracker-map-status';
const navigate = (page, path) => page.evaluate(path => {
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}, path);
const ready = page => expect(page.locator('.tj-camera')).toBeVisible();

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const consent of ['fresh', 'accepted', 'rejected', 'expiring']) {
  test(`capture remains uninterrupted with ${consent} consent, delay and expiry`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-09T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-09T12:00:01Z'));
    if (consent !== 'fresh') await page.addInitScript(({ key, consent, duration }) => {
      const allowed = consent !== 'rejected';
      localStorage.setItem(key, JSON.stringify({ version: 2, analytics: allowed, marketing: allowed,
        media: allowed, savedAt: Date.now() - (consent === 'expiring' ? duration - 5000 : 0) }));
    }, { key, consent, duration });
    const tracking = [];
    page.on('request', request => { if (isTrackingRequest(request.url())) tracking.push(request.url()); });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/styt');
    await ready(page);
    const original = await page.evaluate(key => localStorage.getItem(key), key);
    await expect(page.locator(absent)).toHaveCount(0);
    await page.clock.runFor(25000);
    await page.evaluate(() => dispatchEvent(new Event('santaradio:cookie-settings')));
    await expect(page.locator(absent)).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('santa-message-offer-last-shown'))).toBeNull();
    expect(tracking).toEqual([]);
    expect(errors).toEqual([]);
    await navigate(page, '/privacy-policy');
    await expect(page.locator('.navbar')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('.radio-dock')).toHaveCount(1);
    if (consent === 'fresh' || consent === 'expiring') {
      await expect(page.getByRole('button', { name: 'Accept all', exact: true })).toBeVisible();
    } else {
      await expect(page.locator('.marketing-consent')).toHaveCount(0);
    }
  });
}

for (const width of [900, 1920]) {
  test(`desktop ${width}px capture is one line, proportional and scroll-free`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
    await page.goto('/styt');
    await ready(page);
    await expect(page.locator('.tj-departure-value')).toHaveCount(3);
    await expect(page.locator('.tj-departure')).not.toContainText('Seconds');
    const sizes = await page.locator('.tj-toolbar').evaluate(toolbar => {
      const nodes = [...toolbar.querySelectorAll('.tj-btn, .tj-select, .tj-departure-heading, .tj-departure-unit, .tj-region-context')];
      const centers = nodes.map(node => { const b = node.getBoundingClientRect(); return b.y + b.height / 2; });
      const viewport = document.querySelector('.tj-map-viewport').getBoundingClientRect();
      return { lines: Math.max(...centers) - Math.min(...centers), height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth, viewportWidth: viewport.width,
        preserve: document.querySelector('.tj-map-viewport > svg').getAttribute('preserveAspectRatio') };
    });
    expect(sizes.lines).toBeLessThan(3);
    expect(sizes.height).toBeLessThanOrEqual(1080);
    expect(sizes.width).toBeLessThanOrEqual(width);
    expect(sizes.viewportWidth).toBeGreaterThan(width - 16);
    expect(sizes.preserve).toBe('xMidYMid meet');
    await expect(page.getByRole('button', { name: 'World', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Follow Santa', exact: true }).click();
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
    await page.getByLabel('Browse a region', { exact: true }).selectOption('Europe');
    await expect(page.locator('.tj-region-context')).toHaveText('Europe');
    await page.reload();
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
  });
}

for (const width of [320, 900]) {
  test(`capture wraps safely with enlarged text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/styt');
    await ready(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(await page.locator('.tj-toolbar').evaluate(toolbar => {
      const parent = toolbar.getBoundingClientRect();
      return toolbar.scrollWidth <= toolbar.clientWidth + 1 &&
        [...toolbar.querySelectorAll('button, select, .tj-departure-unit, .tj-region-context')].every(node => {
          const box = node.getBoundingClientRect();
          return box.left >= parent.left && box.right <= parent.right + 1 && node.scrollWidth <= node.clientWidth + 1;
        });
    })).toBe(true);
    await page.getByRole('button', { name: 'World', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Follow Santa', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
  });
}

test('actual clock crosses departure, progresses and finishes without preview state', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-24T09:59:58Z') });
  await page.clock.pauseAt(new Date('2026-12-24T09:59:59Z'));
  // A saved development preview must have no influence over this route.
  await page.addInitScript(() => localStorage.setItem('santa-tracker-preview',
    JSON.stringify({ enabled: true, simulatedStartMs: 0, speedMultiplier: 3600, activatedAtRealMs: Date.now() })));
  await page.goto('/styt');
  await ready(page);
  await expect(page.locator('.tj-departure')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('.tj-departure')).toHaveCount(0);
  await expect(page.locator('.tj-legend')).toBeVisible();
  const time = await page.locator('.tj-camera > [data-night-overlay]').getAttribute('data-solar-time');
  await page.clock.runFor(60000);
  await expect(page.locator('.tj-camera > [data-night-overlay]')).not.toHaveAttribute('data-solar-time', time);
  await page.clock.setSystemTime(new Date('2026-12-24T14:10:00Z'));
  await page.clock.runFor(1000);
  const position = await page.locator('.tj-santa').getAttribute('transform');
  await page.clock.runFor(60000);
  await expect(page.locator('.tj-santa')).not.toHaveAttribute('transform', position);
  await page.clock.setSystemTime(new Date('2026-12-25T11:20:00Z'));
  await page.clock.runFor(1000);
  await expect(page.locator('.tj-live')).toHaveCount(0);
  await expect(page.locator('.tj-legend')).toBeVisible();
  await expect(page.locator('.tj-santa')).toHaveAttribute('data-santa-lng', '-157.85833');
  await expect(page.locator(absent)).toHaveCount(0);
});

test('entering with open cookie settings or offer removes them and restores ordinary pages', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-09T12:00:01Z'));
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cookie settings', exact: true })).toBeVisible();
  await navigate(page, '/styt');
  await ready(page);
  await expect(page.locator(absent)).toHaveCount(0);
  await page.clock.runFor(20000);
  await expect(page.locator(absent)).toHaveCount(0);
  await navigate(page, '/apps');
  await page.clock.runFor(400);
  await expect(page.locator('.santa-offer')).toBeVisible();
  await navigate(page, '/styt');
  await expect(page.locator(absent)).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.goBack();
  await expect(page.locator('.navbar')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('blocked storage does not show a warning on capture or grant consent', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, {
      get() { throw new DOMException('Storage disabled', 'SecurityError'); },
    });
  });
  await page.goto('/apps');
  await page.context().clearCookies();
  await page.evaluate(() => Object.defineProperty(document, 'cookie', {
    configurable: true, get: () => '', set: () => {},
  }));
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cookie preference status' })).toBeVisible();
  await navigate(page, '/styt');
  await ready(page);
  await expect(page.locator(absent)).toHaveCount(0);
  await navigate(page, '/apps');
  await expect(page.getByRole('region', { name: 'Cookie preference status' })).toBeVisible();
});

test('navigation into capture revokes existing tracking and blocks late requests without changing acceptance', async ({ page }) => {
  const tracking = [];
  await page.route(/https:\/\/(?:www\.googletagmanager\.com|connect\.facebook\.net|www\.google-analytics\.com|www\.facebook\.com)/, route => {
    tracking.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await page.goto('/privacy-policy');
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect(page.locator('#santaradio-google-analytics')).toHaveCount(1);
  const consent = await page.evaluate(key => localStorage.getItem(key), key);
  await navigate(page, '/styt');
  await ready(page);
  const count = tracking.length;
  await page.evaluate(async () => {
    const url = 'https://www.google-analytics.com/g/collect?en=late';
    await fetch(url);
    navigator.sendBeacon(url, 'late');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.send('late');
    new Image().src = 'https://www.facebook.com/tr/?ev=late';
    const analytics = await import('/src/privacy/googleAnalytics.js');
    analytics.trackAnalyticsPageView('/apps');
    analytics.trackAnalyticsEvent('capture_late_event', {});
  });
  expect(await page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(consent);
  expect(tracking).toHaveLength(count);
  await navigate(page, '/privacy-policy');
  await expect.poll(() => page.evaluate(() => window['ga-disable-G-FGL2HBXZ92'])).toBe(false);
  await expect(page.locator('.marketing-consent')).toHaveCount(0);
});
