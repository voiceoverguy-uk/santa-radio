import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const artists = ['Heidi Anne', 'Miley Cyrus'];
const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('Heidi and replacement Miley portraits are versioned in the shared catalogue', async ({ request }) => {
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
  expect(artistArtwork('Miley Cyrus')).toBe('/artist-artwork/miley-cyrus.webp');
  expect(feed.artists['susy wall']).toEqual(feed.fallback);
});

test('both Heidi songs and Miley show their supplied portraits', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/*youtube.com/**', route => route.abort());
  for (const song of songs.filter(song => artists.includes(song.artist))) {
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(song.artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  }
});
