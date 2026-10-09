import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`footer is compact and links to the correct social profiles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/christmas-artist/not-found', { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.locator('img')).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Facebook', exact: true })).toHaveAttribute('href', 'https://www.facebook.com/santaradiouk');
    await expect(footer.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/santaradiouk/');
    await expect(footer.getByRole('link', { name: 'Twitter', exact: true })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Privacy Policy', exact: true })).toBeVisible();
    expect((await footer.boundingBox()).height).toBeLessThan(width === 1280 ? 180 : 280);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
