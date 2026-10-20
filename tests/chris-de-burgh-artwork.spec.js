import { test, expect } from '@playwright/test';

const artwork = '/artist-artwork/chris-de-burgh.webp';
const songPage = '/christmas-artist/61-chris-de-burgh-a-spaceman-came-travelling';
const fallback = '/artist-artwork/santa-fallback.webp';

async function expectArtwork(image) {
  await expect(image).toHaveAttribute('src', artwork);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(el =>
    el.complete && el.naturalWidth === 640 && el.naturalHeight === 640)).toBe(true);
  const square = await image.evaluate(el => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return Math.abs(
      box.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth) -
      (box.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth)),
    ) <= 1;
  });
  expect(square).toBe(true);
}

async function visit(page, path) {
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
}

for (const width of [1280, 390]) {
  test(`Chris De Burgh illustration appears on the card and detail page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, songPage);
    await expectArtwork(page.locator('.song-detail-artwork img'));
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      await expect(page.locator(selector)).toHaveAttribute('content', `https://www.santaradio.co.uk${artwork}`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/christmas-music');
    await page.getByPlaceholder('Search for a song or artist').fill('Chris De Burgh');
    await expectArtwork(page.locator(`a.song-card[href="${songPage}"] img`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByPlaceholder('Search for a song or artist').fill('Wham!');
    await expect(page.locator('a.song-card img').first()).toHaveAttribute('src', '/artist-artwork/wham.webp');
  });

  test(`live Chris De Burgh illustration and image failure recovery work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.load = function () {};
      HTMLMediaElement.prototype.pause = function () {};
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    });
    await page.route('**/api/radio-metadata*', route => route.fulfill({
      json: {
        current: { artist: 'Chris De Burgh', title: 'A Spaceman Came Travelling' },
        currentStatus: 'ready', upcoming: [], upcomingStatus: 'ready',
      },
    }));
    await visit(page, '/');
    await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
    await expectArtwork(page.locator('.now-playing-artwork img'));
    await expect(page.locator('.now-playing-artwork a')).toHaveAttribute('href', songPage);
    // A fresh document and cache-disabled routing exercise a real image failure.
    await page.route(`**${artwork}`, route => route.abort());
    await page.goto(songPage, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-detail-artwork img');
    await expect(image).toHaveAttribute('src', fallback);
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  });
}
