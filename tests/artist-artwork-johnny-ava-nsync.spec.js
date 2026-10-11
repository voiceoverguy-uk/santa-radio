import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const artists = ['Johnny Mathis', 'Ava Max', 'N Sync'];
const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('final three portraits are optimised and versioned in the shared feed', async ({ request }) => {
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
  expect(artistArtwork('Johnny Mathis')).toBe('/artist-artwork/johnny-mathis.webp');
  expect(feed.artists['johnny mathis'].version).not.toBe('9e171e2f1664e9ee61de13d146cdb1c7d5714928327c5391a70f23a2614e8bdf');
  expect(feed.artists.nsync).toEqual(feed.artists['n sync']);
  expect(feed.artists['*nsync']).toEqual(feed.artists['n sync']);
  expect(Object.values(feed.artists).some(entry => entry.path === fallbackArtwork)).toBe(true);
});

test('all six matching song pages show their supplied artwork without breadcrumbs', async ({ page }) => {
  test.setTimeout(120000);
  await page.route('**/*youtube.com/**', route => route.abort());
  const matchingSongs = songs.filter(song => artists.includes(song.artist));
  expect(matchingSongs).toHaveLength(6);
  for (const song of matchingSongs) {
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(song.artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
  }
});
