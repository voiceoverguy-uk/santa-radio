import { test, expect } from '@playwright/test';
import { matchLiveSong } from '../src/data/matchLiveSong.js';

test('waiting messages rotate and reset when the lyrics reader reopens', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/radio-metadata', route => route.fulfill({ json: {
    current: null, currentStatus: 'unavailable', upcoming: [], upcomingStatus: 'unavailable',
  } }));
  await page.goto('/');
  // Freeze wall-clock progression so assertions cannot advance the rotation themselves.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Live lyrics' });
  await expect(dialog).not.toContainText('word-by-word timing');
  const messages = [
    'Hang on, Santa is getting the next track ready. Lyrics on the way!',
    'One moment! An elf has hidden the lyric sheet under the mince pies.',
    'Hold your reindeer! Santa is finding the words for your next singalong.',
    'Just a tick! Rudolph is shining a light on the next lyric sheet.',
    'Bear with us! The elves are untangling the lyrics from the fairy lights.',
    'Nearly there! Santa is brushing the biscuit crumbs off the songbook.',
  ];
  for (const message of messages) {
    await expect(dialog).toContainText(message);
    await page.clock.runFor(8000);
  }
  await expect(dialog).toContainText(messages[0]);
  await page.clock.runFor(8000);
  await page.keyboard.press('Escape');
  await page.clock.runFor(16000);
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await expect(dialog).toContainText(messages[0]);
});

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

test('credit suffixes and verified truncated feed titles find the right lyrics', () => {
  for (const suffix of ['ft.', 'ft', 'feat.', 'featuring', '(ft.)']) {
    expect(matchLiveSong({ artist: 'Robbie Williams', title: `Bad Sharon ${suffix}` }))
      .toMatchObject({ status: 'ready', song: { id: 559 } });
  }
  for (const [artist, title, id] of [
    ['Michael Buble', 'Santa Claus Is Co', 335],
    ['Dean Martin', 'Let It Snow! Let It Snow! Let I', 369],
    ['Kylie Minogue', 'Only You ft. James Corden', 31],
    ['Kylie Minogue', '100 Degrees featuring Dannii Minogue', 314],
  ]) expect(matchLiveSong({ artist, title }).song.id).toBe(id);
  for (const title of ['Bad Sharon (Live)', 'Bad Sharon Remix', 'Bad', 'Bad Sharon ft. Unknown']) {
    expect(matchLiveSong({ artist: 'Robbie Williams', title }).status).toBe('unmatched');
  }
  expect(matchLiveSong({ artist: 'Wrong Artist', title: 'Bad Sharon ft.' }).status).toBe('unmatched');
  const ambiguous = [
    { id: 1, artist: 'Artist', song: 'Song feat. Guest', lyrics: 'One' },
    { id: 2, artist: 'Artist', song: 'Song featuring Guest', lyrics: 'Two' },
  ];
  expect(matchLiveSong({ artist: 'Artist', title: 'Song ft. Guest' }, ambiguous).status).toBe('ambiguous');
});

test('identical historical duplicates work but conflicting lyrics and placeholders do not', () => {
  expect(matchLiveSong({ artist: 'The Carpenters', title: 'Merry Christmas Darling' }))
    .toMatchObject({ status: 'ready', song: { id: 99 } });
  expect(matchLiveSong({ artist: 'Bing Crosby', title: 'I Wish You A Merry Christmas' }))
    .toMatchObject({ status: 'ready', song: { id: 204 } });
  expect(matchLiveSong({ artist: 'Frank Sinatra', title: 'Hark The Herald Angels Sing' })).toMatchObject({ status: 'ready', song: { id: 379 } });
  expect(matchLiveSong({ artist: 'Gladys Knight & The Pips', title: "It's Christmas Everyday" })).toMatchObject({ status: 'ready', song: { song: "When You Love Someone (It's Christmas Everyday)" } });
  expect(matchLiveSong({ artist: 'Mike Oldfield', title: 'Il Dulci Jubilo' })).toMatchObject({ status: 'ready', song: { song: 'In Dulci Jubilo' } });
  expect(matchLiveSong({ artist: 'R Kelly World', title: 'Christmas' }).status).toBe('unmatched');
  expect(matchLiveSong({ artist: 'On Ember ft Blend', title: 'on-ember' }).status).toBe('unmatched');
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
  current = { artist: 'Robbie Williams', title: 'Bad Sharon ft.' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog.getByRole('heading', { name: 'Bad Sharon', exact: true })).toBeVisible();
  await expect(dialog.locator('pre')).toHaveText(matchLiveSong(current).song.lyrics);
  current = { artist: 'Unknown Artist', title: 'Unknown Song' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog).toContainText('Lyrics unavailable for this track.');
  await expect(dialog.locator('pre')).toHaveCount(0);
  unavailable = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dialog).toContainText('Hang on, Santa is getting the next track ready. Lyrics on the way!');
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
