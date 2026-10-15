import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`app features stay clear and unboxed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/apps', { waitUntil: 'domcontentloaded' });

    const section = page.locator('#santaradio');
    const features = section.locator('.feature-item');
    await expect(features).toHaveCount(6);
    await expect(section.locator('.feature-icon')).toHaveCount(0);
    await expect(section.locator('.feature-label')).toHaveCount(6);
    await expect(section.locator('.feature-desc')).toHaveCount(6);

    for (const feature of await features.all()) {
      await expect(feature).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(feature).toHaveCSS('border-top-style', 'none');
      await expect(feature).toHaveCSS('border-radius', '0px');
      await expect(feature).toHaveCSS('padding', '0px');
      await expect(feature).toHaveCSS('box-shadow', 'none');
    }

    if (width >= 768) {
      const image = await section.locator('.app-screenshots-frame').boundingBox();
      const firstFeature = await features.first().boundingBox();
      expect(Math.abs(image.y - firstFeature.y)).toBeLessThan(1);
    }
  });
}
