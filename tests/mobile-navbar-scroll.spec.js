import { test, expect } from '@playwright/test';

async function setUp(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
  });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

test('mobile navigation hides on downward scroll and returns on upward scroll', async ({ page }) => {
  await setUp(page, 390);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);
  expect(await nav.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(11, 37, 30, 0.9)');

  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(40);
  await expect(nav).toHaveClass(/is-scroll-hidden/);
  await page.mouse.wheel(0, -80);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(240);
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);

  await nav.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(nav.locator('#main-menu')).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 160, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(160);
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);
});

test('desktop navigation stays visible while scrolling', async ({ page }) => {
  await setUp(page, 1440);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(40);
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);
  await expect(nav.locator('.navbar-links')).toBeVisible();
});

test('slimmer navigation covers the full viewport through phone rotation', async ({ page }) => {
  await setUp(page, 390);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [width, height] of [[390, 844], [844, 390], [932, 430], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => nav.evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(61);
    const bounds = await nav.boundingBox();
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBe(width);
    await expect(nav).toHaveCSS('background-color', 'rgba(11, 37, 30, 0.9)');
    for (const control of [nav.locator('.hamburger'), nav.locator('.nav-radio-icon')]) {
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await nav.getByRole('button', { name: 'Open menu', exact: true }).click();
    await expect(nav.locator('#main-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await nav.locator('.hamburger').evaluate(el => el.blur());
    await page.mouse.wheel(0, 160);
    await expect(nav).toHaveClass(/is-scroll-hidden/);
    await page.mouse.wheel(0, -80);
    await expect(nav).not.toHaveClass(/is-scroll-hidden/);
  }
});
