import { test, expect } from '@playwright/test';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';
import { existsSync, readdirSync, statSync } from 'node:fs';
import songs from '../src/data/songs.json' with { type: 'json' };

test('song pages use shared artist portraits and the Santa fallback', async ({ page }) => {
  for (const artist of ['Frank Sinatra', 'Kylie Minogue', 'Waitresses']) {
    const song = songs.find(s => s.artist === artist);
    await page.goto(`/christmas-artist/${song.id}-${song.link}`);
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', artistArtwork(artist));
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.song-artwork-placeholder')).toHaveCount(0);
  }
});

test('all supplied portraits resolve without guessing collaborations', () => {
  const artists = ['Jose Feliciano', 'Holly Johnson', 'The Beach Boys', 'Nat King Cole', 'Jonas Brothers', 'Jona Lewie', 'Barbra Streisand', 'Bruce Springsteen', 'Robbie Williams', 'Brenda Lee', 'Dean Martin', 'Andy Williams', 'Freya Skye', 'Cliff Richard', 'Paul McCartney', 'Mariah Carey', 'Elton John', 'Ed Sheeran', 'Bing Crosby', 'Michael Bublé'];
  artists.push('Taylor Swift', 'Mel & Kim', 'Engelbert Humperdinck', 'Band Aid', 'Kelly Clarkson', 'Chris Rea', 'Ariana Grande', 'Bastille', 'Miley Cyrus', 'Dido', 'Carly Rae Jepsen', 'Darlene Love', 'Coldplay', 'Ed Sheeran & Elton John', 'Kylie Minogue', 'East 17', 'Frank Sinatra', 'Shakin Stevens', 'Elvis Presley', 'Sia');
  artists.push('Chris De Burgh', 'Pet Shop Boys', 'Gwen Stefani', 'The Jackson 5', 'John Lennon', 'Johnny Mathis', 'Queen', 'Sam Ryder', 'Blossoms', 'Frank Sinatra and Dean Martin', 'Aled Jones', 'Bon Jovi', 'The Darkness', 'Wham!', 'Greg Lake', 'Spice Girls', 'Kelly Clarkson & Ariana Grande', 'The Ronettes', 'Lindsey Lohan');
  for (const artist of artists) {
    expect(artistArtwork(artist)).not.toBe(fallbackArtwork);
    expect(existsSync(`public${artistArtwork(artist)}`)).toBe(true);
  }
  expect(artistArtwork('Michael Bublé')).toBe(artistArtwork('Michael Buble'));
  expect(artistArtwork('Kylie Minogue')).toBe('/artist-artwork/kylie-minogue.webp');
  expect(artistArtwork('Ed Sheeran & Elton John')).toBe('/artist-artwork/elton-john-ed-sheeran.webp');
  expect(artistArtwork('Frank Sinatra and Dean Martin')).toBe('/artist-artwork/dean-martin-and-frank-sinatra.webp');
  expect(artistArtwork('Kelly Clarkson & Ariana Grande')).toBe('/artist-artwork/kelly-clarkson-and-ariana-grande.webp');
  expect(artistArtwork('Frank Sinatra & Cyndi Lauper')).toBe(fallbackArtwork);
});

test('catalogue reuses artist artwork and shows Santa for remaining artists', async ({ page }) => {
  await page.goto('/christmas-music');
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  await search.fill('Michael Buble');
  const cards = page.locator('.song-card');
  expect(await cards.count()).toBeGreaterThan(1);
  for (const card of await cards.all()) {
    await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/michael-buble.webp');
  }
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await search.fill('Kylie');
  await expect(cards.first().locator('img')).toHaveAttribute('src', '/artist-artwork/kylie-minogue.webp');
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await search.fill('Wham!');
  await expect(cards.first().locator('img')).toHaveAttribute('src', '/artist-artwork/wham.webp');
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await search.fill('Waitresses');
  await expect(cards.first().locator('img')).toHaveAttribute('src', fallbackArtwork);
  await cards.first().scrollIntoViewIfNeeded();
  await expect.poll(() => cards.first().locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await cards.first().click();
  await expect(page).toHaveURL(/christmas-artist/);
});

test('every existing JPEG portrait has a smaller WebP replacement', () => {
  const originals = readdirSync('public/artist-artwork').filter(file => file.endsWith('.jpg'));
  expect(originals.length).toBeGreaterThan(0);
  for (const original of originals) {
    const replacement = original.replace(/\.jpg$/, '.webp');
    expect(existsSync(`public/artist-artwork/${replacement}`)).toBe(true);
    expect(statSync(`public/artist-artwork/${replacement}`).size)
      .toBeLessThan(statSync(`public/artist-artwork/${original}`).size);
  }
  for (const song of songs) {
    const image = artistArtwork(song.artist);
    if (image !== fallbackArtwork) {
      expect(image.endsWith('.webp')).toBe(true);
      expect(existsSync(`public${image}`)).toBe(true);
    }
  }
});
