import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const artists = [
  'Perry Como', 'Mud', 'Chuck Berry', 'Aretha Franklin', 'Louis Armstrong',
  'Whitney Houston', 'Katy Perry', 'Cher', 'Britney Spears', 'Leona Lewis',
  'George Michael', 'James Brown', 'Stevie Wonder', 'Boney M',
];

test('all fourteen new portraits are compact WebP images mapped to catalogue artists', () => {
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toBe(fallbackArtwork);
    expect(path.endsWith('.webp')).toBe(true);
    const image = fs.readFileSync(`public${path}`);
    expect(image.subarray(8, 12).toString()).toBe('WEBP');
    expect(image.length).toBeLessThan(100000);
    expect(songs.filter(song => song.artist === artist).length).toBeGreaterThan(0);
  }
  expect(artistArtwork('Ella Fitzgerald & Louis Armstrong')).toBe(fallbackArtwork);
  expect(artistArtwork('Wham!')).toBe('/artist-artwork/wham.webp');
});

test('all new portraits load on every matching card and on song details', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  for (const artist of artists) {
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(artist);
    const cards = page.locator('.song-card').filter({
      has: page.locator('strong', { hasText: new RegExp(`^${artist}$`) }),
    });
    await expect(cards).toHaveCount(songs.filter(song => song.artist === artist).length);
    for (const image of await cards.locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src', artistArtwork(artist));
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
    }
  }
  for (const artist of ['Louis Armstrong', 'Mud']) {
    const song = songs.find(song => song.artist === artist);
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
