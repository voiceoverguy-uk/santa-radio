import { test, expect } from '@playwright/test';

test('holiday postcards have a clearer location and no printed URL', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/santa-tracker');
    const location = page.getByText(/^Sent from /);
    await expect(location).toBeVisible();
    await expect(location.locator('..')).toHaveCSS('opacity', '0.7');
    await expect(page.getByText('santa-radio.replit.app/santa-tracker', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /share/i }).first()).toBeVisible();
    const footer = page.locator('footer');
    await expect(footer.locator('a[href*="festivestudio.co.uk"]')).toHaveCount(0);
    const snow = await footer.getByRole('switch', { name: 'Snow', exact: true }).boundingBox();
    const social = await footer.locator('.footer-social').boundingBox();
    expect(snow.y + snow.height / 2).toBeCloseTo(social.y + social.height / 2, 0);
    const copy = await footer.locator('.footer-copy').boundingBox();
    expect(copy.y).toBeGreaterThan(social.y + social.height);
  }
});
