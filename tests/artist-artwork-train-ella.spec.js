import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

for (const [artist, filename, route] of [
  ['Train', 'train', '4-train-shake-up-christmas'],
  ['Ella Fitzgerald & Louis Armstrong', 'ella-fitzgerald-and-louis-armstrong', '529-ella-fitzgerald-louis-armstrong-ive-got-my-love-to-keep-me-warm'],
]) {
  test(`${artist} artwork is optimised, shared and displayed`, async ({ request, page }) => {
    const path = `/artist-artwork/${filename}.webp`;
    expect(artistArtwork(artist)).toBe(path);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(100000);
    const hash = data => createHash('sha256').update(data).digest('hex');
    const version = hash(bytes);
    const feed = await (await request.get('/artist-artwork/catalogue.json')).json();
    expect(feed.artists[artist.toLowerCase()]).toEqual({ path, version, url: `${path}?v=${version}` });
    const response = await request.get(feed.artists[artist.toLowerCase()].url);
    expect(response.ok()).toBe(true);
    expect(hash(await response.body())).toBe(version);
    await page.route('**/*youtube.com/**', route => route.abort());
    await page.goto(`/christmas-artist/${route}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', path);
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  });
}

test('duet alias matches without replacing solo or similarly named artists', () => {
  expect(artistArtwork('Ella Fitzgerald and Louis Armstrong')).toBe(artistArtwork('Ella Fitzgerald & Louis Armstrong'));
  expect(artistArtwork('Louis Armstrong')).toBe('/artist-artwork/louis-armstrong.webp');
  expect(artistArtwork('Ella Fitzgerald')).not.toBe(artistArtwork('Ella Fitzgerald & Louis Armstrong'));
  expect(artistArtwork('Big Big Train')).not.toBe(artistArtwork('Train'));
});
