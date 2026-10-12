import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

test('Paul Burling portrait covers the approved joint credit and shared feed', async ({ request, page }) => {
  const path = '/artist-artwork/paul-burling.webp';
  const bytes = fs.readFileSync(`public${path}`);
  expect(bytes.length).toBeLessThan(100000);
  const hash = data => createHash('sha256').update(data).digest('hex');
  const version = hash(bytes);
  const feedResponse = await request.get('/artist-artwork/catalogue.json');
  expect(feedResponse.ok()).toBe(true);
  const feed = await feedResponse.json();
  for (const artist of ['Paul Burling', 'Paul Burling & Joseph Bell', 'Paul Burling and Joseph Bell']) {
    expect(artistArtwork(artist)).toBe(path);
    expect(feed.artists[artist.toLowerCase()]).toEqual({ path, version, url: `${path}?v=${version}` });
  }
  expect(artistArtwork('Joseph Bell')).not.toBe(path);
  const response = await request.get(`${path}?v=${version}`);
  expect(response.ok()).toBe(true);
  expect(hash(await response.body())).toBe(version);
  await page.route('**/*youtube.com/**', route => route.abort());
  await page.goto('/christmas-artist/439-paul-burling-joseph-bell-another-christmas-song', { waitUntil: 'domcontentloaded' });
  const image = page.locator('.song-artwork-img');
  await expect(image).toHaveAttribute('src', path);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
});
