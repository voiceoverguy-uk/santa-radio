import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { mockBrevo } from './helpers/message-access.js';
import { CONSENT_KEY } from '../src/privacy/cookieConsent.js';

test.beforeEach(async ({ page }) => {
  await mockBrevo(page, { success: false });
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })), CONSENT_KEY);
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

for (const width of [1440, 390]) {
  for (const mode of ['song', 'sing-along']) {
    test(`${mode} lyrics link sits below the box on the right and opens the desk at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const slug of ['2-wham-last-christmas', '551-cher-dj-play-a-christmas-song']) {
        const songPage = mode === 'song';
        await page.goto(`/${songPage ? 'christmas-artist' : 'christmas-karaoke-lyrics'}/${slug}`);
        const link = page.locator('.lyrics-message-link').getByRole('link', { name: 'FREE Santa Message', exact: true });
        const lyrics = page.locator(songPage ? '.song-lyrics-content' : '.karaoke-lyrics-display');
        if (songPage) {
          await expect(link).not.toBeVisible();
          await page.locator('.song-lyrics-section summary').click();
        }
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', '/free-santa-message');
        await expect(link).toHaveCSS('background-color', 'rgb(155, 17, 30)');
        await expect(lyrics.locator('pre')).not.toBeEmpty();
        const placement = await page.evaluate(selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          const button = document.querySelector('.lyrics-message-link a').getBoundingClientRect();
          return {
            gap: button.top - box.bottom, right: button.right - box.right,
            left: button.left, edge: button.right, height: button.height,
          };
        }, songPage ? '.song-lyrics-content' : '.karaoke-lyrics-display');
        expect(placement.gap).toBeGreaterThanOrEqual(15);
        expect(Math.abs(placement.right)).toBeLessThan(1);
        expect(placement.left).toBeGreaterThanOrEqual(0);
        expect(placement.edge).toBeLessThanOrEqual(width);
        expect(placement.height).toBeGreaterThanOrEqual(44);
        if (songPage) {
          await page.locator('.song-lyrics-section summary').click();
          await expect(link).not.toBeVisible();
          await page.locator('.song-lyrics-section summary').click();
        }
        await link.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        if (slug.startsWith('2-')) {
          mkdirSync('generated-artifacts', { recursive: true });
          await page.screenshot({ path: `generated-artifacts/lyrics-message-${mode}-${width}.png` });
        }
        await link.click();
        await expect(page).toHaveURL(/\/free-santa-message$/);
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await expect.poll(() => page.evaluate(() => {
          const layout = document.querySelector('#santa-messages .message-layout').getBoundingClientRect();
          const nav = document.querySelector('.navbar').getBoundingClientRect();
          return Math.round(layout.top - nav.bottom);
        })).toBe(24);
        await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
      }
    });
  }
}
