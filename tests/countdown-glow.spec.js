import { test, expect } from '@playwright/test';

test('homepage and tracker countdowns glow on mouse hover without changing layout', async ({ page }) => {
  for (const [path, selector] of [['/', '.hero-countdown .countdown-unit'], ['/santa-tracker', '.tracker-countdown-unit']]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const tile = page.locator(selector).first();
    const before = await tile.boundingBox();
    const border = await tile.evaluate(element => getComputedStyle(element).borderTopColor);
    await tile.hover();
    await expect(tile).not.toHaveCSS('box-shadow', 'none');
    await expect(tile).not.toHaveCSS('border-top-color', border);
    const after = await tile.boundingBox();
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
    await page.mouse.move(0, 0);
    await expect(tile).toHaveCSS('box-shadow', 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(tile).toHaveCSS('transition-duration', '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
});

test('touch countdown tiles do not retain a hover glow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    for (const [path, selector] of [['/', '.hero-countdown .countdown-unit'], ['/santa-tracker', '.tracker-countdown-unit']]) {
      await page.goto(`${test.info().project.use.baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      const tile = page.locator(selector).first();
      await tile.tap();
      await expect(tile).toHaveCSS('box-shadow', 'none');
    }
  } finally {
    await context.close();
  }
});
