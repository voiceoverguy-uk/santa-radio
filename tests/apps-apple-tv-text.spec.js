import { test, expect } from '@playwright/test';

for (const width of [320, 390]) {
  for (const fontSize of [16, 32]) {
    test(`Apple TV instructions stay readable at ${width}px with ${fontSize}px root text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/apps');
      await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
      await page.evaluate(size => {
        document.documentElement.style.fontSize = `${size}px`;
      }, fontSize);
      await page.evaluate(() => document.fonts.ready);

      const section = page.getByRole('region', { name: 'Available FREE on Apple TV' });
      await expect(section.locator('h2')).toHaveText('Available FREE on Apple TV');
      await expect(section.locator('.apple-tv-instruction')).toHaveText(
        'Find Santa Radio in the App Store on your Apple TV.'
      );
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
        .toBe(`${fontSize}px`);
      const copy = await section.locator('.apple-tv-copy').boundingBox();
      expect(copy.x).toBeGreaterThanOrEqual(0);
      expect(copy.x + copy.width).toBeLessThanOrEqual(width);

      // Check the actual line boxes, not just the section: overflow:hidden on
      // the showcase must not disguise text extending beyond the viewport.
      for (const selector of ['.apple-tv-eyebrow', 'h2', '.apple-tv-description', '.apple-tv-instruction']) {
        const text = section.locator(selector);
        await text.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.evaluate(() => window.scrollTo({ left: 0, behavior: 'instant' }));
        await expect(text).toBeVisible();
        const bounds = await text.evaluate(el => {
          const box = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = [...range.getClientRects()];
          return {
            fits: lines.length > 0 && lines.every(line =>
              line.left >= Math.max(0, box.left) - 0.5 &&
              line.right <= Math.min(innerWidth, box.right) + 0.5
            ),
            overflowing: el.scrollWidth > el.clientWidth + 1,
          };
        });
        expect(bounds.fits, `${selector} line boxes fit their container and viewport`).toBe(true);
        expect(bounds.overflowing, `${selector} has no clipped content`).toBe(false);
      }
      // Other app sections have independent enlarged-text issues; keep this
      // regression check focused on Apple TV, including its hidden overflow.
      expect(await section.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}
