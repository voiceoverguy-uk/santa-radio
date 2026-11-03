import { test, expect } from '@playwright/test';

for (const path of ['/', '/free-santa-message']) {
  for (const width of [320, 390, 1440]) {
    test(`Black Friday offer and smaller picture fit ${path} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
      await page.route('**/api/radio-metadata*', route => route.fulfill({
        json: { available: false, current: null, upcoming: [] },
      }));
      await page.goto(path);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      const promotion = page.locator('.santa-studio-promotion');
      await expect(promotion.getByText('Black Friday Deal', { exact: true })).toBeVisible();
      await expect(promotion.getByText('Only £4.50', { exact: true })).toBeVisible();
      await expect(promotion.getByRole('button', { name: 'Enlarge certificate', exact: true })).toBeVisible();
      await expect(promotion.getByRole('button', { name: 'Enlarge letter to read', exact: true })).toBeVisible();
      const picture = promotion.getByRole('button', { name: 'Enlarge Santa’s Nice List picture', exact: true });
      const box = await picture.boundingBox();
      expect(box.width).toBeLessThanOrEqual(280);
      expect(box.width).toBeGreaterThan(100);
      expect(await promotion.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const bounds = await promotion.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      await promotion.screenshot({ path: testInfo.outputPath('black-friday-offer.jpg'), animations: 'disabled' });
      await picture.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').locator('.studio-santa-picture')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }
}
