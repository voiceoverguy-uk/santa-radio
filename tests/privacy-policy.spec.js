import { test, expect } from '@playwright/test';

test('footer opens a readable privacy policy without adding signup functionality', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.originalAudio = document.querySelector('audio'));
  await page.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  const article = page.locator('article');
  await expect(article).toContainText('VoiceoverGuy Ltd');
  await expect(article).toContainText('News signup is not yet available here.');
  await expect(article).toContainText('until you unsubscribe');
  await expect(article.getByRole('link', { name: 'santa@santaradio.co.uk' })).toHaveAttribute('href', 'mailto:santa@santaradio.co.uk');
  await expect(article.locator('form, input')).toHaveCount(0);
  expect(await page.evaluate(() => window.originalAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(article).toContainText('Your choices and rights');
});
