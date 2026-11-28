import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) test(`artist backgrounds search, save, reload and navigate at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => sessionStorage.setItem('santa-radio-black-friday-2026-seen', '1'));
  const artists = [
    { key: 'john legend', artist: 'John Legend', text: 'John original', revision: 0, songCount: 2 },
    { key: 'relient k', artist: 'Relient K', text: 'Relient original', revision: 0, songCount: 1 },
    { key: 'sia', artist: 'Sia', text: 'Sia original', revision: 0, songCount: 4 },
  ];
  let fail = false;
  await page.route('**/api/**', r => r.fulfill({ status: 503, json: { error: 'Not used by this test' } }));
  await page.route('**/api/message-statistics*', r => r.fulfill({ json: { names: [], daily: [], votes: [], requests: [], tasks: [], reviews: [], vouchers: [], allTime: { creations: 0, downloads: 0, listens: 0, shares: 0 } } }));
  await page.route('**/api/artist-backgrounds*', async r => {
    if (r.request().method() === 'POST') {
      if (fail) return r.fulfill({ status: 503, json: { error: 'Save failed. Please try again.' } });
      const body = r.request().postDataJSON();
      const row = artists.find(a => a.key === body.key);
      row.text = body.text.trim(); row.revision++;
      return r.fulfill({ json: row });
    }
    return r.fulfill({ json: r.request().url().includes('edit=1') ? { artists } : { backgrounds: Object.fromEntries(artists.map(a => [a.key, a.text])) } });
  });
  await page.goto('/santa-dashboard#artist-backgrounds');
  const cookies = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await cookies.isVisible()) await cookies.click();
  await page.getByLabel('Private Studio owner token').fill('test-token');
  await page.getByRole('button', { name: 'Open dashboard', exact: true }).click();
  const editor = page.locator('.artist-background-editor');
  await expect(editor.getByRole('heading', { name: 'John Legend', exact: true })).toBeVisible();
  await page.getByLabel('Find an artist').fill('relie');
  await editor.getByRole('button', { name: 'Relient K', exact: true }).click();
  const text = page.getByLabel('Artist background', { exact: true });
  await text.fill('Relient corrected background.');
  fail = true;
  await editor.getByRole('button', { name: 'Save background', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Save failed');
  await expect(text).toHaveValue('Relient corrected background.');
  fail = false;
  await editor.getByRole('button', { name: 'Save background', exact: true }).click();
  await expect(editor).toContainText('Saved for Relient K');
  await editor.getByRole('button', { name: 'Next artist' }).click();
  await expect(text).toHaveValue('Sia original');
  await text.fill('Unsaved draft');
  page.once('dialog', d => d.dismiss());
  await editor.getByRole('button', { name: 'Previous artist' }).click();
  await expect(text).toHaveValue('Unsaved draft');
  page.once('dialog', d => d.accept());
  await editor.getByRole('button', { name: 'Previous artist' }).click();
  await expect(text).toHaveValue('Relient corrected background.');
  await editor.getByRole('button', { name: 'Reload saved text' }).click();
  await expect(text).toHaveValue('Relient corrected background.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/private/tmp/santa-background-editor-${width}.png`, fullPage: true });
  await page.goto('/christmas-artist/142-relient-k-sleigh-ride');
  await expect(page.locator('.song-detail-info')).toContainText('Relient corrected background.');
});
