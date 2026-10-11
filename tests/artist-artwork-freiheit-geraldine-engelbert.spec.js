import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const artists = ['Freiheit', 'Geraldine McQueen', 'Engelbert Humperdinck'];
const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('three supplied portraits are served through the versioned shared catalogue', async ({ request }) => {
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
  expect(artistArtwork('Engelbert Humperdinck')).toBe('/artist-artwork/engelbert-humperdinck.webp');
  expect(feed.artists['engelbert humperdinck'].version).not.toBe('3eb8905d7b7247de14be955ca39424fe596aa84fa86b1473a98c4b9c13eec2b7');
  expect(Object.values(feed.artists).some(entry => entry.path === fallbackArtwork)).toBe(true);
});

test('all three song pages display their supplied artwork', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/*youtube.com/**', route => route.abort());
  for (const song of songs.filter(song => artists.includes(song.artist))) {
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(song.artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  }
});
