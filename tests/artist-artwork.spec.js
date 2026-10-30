import { test, expect } from '@playwright/test';
import { artistArtwork, fallbackArtwork } from '../src/data/artistArtwork.js';
import { existsSync, readdirSync, statSync } from 'node:fs';
import songs from '../src/data/songs.json' with { type: 'json' };

for (const width of [390, 1440]) {
  test(`Robbie exact recordings and shared portrait stay distinct at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const recordings = songs.filter(song => song.artist === 'Robbie Williams');
    expect(recordings.map(song => song.id).sort((a, b) => a - b)).toEqual([288, 487, 559]);
    const paths = {
      288: '/artist-artwork/robbie-williams-walk-this-sleigh.webp',
      487: '/artist-artwork/robbie-williams-cant-stop-christmas.webp',
      559: '/artist-artwork/robbie-williams-bad-sharon.webp',
    };
    const expectedPath = song => paths[song.id];
    await page.goto('/christmas-music');
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('Robbie Williams');
    await expect(page.locator('.song-card')).toHaveCount(recordings.length);
    for (const song of recordings) {
      const card = page.locator(`.song-card[href="/christmas-artist/${song.id}-${song.link}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('img')).toHaveAttribute('src', expectedPath(song));
      await expect.poll(() => card.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    for (const song of recordings) {
      await page.goto(`/christmas-artist/${song.id}-${song.link}`);
      const image = page.locator('.song-artwork-img');
      await expect(image).toHaveAttribute('src', expectedPath(song));
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
        await expect(page.locator(selector)).toHaveAttribute('content',
          `https://www.santaradio.co.uk${expectedPath(song)}`);
      }
    }
  });
}

for (const width of [390, 1440]) {
  test(`Sam Ryder cropped artwork loads on his song page and catalogue at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const song = songs.find(song => song.artist === 'Sam Ryder');
    const path = '/artist-artwork/sam-ryder.webp';
    await page.goto(`/christmas-artist/${song.id}-${song.link}`);
    const image = page.locator('.song-artwork-img');
    await expect(image).toHaveAttribute('src', path);
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBe(500);
    await expect(image).toHaveCSS('border-top-width', '3px');
    await expect(image).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.15)');
    // Check decoded image bytes, independently of the unchanged CSS frame.
    // The original has white padding at all four corners; internal snow is valid.
    const corners = await image.evaluate(el => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 500;
      const context = canvas.getContext('2d');
      context.drawImage(el, 0, 0);
      return [[0, 0], [499, 0], [0, 499], [499, 499]].map(([x, y]) =>
        Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3));
    });
    for (const pixel of corners) expect(Math.min(...pixel)).toBeLessThan(225);
    await page.goto('/christmas-music');
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('Sam Ryder');
    const card = page.locator('.song-card').filter({ hasText: song.artist });
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('img')).toHaveAttribute('src', path);
    await expect.poll(() => card.locator('img').evaluate(el => el.naturalWidth)).toBe(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

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
  await search.fill('Tevin Campbell');
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
