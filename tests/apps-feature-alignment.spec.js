import { test, expect } from '@playwright/test';

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`devices sit beside HTML copy or stack naturally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/apps');
    await page.evaluate(() => document.fonts.ready);
    for (const section of await page.locator('.app-section').all()) {
      const artwork = section.locator('.app-screenshots, .app-promo-wrap').first();
      const copy = section.locator('.app-copy');
      const [imageBox, copyBox] = await Promise.all([artwork.boundingBox(), copy.boundingBox()]);
      expect(imageBox).not.toBeNull();
      expect(copyBox).not.toBeNull();
      if (width >= 768) {
        expect(copyBox.x).toBeGreaterThanOrEqual(imageBox.x + imageBox.width + 20);
      } else {
        expect(copyBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height + 20);
      }
      await expect(copy.locator('.app-section-title')).toHaveCount(1);
      await expect(copy.locator('.app-download-btns')).toHaveCount(1);
    }
    for (const selector of ['.apple-watch-showcase', '.apple-tv-showcase', '.mac-app-showcase']) {
      const section = page.locator(selector);
      const device = await section.locator('figure').boundingBox();
      const copy = await section.locator('[class$="-copy"]').boundingBox();
      if (width >= 768) expect(copy.x).toBeGreaterThan(device.x + device.width);
      else expect(copy.y).toBeGreaterThan(device.y + device.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
