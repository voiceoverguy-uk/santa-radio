import { test, expect } from '@playwright/test';
for (const width of [390, 1280]) {
  test(`free page shows a compact playable example below the logo at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const events = [];
    await page.route('**/api/santa-message-access', route => route.fulfill({ json: { authorized: false } }));
    await page.route('**/api/message-statistics', route => { events.push(route.request().postData()); return route.fulfill({ json: { ok: true } }); });
    await page.goto('/free-santa-message');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const video = page.getByLabel(/Play an example Santa video message for (Charlotte|Arabella|Harry)/);
    await expect(video).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(100);
    const preview = await video.boundingBox(), logo = await page.locator('.message-free-logo').boundingBox();
    expect(preview.y).toBeGreaterThanOrEqual(logo.y + logo.height);
    expect(preview.width).toBeLessThanOrEqual(422);
    await expect(page.locator('.fsm-hero video')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await video.evaluate(el => el.play());
    await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(0);
    await video.evaluate(el => el.pause());
    expect(events).toHaveLength(0);
    const first = await video.getAttribute('src');
    await page.getByRole('button', { name: 'Another example' }).click();
    await expect(video).not.toHaveAttribute('src', first);
    const second = await video.getAttribute('src');
    await video.dispatchEvent('ended');
    await expect(video).not.toHaveAttribute('src', second);
    expect(await video.evaluate(el => el.paused)).toBe(true);
    await page.screenshot({ path: `/tmp/free-video-example-${width}.png` });
  });
}
