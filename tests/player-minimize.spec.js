import { test, expect } from '@playwright/test';

test('Listen Live expands the compact player then returns to compact after ten idle seconds', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('radio-minimized', 'true');
    HTMLMediaElement.prototype.play = function () {
      window.radioPlayCalls = (window.radioPlayCalls || 0) + 1;
      return Promise.resolve();
    };
  });
  await page.clock.install({ time: new Date('2026-10-07T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-07T00:00:01Z'));
  await page.goto('/');
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock).toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(dock).not.toHaveClass(/is-minimized/);
  await expect(dock.getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await expect(dock.locator('.radio-station')).toHaveText('SANTA RADIO LIVE');
  await expect(dock.locator('.radio-dock-track .radio-tracks-label')).toHaveCount(0);
  await expect(dock.locator('.radio-caption')).toHaveCount(0);
  await page.clock.runFor(9000);
  await expect(dock).not.toHaveClass(/is-minimized/);
  await page.clock.runFor(1000);
  await expect(dock).toHaveClass(/is-minimized/);
  await expect(dock.getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  expect(await page.evaluate(() => window.radioPlayCalls)).toBe(1);
  await dock.getByRole('button', { name: 'Pause Radio' }).click();
  await expect(dock).toHaveClass(/is-minimized/);
});

test('auto minimises after ten idle seconds, resets on interaction and protects lyrics', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install({ time: new Date('2026-10-07T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-07T00:00:01Z'));
  await page.goto('/');
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await page.evaluate(() => window.savedAudio = document.querySelector('audio'));
  await page.clock.runFor(9000);
  await expect(dock).not.toHaveClass(/is-minimized/);
  await dock.dispatchEvent('pointermove');
  await page.clock.runFor(9000);
  await expect(dock).not.toHaveClass(/is-minimized/);
  await page.clock.runFor(1000);
  await expect(dock).toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Expand radio player' }).click();
  await page.clock.runFor(10000);
  await expect(dock).toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Expand radio player' }).click();
  await dock.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await page.clock.runFor(20000);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(dock).not.toHaveClass(/is-minimized/);
  await page.getByRole('button', { name: 'Close lyrics' }).click();
  await page.locator('h1').click();
  await page.clock.runFor(10000);
  await expect(dock).toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Expand radio player' }).click();
  await dock.getByRole('slider').focus();
  await page.keyboard.press('ArrowLeft');
  await page.clock.runFor(20000);
  await expect(dock).not.toHaveClass(/is-minimized/);
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
});

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
