import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const { catalogue, aliases } = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8')));
const url = m => `/mugshots/${m.song}`;

test('every retained profile and alias has a valid position in the gallery sequence', () => {
  expect(new Set(catalogue.map(m => m.song)).size).toBe(catalogue.length);
  for (const [slug, canonical] of Object.entries(aliases)) {
    expect(catalogue.findIndex(m => m.song === canonical), slug).toBeGreaterThanOrEqual(0);
  }
  for (let i = 1; i < catalogue.length; i++) {
    expect(catalogue[i - 1].artist.localeCompare(catalogue[i].artist, 'en')).toBeLessThanOrEqual(0);
  }
});

test('neighbour navigation updates full profile, metadata and focus without replacing audio', async ({ page }) => {
  const index = catalogue.findIndex(m => m.artist === 'Jeremy Kyle');
  const current = catalogue[index], next = catalogue[index + 1];
  await page.goto(url(current));
  const navigation = page.getByRole('navigation', { name: 'Browse Mugshots' });
  await expect(page.locator('.mugshot-detail-card').getByRole('navigation', { name: 'Browse Mugshots' })).toBeVisible();
  const navigationBox = await navigation.boundingBox();
  const photoBox = await page.locator('.mugshot-detail-figure').boundingBox();
  expect(navigationBox.y).toBeGreaterThanOrEqual(photoBox.y + photoBox.height);
  await expect(navigation).not.toContainText(catalogue[index + 1].artist);
  await page.evaluate(() => {
    window.savedAudio = document.querySelector('audio');
    window.audioCalls = [];
    for (const method of ['play', 'pause', 'load']) {
      window.savedAudio[method] = () => { window.audioCalls.push(method); return Promise.resolve(); };
    }
  });
  const link = page.getByRole('link', { name: `Next Mugshot: ${next.artist}` });
  await link.focus();
  await expect(link).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${next.song}$`));
  await expect(page.locator('.mugshot-detail-name')).toHaveText(next.artist);
  await expect(page.locator('.mugshot-detail-name')).toBeFocused();
  await expect(page.locator('.mugshot-detail-desc')).toHaveText(next.info);
  await expect(page.locator('.mugshot-detail-photo')).toHaveAttribute('src', next.image);
  await expect(page).toHaveTitle(next.artist);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.santaradio.co.uk${url(next)}`);
  if (next.credit) await expect(page.locator('.mugshot-photo-credit')).toContainText(next.credit);
  else await expect(page.locator('.mugshot-photo-credit')).toHaveCount(0);
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.audioCalls)).toEqual([]);
  await page.getByRole('link', { name: `Previous Mugshot: ${current.artist}` }).click();
  await expect(page.locator('.mugshot-detail-name')).toHaveText(current.artist);
  await page.goBack();
  await expect(page.locator('.mugshot-detail-name')).toHaveText(next.artist);
});

test('first, last, aliases and unknown profiles have correct mobile controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const index of [0, 1, catalogue.length - 1]) {
    await page.goto(url(catalogue[index]));
    const nav = page.getByRole('navigation', { name: 'Browse Mugshots' });
    await expect(nav).toBeVisible();
    await expect(nav.locator('a[rel=prev]')).toHaveCount(index > 0 ? 1 : 0);
    await expect(nav.locator('a[rel=next]')).toHaveCount(index < catalogue.length - 1 ? 1 : 0);
    if (index > 0) await expect(nav.locator('a[rel=prev]')).toHaveAttribute('href', url(catalogue[index - 1]));
    if (index < catalogue.length - 1) await expect(nav.locator('a[rel=next]')).toHaveAttribute('href', url(catalogue[index + 1]));
    for (const link of await nav.locator('a').all()) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const [alias, canonical] = Object.entries(aliases).find(([a, c]) => a !== c);
  const index = catalogue.findIndex(m => m.song === canonical);
  await page.goto(`/mugshots/${alias}`);
  await expect(page.locator('.mugshot-neighbour-next')).toHaveAttribute('href', url(catalogue[index + 1]));
  await page.goto('/mugshots/not-a-real-profile');
  await expect(page.getByRole('heading', { name: 'Celebrity Not Found' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Browse Mugshots' })).toHaveCount(0);
});
