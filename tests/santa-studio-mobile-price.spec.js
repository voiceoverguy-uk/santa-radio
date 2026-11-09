import { test, expect } from '@playwright/test';

for (const path of ['/', '/free-santa-message']) {
  test(`mobile gift dropdown and price share a row on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.route('**/api/santa-studio-checkout', route => route.fulfill({
      status: 503, json: { available: false },
    }));
    await page.goto(path);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const promotion = page.locator('.santa-studio-promotion');
    const toggle = promotion.getByRole('button', { name: 'Free gifts include' });
    const price = promotion.locator('.santa-studio-promotion__mobile-price');
    await expect(price).toContainText('£6.50');
    await expect(price).toContainText('for 2 messages');
    await page.evaluate(() => document.fonts.ready);

    for (const [width, textSize] of [[320, 100], [390, 100], [767, 100], [320, 200], [390, 200]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; }, textSize);
      await expect(price).toBeVisible();
      await expect(toggle).toBeVisible();
      for (const expanded of [true, false]) {
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', String(expanded));
        const boxes = await promotion.evaluate(root => {
          const toggle = root.querySelector('.santa-studio-promotion__gift-toggle').getBoundingClientRect();
          const price = root.querySelector('.santa-studio-promotion__mobile-price').getBoundingClientRect();
          return {
            sameRow: Math.abs((toggle.top + toggle.bottom) / 2 - (price.top + price.bottom) / 2) <= 1,
            separated: toggle.right <= price.left,
            fits: root.scrollWidth <= root.clientWidth + 1,
          };
        });
        expect(boxes).toEqual({ sameRow: true, separated: true, fits: true });
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(price).toBeHidden();
      await expect(toggle).toBeHidden();
      await expect(promotion.locator('.santa-studio-promotion__offer-price')).toBeVisible();
      await expect(promotion.locator('.santa-studio-promotion__gift-content')).toBeVisible();
    }
  });
}
