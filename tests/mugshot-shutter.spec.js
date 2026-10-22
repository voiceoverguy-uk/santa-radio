import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source = '/audio/mugshots/camera.mp3';
const grids = [
  { path: '/', selector: '.mugshots-preview .mug-card' },
  { path: '/mugshots/all', selector: '.mugshot-card' },
];

async function instrument(page, mode = 'success') {
  await page.addInitScript(({ source, mode }) => {
    window.shutter = { calls: 0, instances: [], mode };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.src.endsWith(source)) return original.call(this);
      window.shutter.calls++;
      if (!window.shutter.instances.includes(this)) window.shutter.instances.push(this);
      if (window.shutter.mode === 'throw') throw new Error('Unavailable');
      if (window.shutter.mode === 'blocked') return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
      return Promise.resolve();
    };
  }, { source, mode });
}

async function finishClip(page) {
  await page.evaluate(() => window.shutter.instances[0].dispatchEvent(new Event('ended')));
  await page.waitForTimeout(550);
}

for (const { path, selector } of grids) {
  test(`${path} hover, selection and rapid card visits share one shutter`, async ({ page }) => {
    await instrument(page);
    await page.goto(path);
    const cards = page.locator(selector);
    await cards.first().hover();
    await expect.poll(() => page.evaluate(() => window.shutter.calls)).toBe(1);
    await cards.nth(1).hover();
    await cards.nth(2).hover();
    expect(await page.evaluate(() => window.shutter.calls)).toBe(1);
    await finishClip(page);
    await cards.first().hover();
    expect(await page.evaluate(() => window.shutter.calls)).toBe(2);
    await finishClip(page);
    const href = await cards.first().getAttribute('href');
    await cards.first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    expect(await page.evaluate(() => window.shutter.calls)).toBe(2);
    expect(await page.evaluate(() => window.shutter.instances.length)).toBe(1);
    await page.locator('.mugshot-detail-photo').hover();
    await page.locator('.mugshot-detail-photo').click();
    expect(await page.evaluate(() => window.shutter.calls)).toBe(2);
  });

  test(`${path} blocked hover retries on click without blocking navigation`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await instrument(page, 'blocked');
    await page.goto(path);
    const card = page.locator(selector).first();
    await card.hover();
    await expect.poll(() => page.evaluate(() => window.shutter.calls)).toBe(1);
    await page.evaluate(() => { window.shutter.mode = 'success'; });
    const href = await card.getAttribute('href');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    expect(await page.evaluate(() => window.shutter.calls)).toBe(2);
    expect(errors).toEqual([]);
  });

  test(`${path} keyboard focus stays silent and Enter plays once with reduced motion`, async ({ page }) => {
    await instrument(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    const card = page.locator(selector).first();
    await card.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(card).toBeFocused();
    expect(await page.evaluate(() => window.shutter.calls)).toBe(0);
    const href = await card.getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    expect(await page.evaluate(() => window.shutter.calls)).toBe(1);
  });

  test(`${path} touch tap plays once and preserves mobile navigation`, async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await instrument(page);
      await page.goto(path);
      const card = page.locator(selector).first();
      await card.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => window.shutter.calls)).toBe(0);
      const href = await card.getAttribute('href');
      await card.tap();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      expect(await page.evaluate(() => window.shutter.calls)).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await context.close();
    }
  });
}

test('the exact supplied MP3 is served and actually decodes and plays', async ({ page, request }) => {
  const response = await request.get(source);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('audio/mpeg');
  expect(await response.body()).toEqual(fs.readFileSync('attached_assets/camera_1792629377664.mp3'));
  await page.goto('/mugshots/all');
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Jeremy Kyle');
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    window.realShutter = { ended: false, failed: false };
    HTMLMediaElement.prototype.play = function () {
      if (this.src.endsWith('/audio/mugshots/camera.mp3')) {
        this.addEventListener('ended', () => { window.realShutter.ended = true; });
        this.addEventListener('error', () => { window.realShutter.failed = true; });
      }
      return original.call(this);
    };
  });
  await page.locator('.mugshot-card').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/mugshots\/jeremy-kyle-tv-personality$/);
  await expect.poll(() => page.evaluate(() => window.realShutter.ended)).toBe(true);
  expect(await page.evaluate(() => window.realShutter.failed)).toBe(false);
});

test('synchronous playback failure is harmless to card navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await instrument(page, 'throw');
  await page.goto('/mugshots/all');
  const card = page.locator('.mugshot-card').first();
  const href = await card.getAttribute('href');
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  expect(errors).toEqual([]);
});

test('finished clips are rate-limited and media errors allow a later selection', async ({ page }) => {
  await instrument(page);
  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  await cards.first().dispatchEvent('pointerover', { pointerType: 'mouse', buttons: 0 });
  expect(await page.evaluate(() => window.shutter.calls)).toBe(1);
  await page.evaluate(() => window.shutter.instances[0].dispatchEvent(new Event('ended')));
  await cards.nth(1).dispatchEvent('pointerover', { pointerType: 'mouse', buttons: 0 });
  expect(await page.evaluate(() => window.shutter.calls)).toBe(1);
  await page.waitForTimeout(550);
  await cards.nth(2).dispatchEvent('pointerover', { pointerType: 'mouse', buttons: 0 });
  expect(await page.evaluate(() => window.shutter.calls)).toBe(2);
  await page.evaluate(() => window.shutter.instances[0].dispatchEvent(new Event('error')));
  const href = await cards.nth(2).getAttribute('href');
  await cards.nth(2).dispatchEvent('click', { detail: 1 });
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  expect(await page.evaluate(() => window.shutter.calls)).toBe(3);
});

test('gallery controls and non-card links do not play the shutter', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  // Keep the pointer parked: scrolling a link into view can legitimately
  // carry a photo card underneath it and trigger that card's hover.
  await page.locator('.mugshots-preview .mug-link').dispatchEvent('click');
  await expect(page).toHaveURL(/mugshots\/all$/);
  await page.getByRole('button', { name: 'Alphabetical order', exact: true }).dispatchEvent('click');
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Jeremy Kyle');
  await page.locator('.seo-directory a[href="/mugshots/jeremy-kyle-tv-personality"]').dispatchEvent('click');
  await expect(page).toHaveURL(/mugshots\/jeremy-kyle-tv-personality$/);
  expect(await page.evaluate(() => window.shutter.calls)).toBe(0);
});
