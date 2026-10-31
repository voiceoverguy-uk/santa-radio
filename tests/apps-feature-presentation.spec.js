import { test, expect } from '@playwright/test';

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`gold-outlined app features remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/apps');
    for (const section of await page.locator('.app-section').all()) {
      const features = section.locator('.feature-item');
      await expect(features).toHaveCount(6);
      await expect(section.locator('.feature-icon svg[aria-hidden="true"]')).toHaveCount(6);
      await expect(section.locator('.feature-label')).toHaveCount(6);
      await expect(section.locator('.feature-desc')).toHaveCount(6);
      for (const feature of await features.all()) {
        const style = await feature.evaluate(el => {
          const css = getComputedStyle(el);
          return { border: css.borderTopStyle, width: css.borderTopWidth,
            background: css.backgroundImage, padding: parseFloat(css.paddingTop) };
        });
        expect(style.border).toBe('solid');
        expect(style.width).toBe('1px');
        expect(style.background).toContain('linear-gradient');
        expect(style.padding).toBeGreaterThanOrEqual(12);
      }
      const boxes = await features.evaluateAll(items => items.map(el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right };
      }));
      if (width >= 1200) expect(boxes[0].y).toBeCloseTo(boxes[1].y, 1);
      if (width <= 390) expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
      expect(boxes.every(box => box.x >= 0 && box.right <= width)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
