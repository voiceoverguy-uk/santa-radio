import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const artists = ['Liam Gallagher', 'Gary Barlow', 'Backstreet Boys', 'Bryan Adams', 'Christina Aguilera'];

test('five new artist portraits are mapped to compact WebP files', () => {
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toBe(fallbackArtwork);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.length).toBeLessThan(100000);
    expect(songs.some(song => song.artist === artist)).toBe(true);
  }
  expect(artistArtwork('Oasis')).toBe(fallbackArtwork);
  expect(artistArtwork('Take That')).toBe(fallbackArtwork);
});

test('new portraits load on all matching catalogue cards and song pages', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  for (const artist of artists) {
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(artist);
    const images = page.locator('.song-card img');
    await expect(images).toHaveCount(songs.filter(song => song.artist === artist).length);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src', artistArtwork(artist));
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
    }
  }
  for (const song of songs.filter(song => artists.includes(song.artist))) {
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(song.artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
