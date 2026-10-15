import { test, expect } from '@playwright/test';

for (const width of [1440, 1024, 768, 390]) {
  test(`app feature cards align with image frames at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/apps', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);

    for (const id of ['santaradio', 'christmasradio']) {
      const section = page.locator(`#${id}`);
      const frame = section.locator('.app-screenshots-frame');
      const features = section.locator('.app-features-grid');
      const heading = section.locator('.app-screenshots-heading');
      const [imageBox, cardsBox, headingBox] = await Promise.all([
        frame.boundingBox(), features.boundingBox(), heading.boundingBox(),
      ]);
      expect(imageBox).not.toBeNull();
      expect(cardsBox).not.toBeNull();
      expect(headingBox).not.toBeNull();
      expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(imageBox.y);
      if (width >= 768) {
        expect(Math.abs(cardsBox.y - imageBox.y)).toBeLessThan(1);
        expect(cardsBox.x).toBeGreaterThan(imageBox.x + imageBox.width);
      } else {
        expect(cardsBox.y).toBeGreaterThan(imageBox.y + imageBox.height);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
