import { test, expect } from '@playwright/test';

async function sampleFlight(page, time) {
  return page.locator('.santa-flyby-silhouette').evaluate((el, time) => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = time;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, opacity: Number(getComputedStyle(el).opacity) };
  }, time);
}

test('a distant decorative Santa crosses the unchanged hero every ten seconds', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const overlay = page.locator('.santa-flyby');
  const silhouette = page.locator('.santa-flyby-silhouette');
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(overlay).toHaveCSS('pointer-events', 'none');
  await expect(silhouette).toHaveAttribute('focusable', 'false');
  await expect(silhouette).toHaveCSS('animation-duration', '10s');
  await expect(silhouette).toHaveCSS('animation-iteration-count', 'infinite');
  const heading = await page.locator('.hero-title').boundingBox();
  const eyebrow = await page.locator('.hero .eyebrow').boundingBox();
  const before = await sampleFlight(page, 2500);
  const during = await sampleFlight(page, 4500);
  expect(during.x).toBeGreaterThan(before.x + 100);
  expect(during.opacity).toBeGreaterThan(.5);
  expect(during.width).toBeLessThan(200);
  expect(during.y + during.height).toBeLessThan(heading.y);
  expect(during.y + during.height).toBeLessThan(eyebrow.y);
  await expect(page.locator('.hero-picture img')).toHaveAttribute('src', '/images/north-pole-hero.webp');
  await page.screenshot({ path: '/tmp/santa-flyby-desktop.png' });
  const gap = await sampleFlight(page, 9500);
  expect(gap.opacity).toBe(0);
  const repeat = await sampleFlight(page, 14500);
  expect(repeat.x).toBeCloseTo(during.x, 1);
  expect(repeat.opacity).toBeCloseTo(during.opacity, 1);
  // Resuming proves it really moves, rather than being just a static overlay.
  await silhouette.evaluate(el => el.getAnimations()[0].play());
  const transform = await silhouette.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => silhouette.evaluate(el => getComputedStyle(el).transform)).not.toBe(transform);
});

test('the small mobile silhouette stays above the heading without overflow', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('.santa-flyby-silhouette')).toHaveCSS('animation-duration', '10s');
    const during = await sampleFlight(page, 4500);
    const heading = await page.locator('.hero-title').boundingBox();
    const eyebrow = await page.locator('.hero .eyebrow').boundingBox();
    expect(during.width).toBeLessThan(115);
    expect(during.y + during.height).toBeLessThan(heading.y);
    expect(during.y + during.height).toBeLessThan(eyebrow.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: '/tmp/santa-flyby-mobile.png' });
  }
});

test('Snow Off hides the flyby and reduced motion never enables it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.santa-flyby')).toBeVisible();
  await page.locator('.effects-toggle').click();
  await expect(page.locator('.santa-flyby')).toBeHidden();
  await page.locator('.effects-toggle').click();
  await expect(page.locator('.santa-flyby')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.santa-flyby')).toBeHidden();
  await expect(page.locator('.site-snow')).toBeVisible();
  await expect(page.locator('.santa-flyby-silhouette')).toHaveCSS('animation-name', 'none');
  await page.goto('/apps');
  await expect(page.locator('.santa-flyby')).toHaveCount(0);
});
