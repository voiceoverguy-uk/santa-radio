import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [artist, filename, route] of [
  ['East 17', 'east-17', '49-east-17-stay-another-day'],
  ['Anne-Marie', 'anne-marie', '498-anne-marie-think-of-christmas'],
]) {
  test(`${artist} artwork is optimised, shared and displayed`, async ({ request, page }) => {
    const path = `/artist-artwork/${filename}.webp`;
    expect(artistArtwork(artist)).toBe(path);
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(100000);
    const version = hash(bytes);
    if (artist === 'East 17') {
      expect(version).not.toBe('79778d1d9e34ab0e7ccd6dba079aa09b4b70eba80eabb4162eb9954015d53c57');
    } else {
      expect(hash(fs.readFileSync('attached_assets/anne-marie_1791769197641.png')))
        .toBe(hash(fs.readFileSync('attached_assets/anne-marie_1791768644389.png')));
    }
    const feedResponse = await request.get('/artist-artwork/catalogue.json');
    expect(feedResponse.ok()).toBe(true);
    const feed = await feedResponse.json();
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
