import { test, expect } from '@playwright/test';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';
import { existsSync } from 'node:fs';

test('all supplied portraits resolve without guessing collaborations', () => {
  const artists = ['Jose Feliciano', 'Holly Johnson', 'The Beach Boys', 'Nat King Cole', 'Jonas Brothers', 'Jona Lewie', 'Barbra Streisand', 'Bruce Springsteen', 'Robbie Williams', 'Brenda Lee', 'Dean Martin', 'Andy Williams', 'Freya Skye', 'Cliff Richard', 'Paul McCartney', 'Mariah Carey', 'Elton John', 'Ed Sheeran', 'Bing Crosby', 'Michael Bublé'];
  artists.push('Taylor Swift', 'Mel & Kim', 'Engelbert Humperdinck', 'Band Aid', 'Kelly Clarkson', 'Chris Rea', 'Ariana Grande', 'Bastille', 'Miley Cyrus', 'Dido', 'Carly Rae Jepsen', 'Darlene Love', 'Coldplay', 'Ed Sheeran & Elton John', 'Kylie Minogue', 'East 17', 'Frank Sinatra', 'Shakin Stevens', 'Elvis Presley', 'Sia');
  for (const artist of artists) {
    expect(artistArtwork(artist)).not.toBe(fallbackArtwork);
    expect(existsSync(`public${artistArtwork(artist)}`)).toBe(true);
  }
  expect(artistArtwork('Michael Bublé')).toBe(artistArtwork('Michael Buble'));
  expect(artistArtwork('Kylie Minogue')).toBe('/artist-artwork/kylie-minogue.jpg');
  expect(artistArtwork('Ed Sheeran & Elton John')).toBe('/artist-artwork/elton-john-ed-sheeran.jpg');
  expect(artistArtwork('Frank Sinatra and Dean Martin')).toBe(fallbackArtwork);
});

test('catalogue reuses artist artwork and shows Santa for remaining artists', async ({ page }) => {
  await page.goto('/christmas-music');
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  await search.fill('Michael Buble');
  const cards = page.locator('.song-card');
  expect(await cards.count()).toBeGreaterThan(1);
  for (const card of await cards.all()) {
    await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/michael-buble.jpg');
  }
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await search.fill('Kylie');
  await expect(cards.first().locator('img')).toHaveAttribute('src', '/artist-artwork/kylie-minogue.jpg');
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await search.fill('Wham!');
  await expect(cards.first().locator('img')).toHaveAttribute('src', fallbackArtwork);
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await cards.first().click();
  await expect(page).toHaveURL(/christmas-artist/);
});
