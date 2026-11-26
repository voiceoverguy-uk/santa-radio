import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`upcoming songs wait for a transition and share estimates across pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() => {
      sessionStorage.setItem('santa-radio-black-friday-2026-seen', '1');
      HTMLMediaElement.prototype.play = async function () {};
      HTMLMediaElement.prototype.load = function () {};
      HTMLMediaElement.prototype.pause = function () {};
    });
    let current = { artist: 'Coldplay', title: 'Christmas Lights' };
    const upcoming = [
      { artist: 'Paul McCartney', title: 'Wonderful Christmastime' },
      { artist: 'Sammy Davis Jr.', title: 'Jingle Bells' },
      { artist: 'Norah Jones', title: 'Peace' },
    ];
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Unavailable in radio test' } }));
    await page.route('**/api/radio-metadata?*', route => route.fulfill({ json: {
      current, currentStatus: 'ready', upcoming, upcomingStatus: 'ready', upcomingUpdatedAt: Date.now(),
    } }));
    await page.goto('/');
    await page.locator('.hero-actions button').click();
    const list = page.locator('.home-upcoming');
    await expect(list.locator('li')).toHaveCount(3);
    await expect(list.locator('time')).toHaveCount(0);
    current = { artist: 'Leona Lewis', title: 'One More Sleep' };
    await expect(list.locator('time')).toHaveCount(3, { timeout: 12000 });
    const time = (await list.locator('time').first().textContent()).replace('approx. ', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/private/tmp/santa-upcoming-${width}.png`, fullPage: false });
    if (width > 900) {
      await page.locator('nav a[href="/christmas-music"]').first().click();
      await expect(page.locator('.song-card-upcoming')).toHaveCount(3);
      await expect(page.locator('.song-card-upcoming').first()).toContainText(`Expected at ${time}`);
      await page.screenshot({ path: '/private/tmp/santa-upcoming-music.png', fullPage: false });
    }
  });
}
