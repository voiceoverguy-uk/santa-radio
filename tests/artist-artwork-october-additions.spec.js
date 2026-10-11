import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const artists = ['Liam Payne', 'Mel & Kim', 'Idina Menzel'];
const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('three supplied portraits and the Santa fallback are served through the shared feed', async ({ request }) => {
  const response = await request.get('/artist-artwork/catalogue.json');
  expect(response.ok()).toBe(true);
  const feed = await response.json();
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toBe(fallbackArtwork);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(100000);
    const image = feed.artists[artist.toLowerCase()];
    expect(image).toEqual({ path, version: hash(bytes), url: `${path}?v=${hash(bytes)}` });
    const served = await request.get(image.url);
    expect(served.ok()).toBe(true);
    expect(hash(await served.body())).toBe(image.version);
  }
  expect(artistArtwork('Susy Wall')).toBe(fallbackArtwork);
  expect(feed.artists['susy wall']).toBeUndefined();
  expect(feed.fallback.path).toBe(fallbackArtwork);
  const fallback = await request.get(feed.fallback.url);
  expect(fallback.ok()).toBe(true);
  expect(hash(await fallback.body())).toBe(feed.fallback.version);
});

test('all three artist portraits and an unmapped artist load on song pages', async ({ page }) => {
  await page.route('**/*youtube.com/**', route => route.abort());
  for (const artist of [...artists, 'Susy Wall']) {
    const song = songs.find(song => song.artist === artist);
    await page.goto(`/christmas-artist/${song.id}-${song.link}`);
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
  }
});

test('listing uses Santa for unknown artists and for a failed portrait request', async ({ page }) => {
  await page.route('**/artist-artwork/liam-payne.webp', route => route.abort());
  await page.goto('/christmas-music');
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  for (const artist of ['Susy Wall', 'Liam Payne']) {
    await search.fill(artist);
    const image = page.locator('.song-card img').first();
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('src', fallbackArtwork);
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});
