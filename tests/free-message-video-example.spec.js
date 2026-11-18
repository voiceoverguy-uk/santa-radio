import { test, expect } from '@playwright/test';
for (const width of [390, 1280]) {
  test(`free page leads with a playable example at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const events = [];
    await page.route('**/api/santa-message-access', route => route.fulfill({ json: { authorized: false } }));
    await page.route('**/api/message-statistics', route => { events.push(route.request().postData()); return route.fulfill({ json: { ok: true } }); });
    await page.goto('/free-santa-message');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const video = page.getByLabel('Play an example Santa video message for Harry');
    await expect(video).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(100);
    const preview = await video.boundingBox(), form = await page.locator('.santa-message-box').boundingBox();
    expect(preview.y).toBeLessThan(form.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await video.evaluate(el => el.play());
    await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(0);
    await video.evaluate(el => el.pause());
    expect(events).toHaveLength(0);
    await page.screenshot({ path: `/tmp/free-video-example-${width}.png` });
  });
}
