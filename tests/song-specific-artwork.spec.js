import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const special = '/artist-artwork/ariana-grande-last-christmas.webp';
const winterSpecial = '/artist-artwork/ariana-grande-winter-things.webp';
const usual = '/artist-artwork/ariana-grande.webp';
const fallback = '/artist-artwork/santa-fallback.webp';
const songPage = '/christmas-artist/75-ariana-grande-last-christmas';

async function visit(page, path) {
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Reject optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
}

for (const width of [1280, 390]) {
  test(`Last Christmas artwork and social image are correct at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, songPage);
    const image = page.locator('.song-detail-artwork img');
    await expect(image).toHaveAttribute('src', special);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
    await expect(image).toHaveAttribute('alt', /Last Christmas.*Ariana Grande/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(special));
    fs.mkdirSync('generated-artifacts', { recursive: true });
    await page.screenshot({ path: `generated-artifacts/ariana-song-artwork-${width}.jpg` });
    await page.goto('/christmas-artist/527-ariana-grande-winter-things');
    await expect(page.locator('.song-detail-artwork img')).toHaveAttribute('src', winterSpecial);
    await expect.poll(() => page.locator('.song-detail-artwork img').evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(winterSpecial));
  });
}

test('music cards use distinct overrides for each Ariana recording', async ({ page }) => {
  await visit(page, '/christmas-music');
  await page.getByPlaceholder('Search for a song or artist').fill('Ariana Grande');
  const last = page.locator(`a.song-card[href="${songPage}"] img`);
  await expect(last).toHaveAttribute('src', special);
  await expect(page.locator('a.song-card[href="/christmas-artist/527-ariana-grande-winter-things"] img'))
    .toHaveAttribute('src', winterSpecial);
  await last.scrollIntoViewIfNeeded();
  await expect.poll(() => last.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
});

test('broken song artwork falls back to the artist, then Santa, without looping', async ({ page }) => {
  await page.route(`**${special}`, route => route.abort());
  await visit(page, songPage);
  const image = page.locator('.song-detail-artwork img');
  await expect(image).toHaveAttribute('src', usual);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.route(`**${usual}`, route => route.abort());
  await page.reload();
  await expect(image).toHaveAttribute('src', fallback);
  await expect(image).toHaveAttribute('alt', /Santa Radio/);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('live homepage artwork tracks artist and title and resets after an image failure', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  });
  const state = { artist: 'Ariana Grande', title: 'Last Christmas', currentStatus: 'ready' };
  await page.route('**/api/radio-metadata', route => route.fulfill({
    json: { current: state.currentStatus === 'ready' ? { artist: state.artist, title: state.title } : null,
      currentStatus: state.currentStatus, upcoming: [], upcomingStatus: 'ready' },
  }));
  await visit(page, '/');
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const image = page.locator('.now-playing-artwork img');
  const info = page.locator('.now-playing-artwork').getByRole('link');
  await expect(image).toHaveAttribute('src', special);
  await expect(info).toHaveAttribute('href', songPage);
  state.title = 'Winter Things';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(image).toHaveAttribute('src', winterSpecial);
  state.title = 'Unknown recording';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(image).toHaveAttribute('src', usual);
  await expect(info).toHaveCount(0);
  await page.route(`**${special}`, route => route.abort());
  state.title = 'Last Christmas';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(image).toHaveAttribute('src', usual);
  await expect(info).toHaveAttribute('href', songPage);
  state.title = 'Winter Things';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toHaveAttribute('href', '/christmas-artist/527-ariana-grande-winter-things');
  await expect(image).toHaveAttribute('src', winterSpecial);
  await page.unroute(`**${special}`);
  state.title = 'Last Christmas';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(image).toHaveAttribute('src', special);
  state.currentStatus = 'unavailable';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(image).toHaveAttribute('src', fallback);
  await expect(info).toHaveCount(0);
});
