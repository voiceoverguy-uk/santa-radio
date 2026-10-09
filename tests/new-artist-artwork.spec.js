import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { artistArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const additions = {
  ABBA: 'abba',
  'Johnny Cash': 'johnny-cash',
  'The Carpenters': 'the-carpenters',
  Pogues: 'the-pogues',
  Slade: 'slade',
  Wizzard: 'wizzard',
};

test('all six portraits are compact WebP files and keep existing artwork intact', () => {
  for (const [artist, filename] of Object.entries(additions)) {
    const path = `/artist-artwork/${filename}.webp`;
    expect(artistArtwork(artist)).toBe(path);
    expect(songs.filter(song => song.artist === artist).length).toBeGreaterThan(0);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.length).toBeLessThan(100000);
  }
  expect(artistArtwork('The Pogues')).toBe('/artist-artwork/the-pogues.webp');
  expect(artistArtwork('Queen')).toBe('/artist-artwork/queen.jpg');
});

test('each artist shows the new portrait on all catalogue cards and song details', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-music');
  for (const [artist, filename] of Object.entries(additions)) {
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(artist);
    const cards = page.locator('.song-card');
    const count = songs.filter(song => song.artist === artist).length;
    await expect(cards).toHaveCount(count);
    for (const image of await cards.locator('img').all()) {
      await expect(image).toHaveAttribute('src', `/artist-artwork/${filename}.webp`);
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
    }
  }
  for (const [artist, filename] of Object.entries(additions)) {
    const song = songs.find(song => song.artist === artist);
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', `/artist-artwork/${filename}.webp`);
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
  }
});
