import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';

const canonical = 'https://santa-radio.replit.app/santa-tracker';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('homepage feature and navigation keep the one existing radio playing', async ({ page }) => {
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
  await page.goto('/');
  await expect(page.locator('.tracker-banner')).toContainText('Santa');
  await expect(page.locator('.tracker-banner a')).toHaveAttribute('href', '/santa-tracker');
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live' }).click();
  await page.getByRole('slider', { name: 'Radio volume' }).fill('0.25');
  await page.evaluate(() => { window.originalAudio = document.querySelector('audio'); });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page).toHaveURL(/\/santa-tracker$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText("Track Santa's Journey");
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => ({
    sameAudio: window.originalAudio === document.querySelector('audio'),
    count: document.querySelectorAll('audio').length,
    volume: document.querySelector('audio').volume,
    plays: window.playCalls, pauses: window.pauseCalls,
  }))).toEqual({ sameAudio: true, count: 1, volume: 0.25, plays: 1, pauses: 0 });
});

test('direct route metadata, assets and preview noindex are available before JavaScript', async ({ request, page }) => {
  const response = await request.get('/santa-tracker');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain("Santa Tracker | Track Santa's Journey");
  expect(html).toContain(`rel="canonical" href="${canonical}"`);
  expect(html).toContain('property="og:site_name" content="Santa Radio"');
  const preview = await request.get('/santa-tracker/preview');
  // The development proxy also appends its own non-indexing directives.
  expect(preview.headers()['x-robots-tag']).toContain('noindex, follow');
  expect(await preview.text()).toContain('name="robots" content="noindex, follow"');
  for (const asset of ['/images/santa-post-stamp.png', '/images/santa-radio-logo.png']) {
    expect((await request.get(asset)).ok()).toBeTruthy();
  }
  await page.goto('/santa-tracker');
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Santa Radio');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Santa Radio');
  expect(await page.locator('a[href*="/santa-tracker/preview"]').count()).toBe(0);
  expect(await page.locator('main form').count()).toBe(0);
  await expect(page.locator('main').getByRole('link', { name: 'Guy Harris', exact: true })).toHaveAttribute('href', 'https://www.voiceoverguy.co.uk');
});

for (const [date, text] of [
  ['2026-03-15T12:00:00Z', /Holiday Postcards/],
  ['2026-07-15T12:00:00Z', /Christmas in July Postcards/],
  ['2026-11-01T00:00:00Z', /North Pole/],
  ['2026-12-12T12:00:00Z', /Workshop Dispatch/],
  ['2026-12-24T09:00:00Z', /Preparing/],
  ['2026-12-24T14:00:00Z', /Live Update/],
  ['2026-12-25T11:00:00Z', /Journey Summary/],
  ['2027-01-01T12:00:00Z', /North Pole/],
]) {
  test(`seasonal content at ${date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/santa-tracker');
    await expect(page.locator('main')).toContainText(text);
    await expect(page.locator('main svg[role="img"]')).toBeVisible();
    expect(await page.locator('h1').count()).toBe(1);
    await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  });
}

test('desktop/mobile map, typography and menu fit without horizontal overflow', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T14:00:00Z'));
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker');
    const map = page.locator('main svg[role="img"]');
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    expect(box.width).toBeGreaterThan(250);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await page.locator('main h1').evaluate(node => getComputedStyle(node).fontWeight)).toBe('400');
    await expect(map.locator('text').filter({ hasText: '🎅' })).toHaveCount(1);
    if (viewport.width < 768) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close menu' }).click();
    }
  }
});

test('tracker uses the homepage typography and readable brand accents without changing shared styles', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.goto('/');
  const shared = await page.evaluate(() => {
    const heading = getComputedStyle(document.querySelector('main h1'));
    const button = getComputedStyle(document.querySelector('.hero-actions .btn-red'));
    return { font: heading.fontFamily, weight: heading.fontWeight, button: button.backgroundColor };
  });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  const tracker = await page.locator('main h1').evaluate(node => {
    const style = getComputedStyle(node);
    return { font: style.fontFamily, weight: style.fontWeight, size: parseFloat(style.fontSize) };
  });
  expect(tracker.font).toBe(shared.font);
  expect(tracker.weight).toBe(shared.weight);
  expect(tracker.size).toBeLessThanOrEqual(48);
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgb = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = channels => channels.map(v => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const background = rgb(getComputedStyle(document.querySelector('main')).backgroundColor);
    return {
      background,
      ratios: [...document.querySelectorAll('main h1 span, main h1 + p, main [class*="tabular-nums"]')].map(node => {
        const a = luminance(rgb(getComputedStyle(node).color)), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }),
    };
  });
  expect(contrast.background[1]).toBeGreaterThan(contrast.background[2]);
  expect(contrast.background[1]).toBeGreaterThan(contrast.background[0]);
  expect(contrast.ratios.length).toBeGreaterThanOrEqual(5);
  for (const ratio of contrast.ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByRole('button', { name: 'Share this postcard' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  expect(await page.evaluate(() => ({
    font: getComputedStyle(document.querySelector('main h1')).fontFamily,
    weight: getComputedStyle(document.querySelector('main h1')).fontWeight,
    button: getComputedStyle(document.querySelector('.hero-actions .btn-red')).backgroundColor,
  }))).toEqual(shared);
});

test('saved simulated dates stay isolated on the preview route and controls avoid the player', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('santa-tracker-preview', JSON.stringify({
    enabled: true, activatedAtRealMs: Date.now(), simulatedStartMs: Date.UTC(2026, 11, 24, 14),
    speedMultiplier: 1, jumpTarget: 'route-start',
  })));
  await page.goto('/santa-tracker');
  await expect(page.locator('main')).toContainText('Christmas in July Postcards');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  await page.goto('/santa-tracker/preview');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Preview Controls' });
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await expect(page.getByRole('switch', { name: 'Preview mode' })).toHaveAttribute('aria-checked', 'true');
  const panel = page.locator('.tracker-preview-panel');
  await panel.getByRole('button', { name: /complete/i }).click();
  await expect(page.locator('main')).toContainText('Journey Summary');
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const a = await panel.boundingBox(), b = await page.locator('.radio-dock').boundingBox();
    expect(a.x + a.width <= b.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBeTruthy();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page.locator('main')).toContainText('Christmas in July Postcards');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);
});

test('postcard falls back to a real PNG download when embedded native sharing is blocked', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async data => {
      window.sharedTracker = { title: data.title, text: data.text, url: data.url };
      throw new DOMException('Sharing blocked by embedded preview', 'NotAllowedError');
    }, configurable: true });
  });
  await page.goto('/santa-tracker');
  await expect(page.getByRole('button', { name: 'Share this postcard' })).toBeVisible();
  await expect(page.locator('main a', { hasText: 'santa-radio.replit.app/santa-tracker' })).toHaveAttribute('href', canonical);
  const minimise = page.getByRole('button', { name: 'Minimise radio player' });
  if (await minimise.isVisible()) await minimise.click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share this postcard' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('santa-postcard.png');
  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(10000);
  expect((await readFile(path)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(await page.evaluate(() => window.sharedTracker.url)).toBe(canonical);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
