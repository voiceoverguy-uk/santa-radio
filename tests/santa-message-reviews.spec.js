import { test, expect } from '@playwright/test';

const reviews = [
  ['So fun and so simple to use', 'Karen, West Yorkshire'],
  ['Kids loved it. I still can’t believe how easy it was', 'Michael, Redruth'],
  ['My daughter loved it, thank you. She wanted to know how Santa knew about her swimming', 'Darren, Wimbledon'],
  ['Ho Ho Ho! Merry Christmas. Thanks.', 'Susan, Wakefield'],
  ['A proper treat, not seen anything like this. Super Easy.', 'Paul, Tadely, Berkshire'],
];

for (const width of [390, 1440]) {
  test(`Santa reviews rotate every ten seconds without moving the layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const region = page.getByRole('region', { name: 'Customer reviews', exact: true });
    await region.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const active = region.locator('blockquote:visible');
    await expect(active).toHaveCount(1);
    await expect(active).toContainText(reviews[0][0]);
    await expect(region.getByLabel('5 out of 5 stars')).toBeVisible();
    expect(await region.locator('svg').count()).toBeGreaterThanOrEqual(5);
    const initial = await region.boundingBox();
    const promotion = await page.locator('.santa-studio-promotion').boundingBox();
    expect(initial.y).toBeGreaterThanOrEqual(promotion.y + promotion.height);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    // Restart the timer at a known point before checking the exact interval.
    await region.getByRole('button', { name: 'Pause reviews', exact: true }).click();
    await region.getByRole('button', { name: 'Resume reviews', exact: true }).click();
    const currentText = await active.textContent();
    await page.clock.runFor(9999);
    expect(await active.textContent()).toBe(currentText);
    await page.clock.runFor(1);
    expect(await active.textContent()).not.toBe(currentText);
    for (let index = 1; index <= 5; index++) {
      await expect(active).toHaveCount(1);
      await expect(active).toContainText(reviews[index % 5][0]);
      await expect(region.locator('.santa-message-reviews__current')).toContainText(reviews[index % 5][1]);
      const bounds = await region.boundingBox();
      expect(Math.abs(bounds.height - initial.height)).toBeLessThan(1);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await page.clock.runFor(10000);
    }
    await region.getByRole('button', { name: 'Pause reviews', exact: true }).click();
    const paused = await active.textContent();
    await page.clock.runFor(30000);
    expect(await active.textContent()).toBe(paused);
    await region.getByRole('button', { name: 'Resume reviews', exact: true }).click();
    await page.clock.runFor(10000);
    expect(await active.textContent()).not.toBe(paused);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
