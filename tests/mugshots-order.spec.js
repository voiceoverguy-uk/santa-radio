import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const { catalogue } = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8')));
const approvedPaths = new Set(catalogue.filter(celeb => celeb.homepage === true).map(celeb => `/mugshots/${celeb.song}`));
const allPaths = catalogue.map(celeb => `/mugshots/${celeb.song}`).sort();

test('random gallery loads stable batches and supports alphabetical sorting and search', async ({ page }) => {
  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  const random = page.getByRole('button', { name: 'Random order', exact: true });
  const alphabetical = page.getByRole('button', { name: 'Alphabetical order', exact: true });
  const names = () => cards.locator('strong').allTextContents();
  await expect(random).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(100);
  const first = await names();
  const paths = () => cards.evaluateAll(els => els.map(el => el.getAttribute('href')));
  expect((await paths()).every(path => approvedPaths.has(path))).toBe(true);
  await page.getByRole('button', { name: /Load More/ }).click();
  await expect(cards).toHaveCount(200);
  expect((await names()).slice(0, 100)).toEqual(first);
  expect(new Set(await cards.evaluateAll(els => els.map(el => el.href))).size).toBe(200);
  const secondBatch = await paths();
  expect(secondBatch.slice(0, approvedPaths.size).every(path => approvedPaths.has(path))).toBe(true);
  expect(secondBatch.slice(approvedPaths.size).every(path => !approvedPaths.has(path))).toBe(true);
  await alphabetical.click();
  await expect(alphabetical).toHaveAttribute('aria-pressed', 'true');
  await expect(random).toHaveAttribute('aria-pressed', 'false');
  await expect(cards).toHaveCount(100);
  const sorted = await names();
  expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })));
  expect(sorted).not.toEqual(first);
  const search = page.getByRole('textbox', { name: 'Search celebrity names or roles' });
  await search.fill('Jeremy Kyle');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Load More/ })).toHaveCount(0);
  await random.click();
  await expect(cards).toHaveCount(1);
  await search.fill('');
  await expect(cards).toHaveCount(100);
  expect(await names()).toEqual(first);
  const loadMore = page.getByRole('button', { name: /Load More/ });
  while (await loadMore.count()) {
    const count = await cards.count();
    await loadMore.click();
    await expect(cards).toHaveCount(Math.min(count + 100, catalogue.length));
  }
  const complete = await paths();
  expect([...complete].sort()).toEqual(allPaths);
  expect(complete.slice(0, approvedPaths.size).every(path => approvedPaths.has(path))).toBe(true);
  expect(complete.slice(approvedPaths.size).every(path => !approvedPaths.has(path))).toBe(true);
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Actor');
  const actorPaths = await paths();
  expect(actorPaths.length).toBeGreaterThan(0);
  const firstUnapproved = actorPaths.findIndex(path => !approvedPaths.has(path));
  if (firstUnapproved !== -1) {
    expect(actorPaths.slice(firstUnapproved).every(path => !approvedPaths.has(path))).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
