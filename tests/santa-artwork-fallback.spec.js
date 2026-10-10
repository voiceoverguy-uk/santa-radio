import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const artists = ['John Legend', 'Madonna', 'Kate Bush', 'Eurythmics', 'Bobby Helms'];

test('new portraits and the shared Santa image are compact WebP files', () => {
  expect(fallbackArtwork).toBe('/artist-artwork/santa-fallback.webp');
  expect(artistArtwork('Tevin Campbell')).toBe(fallbackArtwork);
  expect(artistArtwork('Unknown Artist')).toBe(fallbackArtwork);
  for (const path of [...artists.map(artistArtwork), fallbackArtwork]) {
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.length).toBeLessThan(100000);
  }
  for (const artist of artists) expect(artistArtwork(artist)).not.toBe(fallbackArtwork);
  expect(artistArtwork('Queen')).toBe('/artist-artwork/queen.webp');
});

test('catalogue portraits and missing artwork use the supplied images', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  for (const artist of [...artists, 'Waitresses']) {
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(artist);
    const images = page.locator('.song-card img');
    await expect(images).toHaveCount(songs.filter(song => song.artist === artist).length);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src', artistArtwork(artist));
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
    }
  }
  for (const artist of ['John Legend', 'Waitresses']) {
    const song = songs.find(song => song.artist === artist);
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed artist image loads the new Santa fallback', async ({ page }) => {
  await page.route('**/artist-artwork/john-legend.webp', route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('John Legend');
  const image = page.locator('.song-card img').first();
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute('src', fallbackArtwork);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
});
