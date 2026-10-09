import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import findSong from '../src/data/findSong.js';
import { matchLiveSong } from '../src/data/matchLiveSong.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));

test('official artist names match radio metadata and preserve historical links', () => {
  expect(songs.filter(song => song.artist === 'Meghan Trainor')).toHaveLength(2);
  expect(songs.filter(song => song.artist === 'ABBA')).toHaveLength(2);
  expect(songs.some(song => ['Megan Trainor', 'Abba'].includes(song.artist))).toBe(false);
  for (const artist of ['Meghan Trainor', 'ABBA']) {
    for (const song of songs.filter(song => song.artist === artist)) {
      expect(matchLiveSong({ artist, title: song.song })).toMatchObject({ status: 'ready', song: { id: song.id } });
    }
  }
  for (const slug of ['489-megan-trainor-my-kind-of-present', 'megan-trainor-my-kind-of-present', '489-meghan-trainor-my-kind-of-present', 'meghan-trainor-my-kind-of-present']) {
    expect(findSong(slug)).toMatchObject({ id: 489, artist: 'Meghan Trainor', link: 'meghan-trainor-my-kind-of-present' });
  }
});

test('catalogue search shows both songs with official artist spellings', async ({ page }) => {
  await page.goto('/christmas-music');
  for (const artist of ['Meghan Trainor', 'ABBA']) {
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill(artist);
    await expect(page.locator('.song-card')).toHaveCount(2);
    await expect(page.locator('.song-card strong')).toHaveText([artist, artist]);
  }
  await page.goto('/christmas-artist/489-megan-trainor-my-kind-of-present');
  await expect(page.locator('.song-detail-artist')).toHaveText('Meghan Trainor');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /489-meghan-trainor-my-kind-of-present$/);
});
