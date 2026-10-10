import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const artists = [
  'Tom Petty & Heartbreakers', 'Pentatonix', 'Josh Groban', 'Norah Jones',
  'The Monkees', 'The Supremes', 'Hall & Oates', 'Donna Summer', 'Bette Midler',
  'Glen Campbell', 'John Denver', 'Sammy Davis Jr.', 'Judy Garland', 'Doris Day',
  'Luther Vandross', 'Run-DMC', 'Peggy Lee', 'Little Mix', 'George Ezra', 'Meghan Trainor',
];

test('all 20 portraits have compact WebP files and matching catalogue entries', () => {
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toBe(fallbackArtwork);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.length).toBeLessThan(100000);
    expect(songs.some(song => song.artist === artist)).toBe(true);
  }
  expect(artistArtwork('Tom Petty and the Heartbreakers')).toBe(artistArtwork('Tom Petty & Heartbreakers'));
  expect(artistArtwork('Tom Petty & the Heartbreakers')).toBe(artistArtwork('Tom Petty & Heartbreakers'));
  expect(artistArtwork('Hall and Oates')).toBe(artistArtwork('Hall & Oates'));
  expect(artistArtwork('Sammy Davis Jr')).toBe(artistArtwork('Sammy Davis Jr.'));
  expect(artistArtwork('Run DMC')).toBe(artistArtwork('Run-DMC'));
  expect(artistArtwork('Tevin Campbell')).toBe(fallbackArtwork);
});

test('all 20 portraits appear in the public versioned feed and load at 512×512', async ({ page, request }) => {
  const response = await request.get('/artist-artwork/catalogue.json');
  expect(response.ok()).toBe(true);
  const feed = await response.json();
  expect(feed.schemaVersion).toBe(1);
  expect(feed.refreshAfterSeconds).toBe(300);
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const images = artists.map(artist => {
    const entry = feed.artists[artist.toLowerCase()];
    expect(entry.path).toBe(artistArtwork(artist));
    expect(entry.version).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.url).toBe(`${entry.path}?v=${entry.version}`);
    return entry.url;
  });
  const dimensions = await page.evaluate(async urls => Promise.all(urls.map(async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })), images);
  expect(dimensions).toEqual(artists.map(() => [512, 512]));
});

test('catalogue cards and song pages use the new portraits for every matching song', async ({ page }) => {
  test.setTimeout(180000);
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  for (const artist of artists) {
    await search.fill(artist);
    const matches = songs.filter(song => song.artist === artist);
    for (const song of matches) {
      const image = page.locator(`.song-card[href="/christmas-artist/${song.id}-${song.link}"] img`);
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src', artistArtwork(artist));
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
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
