import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import findSong from '../src/data/findSong.js';
import { matchLiveSong } from '../src/data/matchLiveSong.js';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const presentSlugs = ['489-megan-trainor-my-kind-of-present', 'megan-trainor-my-kind-of-present', '489-meghan-trainor-my-kind-of-present', 'meghan-trainor-my-kind-of-present'];

test('official artist names match radio metadata and preserve historical links', () => {
  expect(songs.filter(song => song.artist === 'Meghan Trainor')).toHaveLength(2);
  expect(songs.filter(song => song.artist === 'ABBA')).toHaveLength(2);
  expect(songs.some(song => ['Megan Trainor', 'Abba'].includes(song.artist))).toBe(false);
  for (const artist of ['Meghan Trainor', 'ABBA']) {
    for (const song of songs.filter(song => song.artist === artist)) {
      expect(matchLiveSong({ artist, title: song.song })).toMatchObject({ status: 'ready', song: { id: song.id } });
    }
  }
  for (const slug of presentSlugs) {
    expect(findSong(slug)).toMatchObject({ id: 489, artist: 'Meghan Trainor', link: 'meghan-trainor-my-kind-of-present' });
  }
});

test('Meghan references are canonical, both songs stay intact, and artwork remains the fallback', () => {
  expect(findSong('562-meghan-trainor-gifts-for-me')).toMatchObject({
    id: 562, artist: 'Meghan Trainor', song: 'Gifts For Me', link: 'meghan-trainor-gifts-for-me',
  });
  expect(artistArtwork('Meghan Trainor')).toBe(fallbackArtwork);
  const editorial = fs.readFileSync('docs/editorial/youtube-audit.json', 'utf8');
  expect(editorial).not.toMatch(/megan[\s-]+trainor/i);
  expect(editorial).toContain('/christmas-artist/489-meghan-trainor-my-kind-of-present');
  expect(editorial).toContain('/christmas-artist/562-meghan-trainor-gifts-for-me');
  for (const song of songs.filter(song => song.artist === 'Meghan Trainor')) {
    const { aliases, ...publicFields } = song;
    expect(JSON.stringify(publicFields)).not.toMatch(/megan[\s-]+trainor/i);
    expect(matchLiveSong({ artist: 'MEGHAN TRAINOR', title: song.song.toUpperCase() }))
      .toMatchObject({ status: 'ready', song: { id: song.id } });
  }
});

test('all legacy and canonical Meghan song URLs render the same correct details', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/youtube.com/**', route => route.abort());
  for (const slug of [...presentSlugs, '562-meghan-trainor-gifts-for-me']) {
    await page.goto(`/christmas-artist/${slug}`, { waitUntil: 'domcontentloaded' });
    const song = findSong(slug);
    await expect(page.locator('.song-detail-artist')).toHaveText('Meghan Trainor');
    await expect(page.locator('.song-detail-title')).toHaveText(song.song);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',
      `https://www.santaradio.co.uk/christmas-artist/${song.id}-${song.link}`);
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', fallbackArtwork);
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: 'Show Lyrics' }).click();
    await expect(page.locator('.song-lyrics-content')).toBeVisible();
  }
});

test('catalogue search shows both songs with official artist spellings', async ({ page }) => {
  await page.goto('/christmas-music');
  for (const artist of ['Meghan Trainor', 'ABBA']) {
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(artist);
    await expect(page.locator('.song-card')).toHaveCount(2);
    await expect(page.locator('.song-card strong')).toHaveText([artist, artist]);
    if (artist === 'Meghan Trainor') {
      for (const card of await page.locator('.song-card').all()) {
        await expect(card).toHaveAttribute('href', /meghan-trainor/);
      }
    }
  }
  await page.goto('/christmas-artist/489-megan-trainor-my-kind-of-present');
  await expect(page.locator('.song-detail-artist')).toHaveText('Meghan Trainor');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /489-meghan-trainor-my-kind-of-present$/);
});
