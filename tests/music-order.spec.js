import { test, expect } from '@playwright/test';

test('music starts shuffled, sorts A–Z and filters without reshuffling', async ({ page }) => {
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const cards = page.locator('.song-card');
  const random = page.getByRole('button', { name: 'Random', exact: true });
  await expect(random).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(452);
  const initial = await cards.evaluateAll(els => els.map(el => el.getAttribute('href')));
  const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
  await search.fill('Sinatra');
  expect(await cards.count()).toBeGreaterThan(0);
  await search.fill('');
  expect(await cards.evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(initial);
  await page.getByRole('button', { name: 'Artist A–Z', exact: true }).click();
  const artists = await page.locator('.song-info strong').allTextContents();
  expect(artists).toEqual([...artists].sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base', numeric: true })));
  await random.click();
  const reshuffled = await cards.evaluateAll(els => els.map(el => el.getAttribute('href')));
  expect(reshuffled).not.toEqual(initial);
  expect([...reshuffled].sort()).toEqual([...initial].sort());
  await search.fill('unfindable-song-xyz');
  await expect(page.locator('.no-results')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
