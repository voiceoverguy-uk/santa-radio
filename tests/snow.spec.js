import { test, expect } from '@playwright/test';

test('snow works across routes and remembers off after reload', async ({ page }) => {
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const footer = page.getByRole('contentinfo');
  await expect(page.locator('.site-snow i')).toHaveCount(24);
  await expect(nav.getByRole('switch', { name: 'Snow', exact: true })).toHaveCount(0);
  await footer.getByRole('switch', { name: 'Snow', checked: true }).click();
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await nav.getByRole('link', { name: 'Music', exact: true }).click();
  await expect(footer.getByRole('switch', { name: 'Snow', exact: true })).not.toBeChecked();
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await footer.getByRole('switch', { name: 'Snow', checked: false }).click();
  for (const label of ['Home', 'FREE Santa Message', 'Mug Shots']) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('.site-snow i')).toHaveCount(24);
    await expect(page.locator('.site-snow')).toHaveCSS('pointer-events', 'none');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // A deliberate On choice continues to enable only snow under reduced motion.
  await expect(page.locator('.site-snow')).toBeVisible();
});
