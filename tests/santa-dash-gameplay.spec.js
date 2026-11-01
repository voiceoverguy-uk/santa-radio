import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const media = '**/media/santa-dash-gameplay-v1.mp4';
const destination = 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397';
test.beforeEach(async ({ context, page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const origin = new URL(test.info().project.use.baseURL).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});
async function open(page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  return page.locator('.santa-dash-promo');
}
async function approach(promo) {
  await promo.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
}
const playing = promo => expect(promo).toHaveAttribute('data-preview-state', 'playing', { timeout: 15000 });

for (const width of [1440, 390, 320]) test(`full-frame inline gameplay and clear store links at ${width}px`, async ({ page }) => {
  const promo = await open(page, width);
  await approach(promo);
  await playing(promo);
  const video = promo.locator('video');
  const facts = await video.evaluate(el => ({
    muted: el.muted, defaultMuted: el.defaultMuted, inline: el.playsInline, loop: el.loop,
    width: el.videoWidth, height: el.videoHeight, fit: getComputedStyle(el).objectFit,
    audioTracks: el.audioTracks?.length ?? 0,
    frame: el.getBoundingClientRect().toJSON(),
    screen: el.parentElement.getBoundingClientRect().toJSON(),
  }));
  expect(facts).toMatchObject({ muted: true, defaultMuted: true, inline: true, loop: true,
    width: 1434, height: 660, fit: 'contain', audioTracks: 0 });
  expect(facts.frame.left).toBeGreaterThanOrEqual(0);
  expect(facts.frame.right).toBeLessThanOrEqual(width);
  expect(facts.frame.width).toBeLessThanOrEqual(facts.screen.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(.15);
  await video.evaluate(el => { el.currentTime = el.duration - .2; });
  await expect.poll(() => video.evaluate(el => el.currentTime), { timeout: 5000 }).toBeLessThan(2);
  const control = promo.getByRole('button', { name: 'Pause Santa Dash gameplay video', exact: true });
  expect(await control.evaluate(el => !!el.closest('a'))).toBe(false);
  for (const selector of ['.santa-dash-promo__artwork-link', '.santa-dash-promo__download']) {
    const link = promo.locator(selector);
    await expect(link).toHaveAttribute('href', destination);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  mkdirSync('generated-artifacts/santa-dash-gameplay', { recursive: true });
  await promo.screenshot({ path: `generated-artifacts/santa-dash-gameplay/${width}.jpg` });
});

test('no MP4 request before approaching the banner; initial poster remains available', async ({ page }) => {
  const requested = [];
  page.on('request', req => { if (req.url().includes('santa-dash-gameplay-v1.mp4')) requested.push(req.url()); });
  const promo = await open(page);
  await expect(promo.locator('video')).toHaveAttribute('preload', 'none');
  await expect(promo.locator('video')).not.toHaveAttribute('src', /.+/);
  expect(requested).toHaveLength(0);
  await approach(promo);
  await playing(promo);
  expect(requested.length).toBeGreaterThan(0);
});

test('loading, media failure and retry keep a real still without false playing state', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(media, async route => { await held; await route.abort('failed'); });
  const promo = await open(page);
  await approach(promo);
  await expect(promo).toHaveAttribute('data-preview-state', 'loading');
  await expect(promo.locator('.santa-dash-promo__poster')).toBeVisible();
  await expect.poll(() => promo.locator('.santa-dash-promo__poster').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  release();
  await expect(promo).toHaveAttribute('data-preview-state', 'failed');
  await expect(promo.getByRole('status')).toContainText('unavailable');
  await expect(promo.locator('.santa-dash-promo__poster')).toBeVisible();
  await page.unroute(media);
  await promo.getByRole('button', { name: 'Retry Santa Dash gameplay video' }).click();
  await playing(promo);
});

test('reduced motion stays still with no MP4 download until Play is explicitly requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requested = [];
  page.on('request', req => { if (req.url().includes('santa-dash-gameplay-v1.mp4')) requested.push(req.url()); });
  const promo = await open(page, 390);
  await approach(promo);
  await expect(promo).toHaveAttribute('data-preview-state', 'reduced-motion-still');
  await expect(promo.locator('.santa-dash-promo__poster')).toBeVisible();
  expect(requested).toHaveLength(0);
  await promo.getByRole('button', { name: 'Play Santa Dash gameplay video' }).click();
  await playing(promo);
  expect(requested.length).toBeGreaterThan(0);
});

test('blocked autoplay shows the still and a working separate Play retry', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    window.__blockDashPlay = true;
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.classList.contains('santa-dash-promo__video') && window.__blockDashPlay) {
        return Promise.reject(new DOMException('Blocked by browser policy', 'NotAllowedError'));
      }
      return original.apply(this, args);
    };
  });
  const promo = await open(page);
  await approach(promo);
  await expect(promo).toHaveAttribute('data-preview-state', 'play-blocked');
  await expect(promo.locator('.santa-dash-promo__poster')).toBeVisible();
  await page.evaluate(() => { window.__blockDashPlay = false; });
  await promo.getByRole('button', { name: 'Play Santa Dash gameplay video' }).click();
  await playing(promo);
});

test('manual keyboard pause persists offscreen; background/visibility changes pause and resume appropriately', async ({ page }) => {
  await page.addInitScript(() => {
    window.__dashPageHidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__dashPageHidden });
  });
  const promo = await open(page);
  await approach(promo);
  await playing(promo);
  const video = promo.locator('video');
  const control = promo.locator('.santa-dash-promo__playback');
  await control.focus();
  await page.keyboard.press('Space');
  await expect(promo).toHaveAttribute('data-preview-state', 'manually-paused');
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await approach(promo);
  await expect(promo).toHaveAttribute('data-preview-state', 'manually-paused');
  await control.focus();
  await page.keyboard.press('Enter');
  await playing(promo);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await approach(promo);
  await playing(promo);
  await page.evaluate(() => {
    window.__dashPageHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await page.evaluate(() => {
    window.__dashPageHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await playing(promo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(promo).toHaveAttribute('data-preview-state', 'reduced-motion-still');
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
});
