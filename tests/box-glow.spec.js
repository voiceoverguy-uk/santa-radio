import { test, expect } from '@playwright/test';

const surfaces = [
  ['/', ['.radio-dock', '.santa-message-box', '.tv-frame', '.mug-card', '.tracker-card']],
  ['/christmas-music', ['.song-card']],
  ['/mugshots/all', ['.mugshot-card']],
  ['/links', ['.partner-card']],
  ['/privacy-policy', ['.privacy-content']],
  ['/santa-tracker', ['.tracker-card', '.tracker-story-card']],
];

for (const [path, selectors] of surfaces) {
  test(`boxed panels glow on hover without resizing on ${path}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    for (const selector of selectors) {
      const surface = page.locator(selector).first();
      await expect(surface).toBeVisible();
      await page.mouse.move(0, 0);
      const before = await surface.boundingBox();
      const restingShadow = await surface.evaluate(el => getComputedStyle(el).boxShadow);
      await surface.hover();
      await expect(surface).toHaveCSS('border-top-color', 'rgb(230, 206, 134)');
      await expect.poll(() => surface.evaluate(el => getComputedStyle(el).boxShadow)).toContain('16px 3px');
      const after = await surface.boundingBox();
      expect(after.width).toBeCloseTo(before.width, 1);
      expect(after.height).toBeCloseTo(before.height, 1);
      if (path === '/apps') await surface.screenshot({ path: '/tmp/app-box-gold-glow.png' });
      await page.mouse.move(0, 0);
      await expect(surface).toHaveCSS('box-shadow', restingShadow);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(surface).toHaveCSS('transition-duration', '0s');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
  });
}

test('interactive song cards keep keyboard focus and gain the gold glow', async ({ page }) => {
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.song-card').first();
  await card.focus();
  await expect(card).toBeFocused();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).boxShadow)).toContain('16px 3px');
});

test('unboxed app feature descriptions stay passive on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(`${test.info().project.use.baseURL}/apps`, { waitUntil: 'domcontentloaded' });
    const feature = page.locator('.feature-item').first();
    await expect(feature).toBeVisible();
    await feature.tap();
    await expect(feature).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(feature).toHaveCSS('border-top-style', 'none');
    await expect(feature).toHaveCSS('box-shadow', 'none');
    expect(await feature.getAttribute('tabindex')).toBeNull();
    expect(await feature.getAttribute('role')).toBeNull();
    await expect(feature).not.toHaveCSS('cursor', 'pointer');
  } finally {
    await context.close();
  }
});
