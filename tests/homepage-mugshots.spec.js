import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { selectHomepageMugshots } from '../src/data/homepageMugshots.js';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import { parseRows, reconcile } from '../scripts/import-mugshots.js';

const raw = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
const catalogue = buildCatalogue(raw).catalogue;
test('SQL Yes eligibility survives import and sampling never includes unapproved profiles', () => {
  const rows = parseRows(fs.readFileSync('attached_assets/cl57-mugshots_1791308171421.sql', 'utf8'));
  const restored = reconcile(raw, rows).output;
  expect(raw.map(x => x.homepage)).toEqual(restored.map(x => x.homepage));
  expect(raw.filter(x => x.homepage)).toHaveLength(141);
  for (let i = 0; i < 50; i++) {
    const selected = selectHomepageMugshots(catalogue);
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map(x => x.song)).size).toBe(4);
    expect(selected.every(x => x.homepage === true)).toBe(true);
  }
  expect(selectHomepageMugshots(catalogue, () => 0)).not.toEqual(selectHomepageMugshots(catalogue, () => .99));
  const few = [{ homepage: true }, { homepage: false }, {}, { homepage: 'Yes' }];
  expect(selectHomepageMugshots(few)).toEqual([few[0]]);
  expect(selectHomepageMugshots([])).toEqual([]);
});

test('homepage displays four approved profiles and keeps them stable during interaction', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.mugshots-preview .mug-card');
  await expect(cards).toHaveCount(4);
  const urls = await cards.evaluateAll(elements => elements.map(el => el.getAttribute('href')));
  const eligible = new Set(catalogue.filter(x => x.homepage).map(x => `/mugshots/${x.song}`));
  expect(urls.every(url => eligible.has(url))).toBe(true);
  expect(new Set(urls).size).toBe(4);
  await page.getByRole('button', { name: 'Snow On', exact: true }).click();
  expect(await cards.evaluateAll(elements => elements.map(el => el.getAttribute('href')))).toEqual(urls);
  await cards.first().click();
  await expect(page).toHaveURL(new RegExp(urls[0]));
});
