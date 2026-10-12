import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

test('Laufey artwork is optimised, versioned and displayed on her song', async ({ request, page }) => {
  const path = '/artist-artwork/laufey.webp';
  expect(artistArtwork('Laufey')).toBe(path);
  const bytes = fs.readFileSync(`public${path}`);
  expect(bytes.length).toBeLessThan(100000);
  const hash = data => createHash('sha256').update(data).digest('hex');
  const version = hash(bytes);
  const feedResponse = await request.get('/artist-artwork/catalogue.json');
  expect(feedResponse.ok()).toBe(true);
  const feed = await feedResponse.json();
  expect(feed.artists.laufey).toEqual({ path, version, url: `${path}?v=${version}` });
  const response = await request.get(feed.artists.laufey.url);
  expect(response.ok()).toBe(true);
  expect(hash(await response.body())).toBe(version);
  await page.route('**/*youtube.com/**', route => route.abort());
  await page.goto('/christmas-artist/564-laufey-santa-claus-is-comin-to-town', { waitUntil: 'domcontentloaded' });
  const image = page.locator('.song-artwork-img');
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
});
