import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const artists = ['Cliff Richard', 'Waitresses', 'Scouting For Girls'];

test('Cliff keeps his existing filename and all three compact portraits are versioned in the feed', async ({ request }) => {
  expect(artistArtwork('Cliff Richard')).toBe('/artist-artwork/cliff-richard.webp');
  expect(fs.readdirSync('public/artist-artwork').filter(file => /^cliff-richard.*\.webp$/.test(file))).toEqual(['cliff-richard.webp']);
  expect(artistArtwork('The Waitresses')).toBe(artistArtwork('Waitresses'));
  const response = await request.get('/artist-artwork/catalogue.json');
  expect(response.ok()).toBe(true);
  const feed = await response.json();
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toBe(fallbackArtwork);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(100000);
    const version = createHash('sha256').update(bytes).digest('hex');
    expect(feed.artists[artist.toLowerCase()]).toEqual({ path, version, url: `${path}?v=${version}` });
    const image = await request.get(feed.artists[artist.toLowerCase()].url);
    expect(image.ok()).toBe(true);
    expect(createHash('sha256').update(await image.body()).digest('hex')).toBe(version);
  }
});

test('the updated portraits load on all matching cards and song pages', async ({ page }) => {
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
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
