import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';
import songs from '../src/data/songs.json' with { type: 'json' };

const portraits = [
  ['Gwen Stefani', 'gwen-stefani', 'e26936a8303a814404e6966c8d64c4009480f5e2cba762dad459e261ee67fc46'],
  ['Shakin Stevens', 'shakin-stevens', '71688db5f0eb1e651255294370af98355cf25201210a5a162edcecae1a575de3'],
  ['Jason Mraz', 'jason-mraz'],
  ['Liam Payne', 'liam-payne', 'a243648b99a8ea170b5ca7d44b93516d31c1cb804e6bc22b18154c1bdc9ee26f'],
  ['Coldplay', 'coldplay', '2687e8b144145c71b5c82300bfb00d6bcb1b771bc012f8814bb312de04252f4d'],
  ['The Pointer Sisters', 'pointer-sisters'],
  ['Wham!', 'wham', '9b6a3a4e11cedc4b2193028a9f8127bd93236da7d65e7957f7462ea06c86bcdb'],
  ['Camila Cabello', 'camila-cabello'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const [artist, filename, oldVersion] of portraits) {
  test(`${artist} supplied artwork reaches every song and the versioned feed`, async ({ request, page }) => {
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
    await page.route('**/*youtube.com/**', route => route.abort());
    const matches = songs.filter(song => song.artist === artist);
    expect(matches.length).toBeGreaterThan(0);
    for (const song of matches) {
      await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
      const image = page.locator('.song-artwork-img');
      await expect(image).toHaveAttribute('src', path);
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
    }
  });
}

test('Pointer Sisters alias shares the portrait without changing solo George Michael', () => {
  expect(artistArtwork('Pointer Sisters')).toBe(artistArtwork('The Pointer Sisters'));
  expect(artistArtwork('George Michael')).toBe('/artist-artwork/george-michael.webp');
});
