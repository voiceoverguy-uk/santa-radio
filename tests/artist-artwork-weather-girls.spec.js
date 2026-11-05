import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

const path = '/artist-artwork/the-weather-girls.webp';
const songPage = '/christmas-artist/430-the-weather-girls-dear-santa-bring-me-a-man-this-christmas';

test('Weather Girls shared feed serves the supplied optimised artwork bytes', async ({ request }) => {
  expect(artistArtwork('  THE WEATHER GIRLS  ')).toBe(path);
  const bytes = readFileSync(`public${path}`);
  expect(bytes.length).toBeLessThan(100000);
  const version = createHash('sha256').update(bytes).digest('hex');
  const feed = await (await request.get('/artist-artwork/catalogue.json')).json();
  expect(feed.artists['the weather girls']).toEqual({ path, version, url: `${path}?v=${version}` });
  const image = await request.get(feed.artists['the weather girls'].url);
  expect(image.ok()).toBe(true);
  expect(await image.body()).toEqual(bytes);
});

for (const width of [1280, 390]) {
  test(`Weather Girls artwork appears uncropped in listing and song page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
    async function expectSquare(image) {
      await expect(image).toHaveAttribute('src', path);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(el => el.complete &&
        el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
      const square = await image.evaluate(el => {
        const box = el.getBoundingClientRect();
        return Math.abs(box.width - box.height) <= 1;
      });
      expect(square).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.getByPlaceholder('Search for a song or artist').fill('The Weather Girls');
    await expectSquare(page.locator(`a.song-card[href="${songPage}"] img`));
    await page.goto(songPage, { waitUntil: 'domcontentloaded' });
    await expectSquare(page.locator('.song-artwork-img'));
  });
}
