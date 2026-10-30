import { test, expect } from '@playwright/test';
import songs from '../src/data/songs.json' with { type: 'json' };
import { exactSongArtwork, observedLivePairs } from '../scripts/fixtures/exact-song-artwork.js';
import { songPath } from '../src/seo/catalogue.js';
import { artistArtwork } from '../src/data/artistArtwork.js';

async function prepare(page) {
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
}

async function loaded(image, path) {
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
}

for (const width of [1280, 390]) {
  test(`all supplied cards, detail images and sharing metadata are isolated at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await prepare(page);
    await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    for (const expected of exactSongArtwork) {
      const song = songs.find(song => song.id === expected.id);
      await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(expected.title);
      const card = page.locator(`.song-card[href="${songPath(song)}"]`);
      await loaded(card.locator('img'), expected.path);
      await card.click();
      const image = page.locator('.song-detail-artwork img');
      await loaded(image, expected.path);
      expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([512, 512]);
      const box = await image.boundingBox();
      expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content',
        `https://www.santaradio.co.uk${expected.path}`);
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content',
        `https://www.santaradio.co.uk${expected.path}`);
      await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
    }
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('Frank Sinatra');
    await loaded(page.locator('.song-card[href*="/151-"] img'), '/artist-artwork/frank-sinatra.webp');
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('The Jackson 5');
    await loaded(page.locator('.song-card[href*="/227-"] img'), '/artist-artwork/jackson-5.webp');
  });

  test(`live artwork follows exact songs and shortened credits at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await prepare(page);
    let current = { artist: 'Sia', title: 'Candy Cane Lane' };
    await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
      current, currentStatus: 'ready', upcoming: [], upcomingStatus: 'ready',
    } }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await reject.isVisible()) await reject.click();
    await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
    const card = page.locator('.now-playing-artwork');
    for (const expected of [...exactSongArtwork, ...observedLivePairs]) {
      current = { artist: expected.artist, title: expected.title };
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await loaded(card.locator('img'), expected.path);
      const song = songs.find(song => song.id === expected.id);
      await expect(card.getByRole('link')).toHaveAttribute('href', songPath(song));
      await expect(card.getByRole('link')).toHaveAttribute('aria-label', `More about ${song.song} by ${song.artist}`);
    }
    for (const pair of observedLivePairs) {
      current = { artist: pair.artist, title: `${pair.title} (Live)` };
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect(card.getByRole('link')).toHaveCount(0);
      await loaded(card.locator('img'), pair.path);
    }
    current = { artist: 'Sia', title: 'Snowman' };
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await loaded(card.locator('img'), '/artist-artwork/sia-festive.webp');
    await expect(card.getByRole('link')).toHaveCount(0);
  });
}

test('each new song image falls back to its artist and then Santa without looping', async ({ browser }) => {
  test.setTimeout(90000);
  const contextOptions = {
    baseURL: test.info().project.use.baseURL,
    ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors,
  };
  for (const expected of exactSongArtwork) {
    // Fresh contexts prevent decoded images masking deliberately failed requests.
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await prepare(page);
    await page.route(`**${expected.path}`, route => route.abort());
    const song = songs.find(song => song.id === expected.id);
    await page.goto(songPath(song), { waitUntil: 'domcontentloaded' });
    await loaded(page.locator('.song-detail-artwork img'), artistArtwork(song.artist));
    await context.close();

    const failedContext = await browser.newContext(contextOptions);
    const failedPage = await failedContext.newPage();
    await prepare(failedPage);
    let attempts = 0;
    await failedPage.route('**/artist-artwork/*.webp', route => {
      if (route.request().url().includes('santa-fallback.webp')) return route.continue();
      attempts++;
      return route.abort();
    });
    await failedPage.goto(songPath(song), { waitUntil: 'domcontentloaded' });
    await loaded(failedPage.locator('.song-detail-artwork img'), '/artist-artwork/santa-fallback.webp');
    const settled = attempts;
    await failedPage.waitForTimeout(150);
    expect(attempts).toBe(settled);
    await failedContext.close();
  }
});

test('non-square supplied composition retains transparent top and bottom padding', async ({ page }) => {
  await page.goto('/christmas-artist/457-sia-santas-coming-for-us', { waitUntil: 'domcontentloaded' });
  const image = page.locator('.song-detail-artwork img');
  await loaded(image, '/artist-artwork/sia-santas-coming-for-us.webp');
  expect(await image.evaluate(el => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(el, 0, 0);
    return [ctx.getImageData(256, 0, 1, 1).data[3], ctx.getImageData(256, 511, 1, 1).data[3],
      ctx.getImageData(256, 256, 1, 1).data[3]];
  })).toEqual([0, 0, 255]);
});
