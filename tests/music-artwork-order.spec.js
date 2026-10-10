import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { randomSongOrder } from '../src/data/randomSongOrder.js';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const hasArtwork = song => artistArtwork(song.artist) !== fallbackArtwork;
const compareSongs = (a, b) =>
  a.artist.localeCompare(b.artist, 'en-GB', { sensitivity: 'base', numeric: true }) ||
  a.song.localeCompare(b.song, 'en-GB', { sensitivity: 'base', numeric: true });

function expectArtworkFirst(ordered) {
  const portraitCount = ordered.filter(hasArtwork).length;
  expect(portraitCount).toBeGreaterThan(0);
  expect(portraitCount).toBeLessThan(ordered.length);
  expect(ordered.slice(0, portraitCount).every(hasArtwork)).toBe(true);
  expect(ordered.slice(portraitCount).every(song => !hasArtwork(song))).toBe(true);
}

test('random ordering prioritises portraits, shuffles both groups and preserves every song', () => {
  const snapshot = JSON.stringify(songs);
  const first = randomSongOrder(songs, () => 0);
  const second = randomSongOrder(songs, () => 0.999);
  for (const ordered of [first, second]) {
    expectArtworkFirst(ordered);
    expect(ordered.map(song => song.id).sort((a, b) => a - b)).toEqual(songs.map(song => song.id).sort((a, b) => a - b));
  }
  expect(first.filter(hasArtwork)).not.toEqual(second.filter(hasArtwork));
  expect(first.filter(song => !hasArtwork(song))).not.toEqual(second.filter(song => !hasArtwork(song)));
  expect(JSON.stringify(songs)).toBe(snapshot);
  expect(randomSongOrder([])).toEqual([]);
});

test('initial load, reshuffle and search put portraits first while A–Z stays alphabetical', async ({ page }) => {
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const cards = page.locator('.song-card');
  const catalogueByHref = new Map(songs.map(song => [`/christmas-artist/${song.id}-${song.link}`, song]));
  const visibleSongs = async () => (await cards.evaluateAll(elements => elements.map(el => el.getAttribute('href'))))
    .map(href => catalogueByHref.get(href));
  await expect(cards).toHaveCount(songs.length);
  expectArtworkFirst(await visibleSongs());
  await page.getByRole('button', { name: 'Random', exact: true }).click();
  expectArtworkFirst(await visibleSongs());
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  await search.fill('Christmas');
  const matches = songs.filter(song => /christmas/i.test(song.artist) || /christmas/i.test(song.song));
  await expect(cards).toHaveCount(matches.length);
  expectArtworkFirst(await visibleSongs());
  await page.getByRole('button', { name: 'Artist A–Z', exact: true }).click();
  expect(await visibleSongs()).toEqual([...matches].sort(compareSongs));
  await search.fill('');
  await expect(cards).toHaveCount(songs.length);
  expect(await visibleSongs()).toEqual([...songs].sort(compareSongs));
  await page.getByRole('button', { name: 'Random', exact: true }).click();
  expectArtworkFirst(await visibleSongs());
});
