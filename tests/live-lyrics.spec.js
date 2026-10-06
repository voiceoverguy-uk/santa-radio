import { test, expect } from '@playwright/test';
import { matchLiveSong } from '../src/data/matchLiveSong.js';

test('live matching requires both fields and refuses ambiguous versions', () => {
  expect(matchLiveSong({ artist: 'Bo Selecta', title: 'Bo Selecta - Proper Crimbo' })).toMatchObject({ status: 'ready', song: { id: 66, song: 'Proper Crimbo' } });
  expect(matchLiveSong({ artist: 'Other Artist', title: 'Bo Selecta - Proper Crimbo' }).status).toBe('unmatched');
  expect(matchLiveSong({ artist: ' ELTON JOHN ', title: 'Step into Christmas!' })).toMatchObject({ status: 'ready', song: { id: 47 } });
  const songs = [
    { id: 1, artist: 'Artist', song: 'It’s Christmas', lyrics: 'One' },
    { id: 2, artist: 'Artist', song: "It's Christmas", lyrics: 'Two' },
    { id: 3, artist: 'Other Artist', song: 'It’s Christmas', lyrics: 'Three' },
    { id: 4, artist: 'Artist', song: 'Empty', lyrics: '' },
  ];
  expect(matchLiveSong({ artist: 'Artist', title: 'It’s Christmas' }, songs).song.id).toBe(1);
  expect(matchLiveSong({ artist: 'ARTIST', title: 'Its Christmas' }, songs).status).toBe('ambiguous');
  expect(matchLiveSong({ artist: 'Other Artist', title: 'It’s Christmas' }, songs).song.id).toBe(3);
  expect(matchLiveSong({ artist: 'Artist', title: 'It’s Christmas (Live)' }, songs).status).toBe('unmatched');
  expect(matchLiveSong({ artist: 'Wrong', title: 'It’s Christmas' }, songs).status).toBe('unmatched');
  expect(matchLiveSong({ artist: 'Artist', title: 'Empty' }, songs).status).toBe('empty');
  expect(matchLiveSong(null).status).toBe('unavailable');
  expect(matchLiveSong({ artist: 'Verified', title: 'Alternate' }, songs,
    [{ artist: 'Verified', title: 'Alternate', songId: 1 }]).song.id).toBe(1);
});

test('lyrics reader follows feed changes, clears stale text and leaves audio untouched', async ({ page }) => {
  let current = { artist: 'Elton John', title: 'Step into Christmas' }, unavailable = false;
  await page.route('**/api/radio-metadata', route => route.fulfill({ json: {
    current: unavailable ? null : current, currentStatus: unavailable ? 'unavailable' : 'ready',
    upcoming: [], upcomingStatus: 'ready',
  } }));
  await page.goto('/apps');
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock).toContainText('Elton John');
  await page.evaluate(() => {
    window.savedAudio = document.querySelector('audio');
    window.calls = [];
    for (const method of ['play', 'pause', 'load']) window.savedAudio[method] = () => { window.calls.push(method); return Promise.resolve(); };
  });
  await dock.getByRole('button', { name: 'Lyrics', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Live lyrics' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('pre')).toHaveText(matchLiveSong(current).song.lyrics);
  await expect(dialog.getByRole('button', { name: 'Close lyrics' })).toBeFocused();
  await dialog.locator('.live-lyrics-reader').evaluate(el => el.scrollTop = 400);
  current = { artist: 'Andy Williams', title: 'Do You Hear What I Hear' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog.locator('pre')).toHaveText(matchLiveSong(current).song.lyrics);
  expect(await dialog.locator('.live-lyrics-reader').evaluate(el => el.scrollTop)).toBe(0);
  current = { artist: 'Bo Selecta', title: 'Bo Selecta - Proper Crimbo' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog.locator('pre')).toHaveText(matchLiveSong(current).song.lyrics);
  await expect(dialog.getByRole('heading', { name: 'Proper Crimbo', exact: true })).toBeVisible();
  current = { artist: 'Unknown Artist', title: 'Unknown Song' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog).toContainText('Lyrics unavailable for this track.');
  await expect(dialog.locator('pre')).toHaveCount(0);
  unavailable = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog).toContainText('Current track unavailable.');
  await expect(dock).toContainText('Santa is selecting the next track');
  await expect(dialog).not.toContainText('Unknown Song');
  unavailable = false;
  current = { artist: 'Elton John', title: 'Step Into Christmas' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog.locator('pre')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(dock.getByRole('button', { name: 'Lyrics', exact: true })).toBeFocused();
  await dock.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close lyrics' }).click();
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.calls)).toEqual([]);
});
