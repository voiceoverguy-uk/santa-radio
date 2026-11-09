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
  await expect(page).toHaveURL(/\/privacy-policy#santa-tracker-ios-privacy$/);
  await expect(page.getByRole('heading', { level: 2, name: 'The Santa Tracker — native iOS app', exact: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('main policy navigation opens the full native Tracker section', async ({ page }) => {
  await page.goto('/privacy-policy');
  const navigation = page.getByRole('navigation', { name: 'Privacy policy sections' });
  await navigation.getByRole('link', { name: 'The Santa Tracker iOS app', exact: true }).click();
  await expect(page).toHaveURL(/#santa-tracker-ios-privacy$/);
  const section = page.getByRole('region', { name: 'The Santa Tracker — native iOS app', exact: true });
  await expect(section).toBeVisible();
  await expect(page.locator('#santa-tracker-ios-privacy')).toBeFocused();
  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(5);
  await expect(section).toContainText('calculates the countdown, sleigh position and route estimates on your device');
  await expect(section).toContainText('does not send your tracker activity to Santa Radio');
  await expect(section).toContainText('no analytics, advertising or tracking SDK');
  await expect(section).toContainText('not collection of those settings by Santa Radio');
  await expect(section).toContainText('opens in your device’s browser');
  await expect(section.getByRole('link', { name: 'Santa Radio general enquiry contact form' })).toHaveAttribute('href', '/submit-a-song?mode=general');
  await expect(navigation.getByRole('link', { name: 'Naughty or Nice List Checker', exact: true })).toHaveAttribute('href', '#naughty-or-nice-checker-privacy');
});

test('direct main-policy section link survives reload on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/privacy-policy#santa-tracker-ios-privacy');
  expect(response.status()).toBe(200);
  const heading = page.locator('#santa-tracker-ios-privacy');
  await expect(heading).toBeFocused();
  await page.reload();
  await expect(heading).toBeFocused();
  await expect.poll(() => heading.evaluate(el => {
    const box = el.getBoundingClientRect();
    return box.top >= 70 && box.bottom <= innerHeight;
  })).toBe(true);
});
