import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { artistArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const artists = ['Matt Terry', 'Jamie Cullum', 'Scottish Quest All Stars'];

test('three supplied pictures match the catalogue and versioned shared feed', async ({ request }) => {
  const response = await request.get('/artist-artwork/catalogue.json');
  expect(response.ok()).toBe(true);
  const feed = await response.json();
  for (const artist of artists) {
    const path = artistArtwork(artist);
    expect(path).not.toContain('santa-fallback');
    const bytes = fs.readFileSync(`public${path}`);
    expect(bytes.length).toBeLessThan(130000);
    const version = createHash('sha256').update(bytes).digest('hex');
    expect(feed.artists[artist.toLowerCase()]).toEqual({ path, version, url: `${path}?v=${version}` });
    const image = await request.get(`${path}?v=${version}`);
    expect(image.ok()).toBe(true);
    expect(createHash('sha256').update(await image.body()).digest('hex')).toBe(version);
    expect(songs.filter(song => song.artist === artist).length).toBeGreaterThan(0);
  }
});

test('music cards and each song page show the right picture on desktop and mobile', async ({ page }) => {
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  for (const artist of artists) {
    await search.fill(artist);
    for (const song of songs.filter(song => song.artist === artist)) {
      const card = page.locator(`.song-card[href="/christmas-artist/${song.id}-${song.link}"] img`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveAttribute('src', artistArtwork(artist));
      await expect.poll(() => card.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
    }
  }
  for (const song of songs.filter(song => artists.includes(song.artist))) {
    await page.goto(`/christmas-artist/${song.id}-${song.link}`, { waitUntil: 'domcontentloaded' });
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(song.artist));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(image).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
