import { test, expect } from '@playwright/test';
import raw from '../src/data/mugshots.json' with { type: 'json' };

const names = ['Chuckle Brothers', 'Christine Lampard', 'Ben Nealon', 'Juliet Mills',
  'Lorna Fitzgerald', 'Maxwell Caulfield', 'Robert Carlyle', 'Steve Fletcher'];

for (const width of [390, 1280]) {
  test(`standard and taller profile photos share a frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let reference;
    for (const name of names) {
      const profile = raw.find(row => row.artist === name && row.image);
      await page.goto(`/mugshots/${profile.song}`);
      const photo = page.locator('.mugshot-detail-photo');
      await expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      const dimensions = await photo.evaluate(img => {
        const rect = img.getBoundingClientRect();
        const frame = img.parentElement.getBoundingClientRect();
        return { width: rect.width, height: rect.height, frameWidth: frame.width,
          frameHeight: frame.height, fit: getComputedStyle(img).objectFit };
      });
      expect(dimensions.fit).toBe('contain');
      expect(Math.abs(dimensions.height / dimensions.width - 1.2)).toBeLessThan(0.01);
      expect(Math.abs(dimensions.height - dimensions.frameHeight)).toBeLessThan(1);
      if (!reference) reference = dimensions;
      expect(Math.abs(dimensions.width - reference.width)).toBeLessThan(1);
      expect(Math.abs(dimensions.height - reference.height)).toBeLessThan(1);
      await expect(page.locator('.mugshot-photo-credit')).toBeVisible();
      await expect(page.locator('.mugshot-profile-nav')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
