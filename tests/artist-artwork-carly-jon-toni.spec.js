import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const artists = ['Carly Rae Jepsen', 'Jon Bon Jovi', 'Toni Braxton'];
const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('three optimised portraits are available in the shared feed', async ({ request }) => {
  const feed = await (await request.get('/artist-artwork/catalogue.json')).json();
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toBe(fallbackArtwork);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(100000);
    const entry = feed.artists[artist.toLowerCase()];
    expect(entry).toEqual({ path, version: hash(bytes), url: `${path}?v=${hash(bytes)}` });
    const response = await request.get(entry.url);
    expect(response.ok()).toBe(true);
    expect(hash(await response.body())).toBe(entry.version);
  }
  expect(artistArtwork('Carly Rae Jepsen')).toBe('/artist-artwork/carly-rae-jepson.webp');
  expect(artistArtwork('Bon Jovi')).toBe('/artist-artwork/bon-jovi.webp');
  expect(artistArtwork('Jon Bon Jovi')).not.toBe(artistArtwork('Bon Jovi'));
  expect(Object.values(feed.artists).some(entry => entry.path === fallbackArtwork)).toBe(true);
});

test('all four matching song pages show the supplied artwork', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/*youtube.com/**', route => route.abort());
  const matchingSongs = songs.filter(song => artists.includes(song.artist));
  expect(matchingSongs).toHaveLength(4);
  for (const song of matchingSongs) {
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(song.artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  }
});

for (const width of [1280, 390]) {
  test(`Toni Braxton full square replacement renders in listing and existing song at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
    const path = artistArtwork('Toni Braxton');
    const song = songs.find(song => song.artist === 'Toni Braxton');
    expect(song.song).toBe('Holiday Celebrate');
    const songPage = `/christmas-artist/${song.id}-${song.link}`;
    async function expectSquare(image) {
      await expect(image).toHaveAttribute('src', path);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(el => el.complete &&
        el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
      const dimensions = await image.evaluate(el => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return {
          width: box.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
          height: box.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth),
        };
      });
      expect(Math.abs(dimensions.width - dimensions.height)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.getByPlaceholder('Search for a song or artist').fill('Toni Braxton');
    await expectSquare(page.locator(`a.song-card[href="${songPage}"] img`));
    await page.goto(songPage, { waitUntil: 'domcontentloaded' });
    await expectSquare(page.locator('.song-artwork-img'));
  });
}
