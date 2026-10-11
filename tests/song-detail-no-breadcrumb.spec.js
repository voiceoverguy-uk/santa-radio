import { test, expect } from '@playwright/test';

test('song pages omit the path trail while retaining the title and back link', async ({ page, request }) => {
  const path = '/christmas-artist/551-cher-dj-play-a-christmas-song';
  const response = await request.get(path);
  expect(response.ok()).toBe(true);
  expect(await response.text()).not.toContain('class="seo-breadcrumbs"');
  await page.route('**/*youtube.com/**', route => route.abort());
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('DJ Play a Christmas Song');
  await expect(page.getByRole('link', { name: '← Back to Christmas Music' })).toHaveAttribute('href', '/christmas-music');
});
