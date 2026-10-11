import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

test('replacement Blossoms portrait is optimised, versioned and displayed', async ({ request, page }) => {
  const path = artistArtwork('Blossoms');
  expect(path).toBe('/artist-artwork/the-blossoms.webp');
  const bytes = fs.readFileSync(`public${path}`);
  expect(bytes.length).toBeLessThan(100000);
  const hash = data => createHash('sha256').update(data).digest('hex');
  const version = hash(bytes);
  expect(version).not.toBe('c117a4d423016fdff63eaa918f8290537d03452426e2ea43ee2545c9ca3126bf');
  const feed = await (await request.get('/artist-artwork/catalogue.json')).json();
  expect(feed.artists.blossoms).toEqual({ path, version, url: `${path}?v=${version}` });
  const response = await request.get(feed.artists.blossoms.url);
  expect(response.ok()).toBe(true);
  expect(hash(await response.body())).toBe(version);
  await page.route('**/*youtube.com/**', route => route.abort());
  await page.goto('/christmas-artist/496-blossoms-its-going-to-be-a-cold-winter', { waitUntil: 'domcontentloaded' });
  const image = page.locator('.song-artwork-img');
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
});
