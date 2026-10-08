import { test, expect } from '@playwright/test';

test('navigation and footer use the same optimised gold logo', async ({ page, request }) => {
  const asset = await request.get('/images/santa-radio-gold-nav.webp');
  expect(asset.ok()).toBe(true);
  expect(asset.headers()['content-type']).toContain('image/webp');
  expect((await asset.body()).length).toBeLessThan(40000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const logo = page.locator('.navbar-logo-image');
  await expect(logo).toHaveAttribute('src', '/images/santa-radio-gold-nav.webp');
  const footerLogo = page.locator('.brand-logo-footer');
  await expect(footerLogo).toHaveAttribute('src', '/images/santa-radio-gold-nav.webp');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate(img => img.complete && img.naturalWidth === 630 && img.naturalHeight === 188)).toBe(true);
    const box = await logo.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.width / box.height).toBeCloseTo(630 / 188, 1);
    await expect.poll(() => footerLogo.evaluate(img => img.complete && img.naturalWidth === 630 && img.naturalHeight === 188)).toBe(true);
    const footerBox = await footerLogo.boundingBox();
    expect(footerBox.x).toBeGreaterThanOrEqual(0);
    expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(width);
    expect(footerBox.width).toBeLessThanOrEqual(280);
    if (width >= 768) expect(footerBox.width).toBe(280);
    expect(footerBox.width / footerBox.height).toBeCloseTo(630 / 188, 1);
    if (width === 1280) await page.locator('.footer').screenshot({ path: '/tmp/santa-radio-footer-gold.png' });
  }
});
