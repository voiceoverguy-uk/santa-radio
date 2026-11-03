import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';

async function open(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.radioTest = { mode: 'success', plays: 0, pauses: 0 };
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {
      if (this.src.includes('citrus3')) window.radioTest.pauses++;
    };
    HTMLMediaElement.prototype.play = function () {
      if (!this.src.includes('citrus3')) return Promise.resolve();
      window.radioTest.plays++;
      if (window.radioTest.mode === 'hold') return new Promise(() => {});
      if (window.radioTest.mode === 'reject') return Promise.reject(new Error('Controlled stream failure'));
      return Promise.resolve();
    };
  });
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { currentStatus: 'unavailable', upcomingStatus: 'unavailable', upcoming: [] },
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

test('mobile radio replaces the hero control without changing desktop or crowding the logo', async ({ page }) => {
  await open(page);
  const radio = page.locator('.nav-radio-icon');
  for (const width of [320, 390, 767, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const heroRadio = page.locator('.hero-name-preview__player-row');
    if (width <= 767) {
      await expect(radio).toBeVisible();
      await expect(radio).toHaveAccessibleName('Listen Live');
      await expect(heroRadio).toBeHidden();
      const logo = await page.locator('.navbar-logo-image').boundingBox();
      const button = await radio.boundingBox();
      const menu = await page.locator('.hamburger').boundingBox();
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.width).toBeGreaterThan(button.height);
      expect(await radio.evaluate(node => parseFloat(getComputedStyle(node).borderRadius))).toBeGreaterThanOrEqual(button.height / 2);
      await expect(radio).toHaveCSS('background-color',
        await page.locator('.radio-play').evaluate(node => getComputedStyle(node).backgroundColor));
      expect(button.x).toBeGreaterThanOrEqual(logo.x + logo.width);
      expect(button.x + button.width).toBeLessThanOrEqual(menu.x);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width);
      await expect(page.locator('.hero-name-checker')).toBeVisible();
    } else {
      await expect(radio).toBeHidden();
      await expect(heroRadio).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(await page.evaluate(() => window.radioTest.plays)).toBe(0);
});

test('mobile nav and dock share play pause and route changes without autoplay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const radio = page.locator('.nav-radio-icon');
  const dock = page.locator('.radio-play');
  expect(await page.evaluate(() => window.radioTest.plays)).toBe(0);
  await expect(page.locator('.radio-dock')).toHaveClass(/is-minimized/);
  await radio.focus();
  await page.keyboard.press('Enter');
  await expect(radio).toHaveAccessibleName('Pause Radio');
  await expect(dock).toHaveText('Pause Radio');
  await dock.click();
  await expect(radio).toHaveAccessibleName('Listen Live');
  await radio.click();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(page.locator('.navbar-links .nav-radio')).toBeHidden();
  await page.locator('.navbar-links').getByRole('link', { name: 'Apps', exact: true }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(radio).toHaveAccessibleName('Pause Radio');
  expect(await page.evaluate(() => window.radioTest.plays)).toBe(2);
  await radio.click();
  await expect(dock).toHaveText('Listen Live');
  await page.goto('/santa-message-workshop');
  await expect(radio).toHaveCount(0);
  await expect(page.locator('.radio-dock')).toBeHidden();
});

test('mobile nav allows cancelling loading and retrying a failed stream', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const radio = page.locator('.nav-radio-icon');
  await page.evaluate(() => { window.radioTest.mode = 'hold'; });
  await radio.click();
  await expect(radio).toHaveAccessibleName('Cancel loading radio');
  await expect(radio).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.radio-play')).toHaveText('Connecting…');
  await radio.click();
  await expect(radio).toHaveAccessibleName('Listen Live');
  await page.evaluate(() => { window.radioTest.mode = 'reject'; });
  await radio.click();
  await expect(radio).toHaveAccessibleName('Try Again');
  await expect(page.locator('.radio-mini-error')).toBeVisible();
  await page.evaluate(() => { window.radioTest.mode = 'success'; });
  await radio.click();
  await expect(radio).toHaveAccessibleName('Pause Radio');
  await expect(page.locator('.radio-play')).toHaveText('Pause Radio');
});
