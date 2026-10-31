import { test, expect } from '@playwright/test';

for (const width of [320, 390, 430, 1440]) {
  test(`empty artwork leaves no mobile gap after the countdown at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      sessionStorage.setItem('santa-message-offer-shown', 'shown');
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event('playing'));
        return Promise.resolve();
      };
    });
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.evaluate(() => document.fonts.ready);
    const hero = page.locator('.hero-name-preview__hero');
    const slot = hero.locator('.hero-name-preview__artwork-slot');
    if (width < 768) {
      await expect(slot).toHaveCSS('display', 'none');
      const heroBox = await hero.boundingBox();
      const countdown = await hero.locator('.hero-countdown').boundingBox();
      const space = heroBox.y + heroBox.height - countdown.y - countdown.height;
      expect(space).toBeGreaterThanOrEqual(24);
      expect(space).toBeLessThanOrEqual(60);
    } else {
      await expect(slot).toHaveCSS('display', 'grid');
      await expect(slot).toHaveCSS('visibility', 'hidden');
      expect((await slot.boundingBox()).height).toBeGreaterThan(200);
    }
    await hero.getByRole('button', { name: 'Listen Live', exact: true }).click();
    await expect(slot.locator('.now-playing-artwork')).toBeVisible();
    await expect(slot).toHaveCSS('display', 'grid');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
