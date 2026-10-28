import { test, expect } from '@playwright/test';

const artwork = '/artist-artwork/greg-lake.webp';
const songPage = '/christmas-artist/42-greg-lake-i-believe-in-father-christmas';

async function expectArtwork(image) {
  await expect(image).toHaveAttribute('src', artwork);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(el =>
    el.complete && el.naturalWidth === 640 && el.naturalHeight === 640)).toBe(true);
  const square = await image.evaluate(el => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const width = box.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    const height = box.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);
    return Math.abs(width - height) <= 1;
  });
  expect(square).toBe(true);
}

for (const width of [1280, 390]) {
  test(`Greg Lake shared illustration appears on listing, song and live player at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.load = function () {};
      HTMLMediaElement.prototype.pause = function () {};
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    });
    await page.route('**/api/radio-metadata*', route => route.fulfill({
      json: {
        current: { artist: 'Greg Lake', title: 'I Believe In Father Christmas' },
        currentStatus: 'ready', upcoming: [], upcomingStatus: 'ready',
      },
    }));
    await page.goto(songPage, { waitUntil: 'domcontentloaded' });
    const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await reject.isVisible()) await reject.click();
    await expectArtwork(page.locator('.song-detail-artwork img'));
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      await expect(page.locator(selector)).toHaveAttribute('content', `https://www.santaradio.co.uk${artwork}`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/christmas-music');
    const search = page.getByPlaceholder('Search for a song or artist');
    await search.fill('Greg Lake');
    await expectArtwork(page.locator(`a.song-card[href="${songPage}"] img`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await search.fill('Wham!');
    await expect(page.locator('a.song-card img').first()).toHaveAttribute('src', '/artist-artwork/wham.webp');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
    await expectArtwork(page.locator('.now-playing-artwork img'));
    await expect(page.locator('.now-playing-artwork a')).toHaveAttribute('href', songPage);
  });
}
