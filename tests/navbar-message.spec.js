import { test, expect } from '@playwright/test';
import { expectHighlight } from './helpers/navbar-highlight.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.addInitScript(() => {
    window.mediaMode = 'pending';
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () {
      if (window.mediaMode === 'pending') return new Promise(() => {});
      if (window.mediaMode === 'failure') return Promise.reject(new Error('Test failure'));
      return Promise.resolve();
    };
  });
});

for (const width of [1280, 320]) {
  test(`navigation radio retains loading, cancellation, retry and shared playback at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    if (width < 1201) await nav.getByRole('button', { name: 'Open menu' }).click();
    const radio = nav.locator('.nav-radio');
    const heroRadio = page.locator('.hero-actions button');
    const dockRadio = page.locator('.radio-play');
    await radio.focus();
    await page.keyboard.press('Space');
    await expect(radio).toHaveText('Connecting…');
    if (width > 1200) await expectHighlight(nav, radio);
    await expect(radio).toHaveAccessibleName('Cancel loading radio');
    await expect(radio).toHaveCSS('outline-style', 'solid');
    await expect(heroRadio).toHaveText('Connecting…');
    await expect(dockRadio).toHaveText('Connecting…');
    await page.keyboard.press('Enter');
    await expect(radio).toHaveText('Listen Live');
    await page.evaluate(() => { window.mediaMode = 'failure'; });
    await page.keyboard.press('Enter');
    await expect(radio).toHaveText('Try Again');
    if (width > 1200) await expectHighlight(nav, radio);
    await expect(dockRadio).toHaveText('Try Again');
    await page.evaluate(() => { window.mediaMode = 'success'; });
    await page.keyboard.press('Space');
    await expect(radio).toHaveText('Pause Radio');
    if (width > 1200) await expectHighlight(nav, radio);
    await expect(heroRadio).toHaveText('Pause Radio');
    await expect(dockRadio).toHaveText('Pause Radio');
    await page.evaluate(() => { window.originalRadio = document.querySelector('audio'); });
    // Keyboard order remains radio, Music, Celebrity Mugshots, Tracker, final message CTA.
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    const message = nav.getByRole('link', { name: 'FREE Santa Message', exact: true });
    await expect(message).toBeFocused();
    await expect(message).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/free-santa-message$/);
    if (width < 1201) {
      await expect(nav.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
      await nav.getByRole('button', { name: 'Open menu' }).click();
    }
    await expect(message).toHaveAttribute('aria-current', 'page');
    await expect(message).toHaveCSS('background-color', 'rgb(155, 17, 30)');
    await expect(radio).toHaveText('Pause Radio');
    expect(await page.evaluate(() => window.originalRadio === document.querySelector('audio'))).toBe(true);
    await radio.click();
    await expect(dockRadio).toHaveText('Listen Live');
  });
}
