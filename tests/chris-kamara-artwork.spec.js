import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { artistArtwork } from '../src/data/artistArtwork.js';

test('Chris Kamara portrait is a compact WebP and loads on the card and song page', async ({ page }) => {
  const artwork = '/artist-artwork/chris-kamara.webp';
  expect(artistArtwork('Chris Kamara')).toBe(artwork);
  const bytes = fs.readFileSync(`public${artwork}`);
  expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  expect(bytes.length).toBeLessThan(100000);
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('Chris Kamara');
  const card = page.locator('.song-card');
  await expect(card).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('img')).toHaveAttribute('src', artwork);
  await expect.poll(() => card.locator('img').evaluate(el => el.complete && el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  await card.click();
  const image = page.locator('.song-artwork-img');
  await expect(image).toHaveAttribute('src', artwork);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth === 512)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
