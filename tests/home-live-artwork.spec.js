import { test, expect } from '@playwright/test';
import fs from 'node:fs';

async function setup(page, { failPlayback = false } = {}) {
  // Exercise the real buttons/provider while avoiding live-stream timing in UI tests.
  await page.addInitScript(({ failPlayback }) => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () {
      return failPlayback ? Promise.reject(new Error('Test stream failure')) : Promise.resolve();
    };
  }, { failPlayback });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  const state = { artist: 'Cher', title: 'Christmas Song', unavailable: false };
  await page.route('**/api/radio-metadata', route => route.fulfill({
    json: {
      current: state.unavailable ? null : { artist: state.artist, title: state.title },
      currentStatus: state.unavailable ? 'unavailable' : 'ready',
      upcoming: [], upcomingStatus: 'ready',
    },
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rejectCookies = page.getByRole('button', { name: 'Reject optional cookies', exact: true });
  if (await rejectCookies.isVisible()) await rejectCookies.click();
  return state;
}

for (const width of [1280, 390]) test(`artwork song info matches both fields, updates and navigates at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await setup(page);
  state.artist = 'John Legend';
  state.title = 'Bring Me Love';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const card = page.locator('.now-playing-artwork');
  const info = card.getByRole('link');
  await expect(info).toBeVisible();
  await expect(info).toHaveAttribute('href', '/christmas-artist/478-john-legend-bring-me-love');
  await expect(info).toHaveAttribute('aria-label', /Bring Me Love.*John Legend/);
  const frame = await card.boundingBox();
  const button = await info.boundingBox();
  expect(button.width).toBeGreaterThanOrEqual(44);
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.x).toBeGreaterThan(frame.x + frame.width / 2);
  expect(button.y).toBeGreaterThan(frame.y + frame.height / 2);
  expect(button.x + button.width).toBeLessThanOrEqual(frame.x + frame.width);
  expect(button.y + button.height).toBeLessThanOrEqual(frame.y + frame.height);
  await info.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(info).toBeFocused();
  expect(await info.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await card.evaluate(el => el.scrollIntoView({ block: 'center' }));
  fs.mkdirSync('generated-artifacts', { recursive: true });
  await page.screenshot({ path: `generated-artifacts/artwork-song-info-${width}.jpg` });

  // Same artist, different song must change the destination.
  state.title = 'What A Wonderful World';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toHaveAttribute('href', '/christmas-artist/415-john-legend-what-a-wonderful-world');
  // A title belonging to another artist must never produce a link.
  state.artist = 'Cher';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toHaveCount(0);
  state.artist = 'John Legend';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toBeVisible();
  await info.click();
  await expect(page).toHaveURL(/\/christmas-artist\/415-john-legend-what-a-wonderful-world$/);
  await expect(page.getByRole('heading', { name: 'What A Wonderful World — John Legend', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Santa Radio player' })
    .getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
});

test('artwork info is absent for unmatched or unavailable tracks', async ({ page }) => {
  const state = await setup(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const card = page.locator('.now-playing-artwork');
  await expect(card).toBeVisible();
  await expect(card.getByRole('link')).toHaveCount(0);
  state.title = 'DJ Play a Christmas Song';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByRole('link')).toHaveAttribute('href', '/christmas-artist/551-cher-dj-play-a-christmas-song');
  state.unavailable = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByRole('link')).toHaveCount(0);
});

test('desktop play reveals artwork on the right, updates artists and glows on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = await setup(page);
  const card = page.locator('.now-playing-artwork');
  await expect(card).toHaveCount(0);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/cher.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth === 512)).toBe(true);
  const content = await page.locator('.hero-content').boundingBox();
  const frame = await card.boundingBox();
  expect(frame.x).toBeGreaterThan(content.x + content.width);
  const baseShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
  await card.hover();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(230, 206, 134)');
  expect(await card.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe(baseShadow);
  fs.mkdirSync('generated-artifacts', { recursive: true });
  await page.screenshot({ path: 'generated-artifacts/home-live-artwork-desktop.jpg' });
  state.artist = 'Ava Max';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/ava-max.webp');
  state.artist = 'An artist without supplied artwork';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
  state.unavailable = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card).toHaveAttribute('aria-label', 'Santa Radio now-playing artwork');
  await page.locator('.hero-actions').getByRole('button', { name: 'Pause Radio' }).click();
  await expect(card).toHaveCount(0);
});

test('mobile play shows artwork below the countdown; tablets stay hidden and desktops keep the right-hand layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  const card = page.locator('.now-playing-artwork');
  await expect(card).toHaveCount(0);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/cher.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [667, 375], [767, 900]]) {
    await page.setViewportSize({ width, height });
    const frame = await card.boundingBox();
    const countdown = await page.locator('.hero-countdown').boundingBox();
    const tracker = await page.locator('.tracker-banner').boundingBox();
    expect(frame.y).toBeGreaterThan(countdown.y + countdown.height);
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(width);
    expect(frame.width).toBeCloseTo(frame.height, 1);
    expect(frame.y + frame.height).toBeLessThan(tracker.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  fs.mkdirSync('generated-artifacts', { recursive: true });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'generated-artifacts/home-live-artwork-mobile.jpg' });
  state.artist = 'Ava Max';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/ava-max.webp');
  state.artist = 'An artist without supplied artwork';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
  await page.getByRole('complementary', { name: 'Santa Radio player' }).getByRole('button', { name: 'Pause Radio', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('complementary', { name: 'Santa Radio player' }).getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(card).toBeVisible();
  await page.setViewportSize({ width: 820, height: 900 });
  await expect(card).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(card).toBeVisible();
  const title = await page.locator('.hero-title').boundingBox();
  const frame = await card.boundingBox();
  expect(frame.x).toBeGreaterThan(title.x + title.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed artwork falls back safely; reduced motion disables transitions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/artist-artwork/cher.webp', route => route.abort());
  await setup(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const card = page.locator('.now-playing-artwork');
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await card.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});

for (const width of [390, 1280]) {
test(`unsuccessful playback does not show a playing-artist card at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page, { failPlayback: true });
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(page.locator('.hero-actions').getByRole('button', { name: 'Try Again' })).toBeVisible();
  await expect(page.locator('.now-playing-artwork')).toHaveCount(0);
});
}
