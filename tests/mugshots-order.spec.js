import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import { matchesMugshot, mugshotSuggestions } from '../src/data/mugshot-search.js';
import { approachMugshotBoundary } from './helpers/mugshots-batches.js';

const { catalogue } = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8')));
const approvedPaths = new Set(catalogue.filter(celeb => celeb.homepage === true).map(celeb => `/mugshots/${celeb.song}`));
const allPaths = catalogue.map(celeb => `/mugshots/${celeb.song}`).sort();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.goto('/mugshots/all');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
});

test('random gallery loads stable batches and supports alphabetical sorting and search', async ({ page }) => {
  const cards = page.locator('.mugshot-card');
  const random = page.getByRole('button', { name: 'Shuffle', exact: true });
  const alphabetical = page.getByRole('button', { name: 'A–Z', exact: true });
  const names = () => cards.locator('strong').allTextContents();
  await expect(random).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(100);
  const first = await names();
  const paths = () => cards.evaluateAll(els => els.map(el => el.getAttribute('href')));
  expect((await paths()).every(path => approvedPaths.has(path))).toBe(true);
  await approachMugshotBoundary(page);
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
  const search = page.getByRole('combobox', { name: 'Find a famous face' });
  await search.fill('Jeremy Kyle');
  await expect(cards).toHaveCount(1);
  await expect(page.locator('.mugshots-batch-sentinel, .mugshots-batch-fallback')).toHaveCount(0);
  await random.click();
  await expect(cards).toHaveCount(1);
  await search.fill('');
  await expect(cards).toHaveCount(100);
  expect(await names()).toEqual(first);
  const loadMore = page.locator('.mugshots-batch-sentinel');
  while (await loadMore.count()) {
    const count = await cards.count();
    await approachMugshotBoundary(page);
    await expect(cards).toHaveCount(Math.min(count + 100, catalogue.length));
  }
  const complete = await paths();
  expect([...complete].sort()).toEqual(allPaths);
  expect(complete.slice(0, approvedPaths.size).every(path => approvedPaths.has(path))).toBe(true);
  expect(complete.slice(approvedPaths.size).every(path => !approvedPaths.has(path))).toBe(true);
  await page.getByRole('combobox', { name: 'Find a famous face' }).fill('Actor');
  const actorPaths = await paths();
  expect(actorPaths.length).toBeGreaterThan(0);
  const firstUnapproved = actorPaths.findIndex(path => !approvedPaths.has(path));
  if (firstUnapproved !== -1) {
    expect(actorPaths.slice(firstUnapproved).every(path => !approvedPaths.has(path))).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1440]) {
  test(`filtered galleries keep selected names first across sorts and batches at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const search = page.getByRole('combobox', { name: 'Find a famous face', exact: true });
    const cards = page.locator('.mugshots-grid .mugshot-card');
    const paths = () => cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    const loadMore = page.locator('.mugshots-batch-sentinel');
    const cataloguePaths = profiles => profiles.map(profile => `/mugshots/${profile.song}`);
    const alphabetically = profiles => [...profiles].sort((a, b) =>
      Number(b.homepage === true) - Number(a.homepage === true) ||
      a.artist.localeCompare(b.artist, 'en', { sensitivity: 'base', numeric: true }));
    const assertPriority = (visible, matches) => {
      const selectedCount = matches.filter(profile => profile.homepage === true).length;
      expect(visible.slice(0, selectedCount).every(path => approvedPaths.has(path))).toBe(true);
      expect(visible.slice(selectedCount).every(path => !approvedPaths.has(path))).toBe(true);
    };
    const shuffledResults = new Map();
    // Repeat Shuffle after A–Z to check that sorting preserves the original shuffle.
    for (const order of ['Shuffle', 'A–Z', 'Shuffle']) {
      await page.getByRole('button', { name: order, exact: true }).click();
      for (const query of ['ry', 'actor']) {
        await search.fill(query);
        const talent = query === 'actor' ?
          mugshotSuggestions(catalogue, query).find(option => option.type === 'talent' && option.label === 'Actor') : null;
        if (talent) await page.getByRole('option', { name: `Talent ${talent.label}`, exact: true }).click();
        const matches = catalogue.filter(profile => matchesMugshot(profile, query, talent));
        await expect(cards).toHaveCount(Math.min(100, matches.length));
        assertPriority(await paths(), matches);
        while (await loadMore.count()) {
          const previous = await paths();
          await approachMugshotBoundary(page);
          await expect(cards).toHaveCount(Math.min(previous.length + 100, matches.length));
          expect((await paths()).slice(0, previous.length)).toEqual(previous);
          assertPriority(await paths(), matches);
        }
        const complete = await paths();
        expect([...complete].sort()).toEqual(cataloguePaths(matches).sort());
        if (order === 'A–Z') {
          expect(complete).toEqual(cataloguePaths(alphabetically(matches)));
        } else if (shuffledResults.has(query)) {
          expect(complete).toEqual(shuffledResults.get(query));
        } else {
          shuffledResults.set(query, complete);
        }
      }
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await expect(search).toHaveValue('');
      await expect(search).toBeFocused();
      await expect(cards).toHaveCount(Math.min(100, catalogue.length));
      assertPriority(await paths(), catalogue);
      if (order === 'A–Z') {
        expect(await paths()).toEqual(cataloguePaths(alphabetically(catalogue)).slice(0, 100));
      }
    }
    await search.fill('ry');
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute('href', `/mugshots/${mugshotSuggestions(catalogue, 'ry')[0].slug}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
