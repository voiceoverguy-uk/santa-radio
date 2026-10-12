import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';
import songs from '../src/data/songs.json' with { type: 'json' };

const portraits = [
  ['Anne-Marie', 'anne-marie'],
  ['Tom Jones & Cerys Matthews', 'tom-jones-and-cerys-matthews'],
  ['Jona Lewie', 'jona-lewie', '8588b58ca205194d14827259e2d611dfd94d91bada8869e949bcd51763b38a93'],
  ['Paul McCartney', 'paul-mc-cartney', '62645885c221ca60ab9300861c4a0b1959e50e20c9f38101d5750c495f701499'],
  ['Michael Buble', 'michael-buble', 'd6ad0433bb1179fa563f1a494a30be02eadfaf14ddb70851c626cceb5b0c5262'],
  ['Darlene Love', 'darlene-love', '4667290a6a0c68db61407a49b2dfd06d4ab965680cc499ba043f8ccdaf21130b'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const [artist, filename, oldVersion] of portraits) {
  test(`${artist} artwork is optimised, versioned and displayed`, async ({ request, page }) => {
    const path = `/artist-artwork/${filename}.webp`;
    expect(artistArtwork(artist)).toBe(path);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(100000);
    const version = hash(bytes);
    if (oldVersion) expect(version).not.toBe(oldVersion);
    const feedResponse = await request.get('/artist-artwork/catalogue.json');
    expect(feedResponse.ok()).toBe(true);
    const feed = await feedResponse.json();
    expect(feed.artists[artist.toLowerCase()]).toEqual({ path, version, url: `${path}?v=${version}` });
    const response = await request.get(feed.artists[artist.toLowerCase()].url);
    expect(response.ok()).toBe(true);
    expect(hash(await response.body())).toBe(version);
    const matches = songs.filter(song => song.artist === artist);
    expect(matches.length).toBeGreaterThan(0);
    for (const song of matches) expect(artistArtwork(song.artist)).toBe(path);
    await page.route('**/*youtube.com/**', route => route.abort());
    const song = matches[0];
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', path);
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
    if (artist === 'Tom Jones & Cerys Matthews') {
      await expect(page.getByRole('heading', { name: `${song.song} — ${artist}`, exact: true })).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Tom Jones & C Matthews');
      await expect(page).toHaveTitle(/Tom Jones & Cerys Matthews/);
    }
  });
}

test('duet aliases and accented Bublé match without assigning duet artwork to solo performers', () => {
  const duet = artistArtwork('Tom Jones & C Matthews');
  expect(artistArtwork('Tom Jones & Cerys Matthews')).toBe(duet);
  expect(artistArtwork('Tom Jones and Cerys Matthews')).toBe(duet);
  expect(artistArtwork('Tom Jones')).not.toBe(duet);
  expect(artistArtwork('Cerys Matthews')).not.toBe(duet);
  expect(artistArtwork('Michael Bublé')).toBe('/artist-artwork/michael-buble.webp');
  expect(artistArtwork('Ronnie Spector & Darlene Love')).not.toBe('/artist-artwork/darlene-love.webp');
});
