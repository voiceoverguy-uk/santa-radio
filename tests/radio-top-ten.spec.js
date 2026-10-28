import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { artist: 'Leona Lewis', title: 'One More Sleep' }, currentStatus: 'ready',
    upcoming: [{ artist: 'Wham!', title: 'Last Christmas' }], upcomingStatus: 'ready',
    upcomingUpdatedAt: Date.now(),
  } }));
  // Exercise the audio lifecycle without depending on the external stream.
  await page.addInitScript(() => {
    window.audioCalls = { play: 0, pause: 0, load: 0 };
    for (const method of ['play', 'pause', 'load']) HTMLMediaElement.prototype[method] = function () {
      window.audioCalls[method]++;
      if (method === 'play') return Promise.resolve();
    };
  });
});

for (const [device, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 360, height: 740 }],
]) {
  test(`${device}: chart is absent with no gap and remaining player controls work`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let chartRequests = 0;
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/radio-top-ten') chartRequests++;
    });
    await page.goto('/christmas-music');
    await page.getByRole('button', { name: 'Decline optional cookies' }).click();
    const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
    if (device === 'mobile') {
      await expect(dock).toHaveClass(/is-minimized/);
      await dock.getByRole('button', { name: 'Expand radio player' }).click();
    }
    await expect(dock).not.toHaveClass(/is-minimized/);
    await expect(page.getByText(/Yesterday’s Top (10|Ten)/)).toHaveCount(0);
    await expect(page.locator('.radio-top-ten-trigger, .radio-top-ten-indicator, .top-ten-panel, #radio-yesterday-top-ten, .music-top-ten-callout')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Search for a song or artist' })).toBeVisible();
    const next = dock.getByRole('button', { name: 'Playing Next', exact: true });
    await expect(next).toBeVisible();
    // The last row ends at the dock's normal bottom padding, not an empty chart slot.
    const spacing = await dock.evaluate(el => {
      const style = getComputedStyle(el);
      const bottom = el.querySelector('.radio-upcoming-toggle').getBoundingClientRect().bottom;
      return {
        actual: el.getBoundingClientRect().bottom - bottom,
        expected: parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth),
        overflow: el.scrollWidth > el.clientWidth,
      };
    });
    expect(Math.abs(spacing.actual - spacing.expected)).toBeLessThan(2);
    expect(spacing.overflow).toBe(false);
    await page.screenshot({ path: `generated-artifacts/radio-without-chart-${device}.png` });

    await dock.getByRole('button', { name: 'Listen Live', exact: true }).click();
    await expect(dock.getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
    const before = await page.evaluate(() => {
      window.originalRadio = document.querySelector('audio');
      return window.audioCalls;
    });
    const volume = dock.getByRole('slider', { name: 'Radio volume' });
    await volume.fill('0.35');
    await expect(volume).toHaveValue('0.35');
    expect(await page.locator('audio').evaluate(el => el.volume)).toBeCloseTo(0.35);
    await next.click();
    const queue = dock.getByRole('region', { name: 'Playing Next on Santa Radio' });
    await expect(queue).toContainText('Last Christmas');
    await expect(next).toHaveAttribute('aria-expanded', 'true');
    await dock.getByRole('button', { name: 'Lyrics', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Live lyrics' })).toBeVisible();
    await page.getByRole('button', { name: 'Close lyrics' }).click();
    await dock.getByRole('button', { name: 'Minimise radio player' }).click();
    await expect(queue).toBeHidden();
    await dock.getByRole('button', { name: 'Expand radio player' }).click();
    await expect(queue).toBeVisible();
    await next.click();
    await expect(queue).toBeHidden();
    expect(await page.evaluate(() => window.audioCalls)).toEqual(before);
    expect(await page.evaluate(() => window.originalRadio === document.querySelector('audio'))).toBe(true);
    await dock.getByRole('button', { name: 'Pause Radio', exact: true }).click();
    await expect(dock.getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.audioCalls.pause)).toBeGreaterThan(before.pause);
    expect(chartRequests).toBe(0);
  });
}

test('development endpoint supplies inactive chart and unchanged metadata contract', async ({ request }) => {
  const response = await request.get('/api/radio-top-ten');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toMatchObject({ state: 'inactive', songs: [] });
  expect((await request.post('/api/radio-top-ten')).status()).toBe(405);
});
