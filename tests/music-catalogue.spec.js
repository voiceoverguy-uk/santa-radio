import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { parseMusicRows, reconcileMusic } from '../scripts/import-music-catalogue.js';
import { repair } from '../scripts/import-mugshots.js';
import findSong from '../src/data/findSong.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const rows = parseMusicRows(fs.readFileSync('attached_assets/cl57-thesongs_1791303552293.sql', 'utf8'));
const historical = JSON.parse(fs.readFileSync('reports/music-import.json', 'utf8'));

test('all source records are matched and every historical route still resolves', () => {
  expect(rows).toHaveLength(454);
  expect(songs).toHaveLength(455);
  const result = reconcileMusic(songs, rows);
  expect(result.output).toEqual(songs);
  expect(result.report.matched).toBe(454);
  expect(result.report.databaseOnly).toEqual([]);
  expect(result.report.unresolved.map(r => r.url)).toEqual(['422-r-kelly-world-christmas']);
  for (const row of rows) {
    const song = songs.find(s => s.id === Number(row[0]));
    expect(song.info).toBe(repair(row[4]).replace(/\r\n?/g, '\n').trim());
    expect(song.lyrics).toBe(repair(row[6]).replace(/\r\n?/g, '\n').trim());
    expect(findSong(`${song.id}-${song.link}`)).toEqual(song);
  }
  expect(historical.matches).toHaveLength(433);
  for (const match of historical.matches) {
    const song = findSong(match.url);
    expect(song).toBeTruthy();
    if (match.databaseId) expect(song.id).toBe(match.databaseId);
  }
  expect(findSong('134-michael-buble-ave-maria').id).toBe(328);
});

test('parser rejects incomplete data and reconciliation refuses ID-only guesses', () => {
  expect(() => parseMusicRows("INSERT INTO `messages2` VALUES (1,'unfinished")).toThrow();
  expect(() => parseMusicRows("INSERT INTO `messages2` VALUES (1,'short');")).toThrow();
  expect(repair('Itâ€™s NoÃ«l')).toBe('It’s Noël');
  const source = [[1, 'Song', 'Artist', '', 'Info', '', 'Line one\nLine two', '']];
  const old = { id: 1, artist: 'Someone Else', song: 'Different', link: 'someone-else-different', lyrics: 'Keep', image: '/old.jpg' };
  expect(reconcileMusic([old], source).output).toEqual([old]);
  const verified = { ...old, id: 99, artist: 'Artist', song: 'Song', link: 'historic-link' };
  const result = reconcileMusic([verified], source);
  expect(result.output[0]).toMatchObject({ id: 99, link: 'historic-link', image: '/old.jpg', lyrics: 'Line one\nLine two' });
  expect(result.report.matches[0].conflictingId).toBe(99);
});

test('Andy Williams lyrics toggle and karaoke share readable source text', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  const slug = '82-andy-williams-do-you-hear-what-i-hear';
  const song = findSong(slug);
  await page.goto(`/christmas-artist/${slug}`);
  await expect(page.locator('.song-detail-artist')).toHaveText('Andy Williams');
  await expect(page.locator('.song-detail-info')).toHaveText(song.info);
  const toggle = page.getByRole('button', { name: 'Show Lyrics', exact: true });
  await toggle.click();
  await expect(page.locator('.song-lyrics-content pre')).toHaveText(song.lyrics);
  await expect(page.locator('.song-lyrics-content pre')).toHaveCSS('white-space', 'pre-wrap');
  await page.getByRole('button', { name: 'Hide Lyrics' }).click();
  await expect(page.locator('.song-lyrics-content')).toHaveCount(0);
  await page.getByRole('link', { name: 'View Karaoke Lyrics' }).click();
  await expect(page.locator('.karaoke-lyrics-text')).toHaveText(song.lyrics);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('corrected, conflicting and unavailable routes render honestly', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  for (const slug of ['134-michael-buble-ave-maria', '12-12', '549-bon-jovi-christmas-isna-tmt-christmas']) {
    await page.goto(`/christmas-artist/${slug}`);
    const song = findSong(slug);
    await expect(page.locator('.song-detail-artist')).toHaveText(song.artist);
    await page.getByRole('button', { name: 'Show Lyrics', exact: true }).click();
    await expect(page.locator('.song-lyrics-content pre')).toHaveText(song.lyrics);
  }
  await page.goto('/christmas-artist/422-r-kelly-world-christmas');
  await expect(page.locator('.song-detail-info')).toContainText('not yet available');
  await expect(page.getByRole('button', { name: 'Show Lyrics' })).toHaveCount(0);
  await page.goto('/christmas-karaoke-lyrics/422-r-kelly-world-christmas');
  await expect(page.locator('.karaoke-no-lyrics')).toContainText('not yet available');
});
