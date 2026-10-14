import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';
import { songNeighbours, songPath, songsByArtistAZ } from '../src/seo/catalogue.js';

test('the shared A–Z sequence has adjacent entries and canonical neighbours', () => {
  expect(new Set(songsByArtistAZ.map(song => song.id)).size).toBe(songsByArtistAZ.length);

  const middle = songsByArtistAZ[50];
  const index = songsByArtistAZ.findIndex(song => song.id === middle.id);
  expect(songNeighbours(middle)).toEqual({
    previous: songsByArtistAZ[index - 1],
    next: songsByArtistAZ[index + 1],
  });

  const duplicateAlias = findSong('233-the-carpenters-merry-christmas-darling');
  expect(duplicateAlias.id).toBe(99);
  expect(findSong('233').id).toBe(99);
  expect(songNeighbours(duplicateAlias)).toEqual(songNeighbours(songsByArtistAZ.find(song => song.id === 99)));

  const correctedAlias = findSong('134-michael-buble-ave-maria');
  expect(correctedAlias.id).toBe(328);
  expect(songNeighbours(correctedAlias)).toEqual(songNeighbours(songsByArtistAZ.find(song => song.id === 328)));
});

test('previous and next navigate canonically, update metadata, and preserve the radio player', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  const current = songsByArtistAZ[50];
  const { previous, next } = songNeighbours(current);
  await page.goto(songPath(current));

  const navigation = page.getByRole('navigation', { name: 'Browse Christmas songs' });
  await expect(navigation.getByRole('link', {
    name: `Previous song: ${previous.song} by ${previous.artist}`,
  })).toHaveAttribute('href', songPath(previous));
  await expect(navigation.getByRole('link', {
    name: `Next song: ${next.song} by ${next.artist}`,
  })).toHaveAttribute('href', songPath(next));

  await page.evaluate(() => { window.radioDockBeforeSongNavigation = document.querySelector('.radio-dock'); });
  await navigation.getByRole('link', { name: `Next song: ${next.song} by ${next.artist}` }).click();
  await expect(page).toHaveURL(new RegExp(`${songPath(next)}$`));
  await expect(page.locator('.song-detail-title')).toHaveText(`${next.song} — ${next.artist}`);
  await expect(page).toHaveTitle(`${next.song} — ${next.artist} | Santa Radio`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.santaradio.co.uk${songPath(next)}`);
  expect(await page.evaluate(() =>
    window.radioDockBeforeSongNavigation === document.querySelector('.radio-dock')
  )).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${songPath(current)}$`));
  await expect(page.locator('.song-detail-title')).toHaveText(`${current.song} — ${current.artist}`);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${songPath(next)}$`));
  await expect(page.locator('.song-detail-title')).toHaveText(`${next.song} — ${next.artist}`);
});

test('catalogue ends disable the unavailable direction without wrapping', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  const first = songsByArtistAZ[0];
  const last = songsByArtistAZ.at(-1);

  await page.goto(songPath(first));
  let navigation = page.getByRole('navigation', { name: 'Browse Christmas songs' });
  await expect(navigation.locator('[aria-disabled="true"]')).toContainText('First song in the catalogue');
  await expect(navigation.getByRole('link', { name: /^Previous song:/ })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: `Next song: ${songsByArtistAZ[1].song} by ${songsByArtistAZ[1].artist}` }))
    .toHaveAttribute('href', songPath(songsByArtistAZ[1]));

  await page.goto(songPath(last));
  navigation = page.getByRole('navigation', { name: 'Browse Christmas songs' });
  await expect(navigation.locator('[aria-disabled="true"]')).toContainText('Last song in the catalogue');
  await expect(navigation.getByRole('link', { name: /^Next song:/ })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: `Previous song: ${songsByArtistAZ.at(-2).song} by ${songsByArtistAZ.at(-2).artist}` }))
    .toHaveAttribute('href', songPath(songsByArtistAZ.at(-2)));
});

test('corrected and duplicate historic URLs navigate from their canonical song', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  for (const [alias, id] of [
    ['134-michael-buble-ave-maria', 328],
    ['233-the-carpenters-merry-christmas-darling', 99],
  ]) {
    const song = songsByArtistAZ.find(candidate => candidate.id === id);
    const { next } = songNeighbours(song);
    await page.goto(`/christmas-artist/${alias}`);
    await expect(page.locator('.song-detail-title')).toHaveText(`${song.song} — ${song.artist}`);
    const nextLink = page.getByRole('navigation', { name: 'Browse Christmas songs' })
      .getByRole('link', { name: `Next song: ${next.song} by ${next.artist}` });
    await expect(nextLink).toHaveAttribute('href', songPath(next));
    await nextLink.click();
    await expect(page).toHaveURL(new RegExp(`${songPath(next)}$`));
    await expect(page.locator('.song-detail-title')).toHaveText(`${next.song} — ${next.artist}`);
  }
});

test('song navigation fits a narrow mobile viewport and remains keyboard-operable', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  const longest = [...songsByArtistAZ].sort((a, b) =>
    `${b.song} — ${b.artist}`.length - `${a.song} — ${a.artist}`.length
  )[0];
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(songPath(longest));

  const next = page.getByRole('navigation', { name: 'Browse Christmas songs' })
    .getByRole('link', { name: /^Next song:/ });
  await expect(next).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  let nextReceivedKeyboardFocus = false;
  for (let tab = 0; tab < 40; tab += 1) {
    await page.keyboard.press('Tab');
    if (await next.evaluate(link => document.activeElement === link)) {
      nextReceivedKeyboardFocus = true;
      break;
    }
  }
  expect(nextReceivedKeyboardFocus).toBe(true);
  expect(await next.evaluate(link => link.matches(':focus-visible'))).toBe(true);
  await page.keyboard.press('Enter');
  const nextSong = songNeighbours(longest).next;
  await expect(page).toHaveURL(new RegExp(`${songPath(nextSong)}$`));
  await expect(page.locator('.song-detail-title')).toHaveText(`${nextSong.song} — ${nextSong.artist}`);
});
