import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })));
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`290 destinations, regional browsing and searchable itinerary at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker');
    await expect(page.locator('.tracker-map [data-stop-id]')).toHaveCount(290);
    await expect(page.locator('.tracker-hero')).toContainText('estimated 290-stop');
    await page.locator('.tj-toolbar').getByRole('button', { name: 'World', exact: true }).click();
    await expect(page.locator('.tj-legend')).toContainText('World · 290 stops');
    await page.getByLabel('Browse a region', { exact: true }).selectOption('Australia');
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'Australia');
    await expect(page.locator('.tj-minimap')).toBeVisible();
    expect(await page.locator('.tj-camera').evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
    await page.getByLabel('Browse a region', { exact: true }).selectOption('Pacific');
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'Pacific');
    await page.locator('.tj-toolbar').getByRole('button', { name: 'World', exact: true }).click();
    await expect(page.locator('.tj-minimap')).toHaveCount(0);
    const timeline = page.getByRole('list', { name: /estimated journey timeline/ });
    await expect(timeline.getByRole('listitem')).toHaveCount(290);
    await page.getByLabel('Search destinations').fill('Queenstown');
    await expect(timeline.getByRole('listitem')).toHaveCount(1);
    await expect(timeline).toContainText('Queenstown');
    await page.getByLabel('Search destinations').fill('');
    await page.getByLabel('Filter by region').selectOption('Australia');
    await expect(timeline.getByRole('listitem')).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await timeline.evaluate(el => el.clientHeight)).toBeLessThanOrEqual(500);
  });

  test(`preview follows separate city visits and returns to public date at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker/preview');
    const toggle = page.getByRole('switch', { name: 'Preview mode' });
    await toggle.click();
    const jump = page.getByLabel('Jump to destination', { exact: true });
    await expect(jump.locator('option')).toHaveCount(291);
    for (const city of ['sydney', 'tokyo', 'london', 'newyork', 'amundsenscottsouthpolestation', 'honolulu']) {
      await jump.selectOption(`city:${city}`);
      await expect(page.locator(`.tracker-map [data-stop-id="${city}"]`)).toHaveAttribute('data-active', 'true');
      await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
      await expect(page.locator('.tj-camera')).not.toHaveAttribute('data-camera-width', '1000');
      await expect(page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.tj-toolbar')).toContainText('Estimated live');
      await expect(page.locator('.tj-tl-list [data-current="true"]')).toHaveCount(1);
      if (city === 'amundsenscottsouthpolestation') {
        await expect.poll(async () => page.locator('.tj-santa').evaluate(el => {
          const santa = el.getBoundingClientRect();
          const canvas = el.closest('svg').getBoundingClientRect();
          return santa.top >= canvas.top && santa.bottom <= canvas.bottom;
        })).toBe(true);
      }
    }
    await page.getByRole('button', { name: 'Preview Controls' }).click();
    await page.locator('.tj-toolbar').getByRole('button', { name: 'World', exact: true }).click();
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
    await expect(page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true }).click();
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
    await expect(page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/santa-tracker');
    await expect(page.locator('.tracker-preview-panel')).toHaveCount(0);
    await expect(page.locator('.tj-legend')).toContainText("Santa's position");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const [date, status] of [
  ['2026-03-15T12:00:00Z', /On Holiday in/],
  ['2026-07-15T12:00:00Z', /Christmas in July/],
  ['2026-11-15T12:00:00Z', /Prepping the route/],
  ['2026-12-23T12:00:00Z', /Preparing for Takeoff/],
  ['2026-12-25T12:00:00Z', /Journey Complete/],
]) {
  test(`Follow Santa selects a close, non-live camera on ${date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/santa-tracker');
    await expect(page.locator('.tracker-status')).toContainText(status);

    const toolbar = page.locator('.tj-toolbar');
    const follow = toolbar.getByRole('button', { name: 'Follow Santa', exact: true });
    await expect(follow).toBeEnabled();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');

    await toolbar.getByRole('button', { name: 'World', exact: true }).click();
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    const region = page.getByLabel('Browse a region', { exact: true });
    if (date === '2026-07-15T12:00:00Z' || date === '2026-12-25T12:00:00Z') {
      await region.selectOption('Australia');
    }
    await follow.click();

    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-camera-width', '200');
    await expect(page.locator('.tj-minimap')).toBeVisible();
    await expect(toolbar.locator('.tj-live')).toHaveCount(0);
    await expect(page.locator('.tj-legend')).toContainText("Santa's position");
    await expect(page.locator('.tracker-map-caption')).toContainText(/represented position|holiday location|Route research/);

    const marker = page.locator('.tj-santa text');
    const map = page.locator('.tracker-map > div > svg[role="img"]');
    await expect.poll(async () => {
      const markerBox = await marker.boundingBox();
      const mapBox = await map.boundingBox();
      if (!markerBox || !mapBox) return Infinity;
      return Math.max(
        Math.abs(markerBox.x + markerBox.width / 2 - (mapBox.x + mapBox.width / 2)),
        Math.abs(markerBox.y + markerBox.height / 2 - (mapBox.y + mapBox.height / 2)),
      );
    }).toBeLessThan(20);
  });
}

test('two-minute preview reaches all 290 stops and resets without leaking onto the public tracker', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') });
  await page.goto('/santa-tracker/preview');
  await page.getByRole('switch', { name: 'Preview mode' }).click();
  await page.getByRole('button', { name: '2min', exact: true }).click();
  await page.clock.fastForward(120000);
  await expect(page.locator('.tracker-status')).toContainText('Journey Complete');
  await expect(page.locator('main')).toContainText('290/290');
  await page.getByRole('button', { name: 'Reset to Real Time', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Preview mode' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.tj-toolbar')).not.toContainText('Estimated live');
});
