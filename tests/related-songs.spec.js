import { test, expect } from '@playwright/test';
import relatedSongs from '../src/data/relatedSongs.js';
import songs from '../src/data/songs.json' with { type: 'json' };

test('same-artist recommendations exclude duplicates, current song and collaborations', () => {
  const current = { id: 1, artist: 'Michael Bublé', song: 'First' };
  expect(relatedSongs(current, [current,
    { id: 2, artist: 'Michael Buble', song: 'Second' },
    { id: 3, artist: 'Michael Buble', song: 'Second' },
    { id: 4, artist: 'Michael Buble & Guest', song: 'Third' },
    { id: 5, artist: 'Michael Buble', song: 'First' },
  ]).map(s => s.id)).toEqual([2]);
});

test('other songs link to working pages and single-title artists have no section', async ({ page }) => {
  const frank = songs.find(s => s.artist === 'Frank Sinatra');
  await page.goto(`/christmas-artist/${frank.id}-${frank.link}`);
  const section = page.getByRole('region', { name: 'More from Frank Sinatra' });
  await expect(section).toBeVisible();
  await expect(section.getByRole('link', { name: frank.song, exact: true })).toHaveCount(0);
  const other = relatedSongs(frank)[0];
  await section.getByRole('link').first().click();
  await expect(page).toHaveURL(new RegExp(`/christmas-artist/${other.id}-`));
  await expect(page.getByRole('heading', { name: other.song, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const wham = songs.find(s => s.artist === 'Wham!');
  await page.goto(`/christmas-artist/${wham.id}-${wham.link}`);
  await expect(page.locator('.more-artist-songs')).toHaveCount(0);
});
