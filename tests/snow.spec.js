import { test, expect } from '@playwright/test';

test('snow works across routes and remembers off after reload', async ({ page }) => {
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(page.locator('.site-snow i')).toHaveCount(24);
  await nav.getByRole('button', { name: 'Snow On', exact: true }).click();
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await nav.getByRole('link', { name: 'Music', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Snow Off' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await nav.getByRole('button', { name: 'Snow Off', exact: true }).click();
  for (const label of ['Home', 'FREE Santa Message', 'Mug Shots']) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('.site-snow i')).toHaveCount(24);
    await expect(page.locator('.site-snow')).toHaveCSS('pointer-events', 'none');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.site-snow')).toBeHidden();
});
