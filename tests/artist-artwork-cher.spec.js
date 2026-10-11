import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

test('replacement Cher artwork has a new shared-feed version and displays on her song', async ({ request, page }) => {
  const path = artistArtwork('Cher');
  expect(path).toBe('/artist-artwork/cher.webp');
  const bytes = fs.readFileSync(`public${path}`);
  expect(bytes.length).toBeLessThan(100000);
  const hash = data => createHash('sha256').update(data).digest('hex');
  const version = hash(bytes);
  expect(version).not.toBe('858e04c56a43a45596763b9be34b2f7101b14e80ecc799c282f1fb835a67a220');
  const feed = await (await request.get('/artist-artwork/catalogue.json')).json();
  expect(feed.artists.cher).toEqual({ path, version, url: `${path}?v=${version}` });
  const response = await request.get(feed.artists.cher.url);
  expect(response.ok()).toBe(true);
  expect(hash(await response.body())).toBe(version);
  await page.route('**/*youtube.com/**', route => route.abort());
  await page.goto('/christmas-artist/551-cher-dj-play-a-christmas-song', { waitUntil: 'domcontentloaded' });
  const image = page.locator('.song-artwork-img');
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
});
