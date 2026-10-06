import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { parseCsv, prepareImport } from '../scripts/import-expanded-biographies.js';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const raw = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
const overrides = JSON.parse(fs.readFileSync('src/data/mugshot-biographies.json', 'utf8'));
const csv = fs.readFileSync('attached_assets/santa-radio-mugshots-6-35-expanded_1791320139756.csv', 'utf8');
const rows = parseCsv(csv);
const current = buildCatalogue(raw);
const original = buildCatalogue(raw, {});

test('152 exact replacements preserve every other field and 3 flagged biographies', () => {
  const result = prepareImport(raw, rows, overrides);
  expect(rows).toHaveLength(155);
  expect(result.overrides).toEqual(overrides);
  expect(result.report.applied).toHaveLength(152);
  expect(result.report.skipped.map(r => r.name)).toEqual(['Gracie Malloy', 'Laurel and Hardy', 'UEFA Trophy']);
  expect(current.catalogue).toHaveLength(636);
  expect(current.removed).toEqual(original.removed);
  expect(current.aliases).toEqual(original.aliases);
  for (const profile of current.catalogue) {
    const before = original.catalogue.find(p => p.song === profile.song);
    expect(profile).toEqual({ ...before, info: overrides[profile.song] || before.info });
  }
  for (const entry of result.report.applied) {
    expect(current.catalogue.find(p => p.song === entry.slug).info).toBe(entry.replacement);
  }
  for (const entry of result.report.skipped) {
    expect(current.catalogue.find(p => p.song === entry.slug).info).toBe(entry.original);
  }
  const report = JSON.parse(fs.readFileSync('reports/mugshot-biography-import.json', 'utf8'));
  expect(report.applied).toEqual(result.report.applied);
  expect(report.skipped).toEqual(result.report.skipped);
});

test('CSV handles quoted content and refuses conflicts or duplicate matches', () => {
  const header = 'Page path,Current biography,Replacement content,Research sources,Editorial notes\n';
  expect(parseCsv(header + '/mugshots/test,old,"A, B\n""quoted""",https://example.com,\n')[0]['Replacement content'])
    .toBe('A, B\n"quoted"');
  expect(() => parseCsv(header + '"unfinished')).toThrow();
  expect(() => prepareImport(raw, [rows[0], rows[0]])).toThrow(/duplicate/);
  expect(() => prepareImport(raw, [{ ...rows[0], 'Page path': '/mugshots/unknown' }])).toThrow(/Missing/);
  expect(() => prepareImport(raw, [{ ...rows[0], 'Current biography': 'changed' }])).toThrow(/changed/);
  expect(() => prepareImport(raw, [{ ...rows[0], 'Replacement content': '' }])).toThrow(/Invalid/);
});

test('expanded text and historical links render on desktop and mobile', async ({ page }) => {
  const applied = prepareImport(raw, rows).report.applied;
  const aliased = applied.find(entry => Object.entries(current.aliases).some(([old, target]) => target === entry.slug && old !== target));
  expect(aliased).toBeTruthy();
  const alias = Object.entries(current.aliases).find(([old, target]) => target === aliased.slug && old !== target)[0];
  for (const [slug, text] of [
    [applied[0].slug, applied[0].replacement],
    [alias, aliased.replacement],
    [applied.at(-1).slug, applied.at(-1).replacement],
  ]) {
    await page.goto(`/mugshots/${slug}`);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(text);
    await expect.poll(() => page.locator('.mugshot-detail-photo').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
