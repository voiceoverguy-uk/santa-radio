import { test, expect } from '@playwright/test';

test('native policy is public, scoped and links to existing contact and website policy', async ({ page }) => {
  const response = await page.goto('/santa-tracker/privacy');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Santa Tracker privacy policy');
  await expect(page).toHaveTitle('The Santa Tracker iOS App Privacy Policy | Santa Radio');
  const article = page.getByRole('article');
  await expect(article).toContainText('The Santa Tracker by Santa Radio');
  await expect(article).toContainText('not collection of those settings by Santa Radio');
  await expect(article).toContainText('does not send your tracker activity to Santa Radio');
  await expect(article.getByRole('link', { name: 'Santa Radio website privacy policy', exact: true })).toHaveAttribute('href', '/privacy-policy');
  const contact = article.getByRole('link', { name: 'Santa Radio general enquiry contact form' });
  await expect(contact).toHaveAttribute('href', '/submit-a-song?mode=general');
  await contact.click();
  await expect(page).toHaveURL(/\/submit-a-song\?mode=general$/);
  await expect(page.getByRole('main')).toBeVisible();
});

test('tracker page links to the native app policy and policy fits phone widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/santa-tracker');
  const link = page.getByRole('link', { name: 'native iOS app privacy policy', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/santa-tracker\/privacy$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByRole('article').getByRole('link', { name: 'Santa Radio website privacy policy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
