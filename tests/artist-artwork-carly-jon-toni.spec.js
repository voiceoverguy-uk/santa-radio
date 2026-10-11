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
