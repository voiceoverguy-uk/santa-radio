import { test, expect } from '@playwright/test';

test('player minimises, stays small while browsing, and restores without audio interruption', async ({ page }) => {
  await page.route('**/api/radio-metadata', route => route.fulfill({ json: {
    current: { artist: 'Elton John', title: 'Step Into Christmas' },
    currentStatus: 'ready', upcomingStatus: 'ready', upcoming: [],
  } }));
  await page.goto('/apps');
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock).toContainText('Step Into Christmas');
  const originalHeight = (await dock.boundingBox()).height;
  await page.evaluate(() => {
    window.savedAudio = document.querySelector('audio');
    window.mediaCalls = [];
    for (const method of ['pause', 'play', 'load']) {
      window.savedAudio[method] = () => { window.mediaCalls.push(method); return Promise.resolve(); };
    }
  });
  await dock.getByRole('button', { name: 'Minimise radio player' }).click();
  await expect(dock.getByRole('slider')).toBeHidden();
  await expect(dock.getByRole('button', { name: 'Coming up' })).toBeHidden();
  await expect(dock.getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
  expect((await dock.boundingBox()).height).toBeLessThan(originalHeight / 2);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Music', exact: true }).click();
  await expect(dock.getByRole('button', { name: 'Expand radio player' })).toBeVisible();
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.mediaCalls)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(dock.getByRole('button', { name: 'Expand radio player' })).toBeVisible();
  await dock.getByRole('button', { name: 'Expand radio player' }).focus();
  await page.keyboard.press('Enter');
  await expect(dock.getByRole('slider', { name: 'Radio volume' })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Minimise radio player' })).toBeFocused();
});
