import { test, expect } from '@playwright/test';

for (const width of [390, 1024, 1440]) {
  for (const path of ['/', '/mugshots/all']) {
    test(`Mugshot cards keep ${path === '/' ? 'uncropped' : 'square'} photos and visible labels at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const card = page.locator(path === '/' ? '.mug-card' : '.mugshot-card').first();
      await card.scrollIntoViewIfNeeded();
      const image = card.locator('img');
      await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
      const dimensions = await card.evaluate(node => {
        const image = node.querySelector('img').getBoundingClientRect();
        const label = node.querySelector('strong').getBoundingClientRect();
        const card = node.getBoundingClientRect();
        return { imageWidth: image.width, imageHeight: image.height, labelTop: label.top, labelBottom: label.bottom, imageBottom: image.bottom, cardBottom: card.bottom, cardHeight: card.height };
      });
      if (path === '/') {
        expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('contain');
      } else {
        expect(Math.abs(dimensions.imageWidth - dimensions.imageHeight)).toBeLessThan(1);
      }
      expect(dimensions.labelTop).toBeGreaterThanOrEqual(dimensions.imageBottom - 1);
      expect(dimensions.labelBottom).toBeLessThanOrEqual(dimensions.cardBottom + 1);
      expect(dimensions.cardHeight).toBeLessThan(dimensions.imageWidth + 180);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(card.locator('strong')).toBeVisible();
    });
  }
}
