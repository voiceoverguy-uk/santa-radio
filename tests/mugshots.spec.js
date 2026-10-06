import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { parseRows, reconcile, repair, plainText, socialUrl } from '../scripts/import-mugshots.js';
import { buildCatalogue, normalizeName } from '../src/data/mugshot-catalogue.js';

const catalogue = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
const report = JSON.parse(fs.readFileSync('reports/mugshot-import.json', 'utf8'));
const publicData = buildCatalogue(catalogue);

test('canonical catalogue excludes empty profiles and preserves retained details', () => {
  expect(publicData.catalogue).toHaveLength(636);
  expect(new Set(publicData.catalogue.map(m => normalizeName(m.artist))).size).toBe(636);
  expect(publicData.removed).toHaveLength(38);
  expect(publicData.catalogue.every(m => m.info.trim())).toBe(true);
  for (const old of catalogue) {
    const kept = publicData.catalogue.find(m => m.song === publicData.aliases[old.song]);
    if (!kept) {
      expect((old.info || '').trim()).toBe('');
      continue;
    }
    expect(kept).toBeTruthy();
    if (old.info) expect(kept.info).toBe(old.info);
    if (old.image) {
      expect(kept.image).toBeTruthy();
      expect(fs.existsSync(`public${kept.image}`)).toBe(true);
    }
  }
  const rows = parseRows(fs.readFileSync('attached_assets/cl57-mugshots_1791308171421.sql', 'utf8'));
  expect(buildCatalogue(reconcile(catalogue, rows).output)).toEqual(publicData);
  const audit = JSON.parse(fs.readFileSync('reports/mugshot-audit.json'));
  expect(audit.review).toHaveLength(636);
  expect(audit.review.find(r => r.name === 'Johannes Radebe')).toMatchObject({ words: 18, category: 'Very short biography' });
  expect(audit.review.find(r => r.name === 'Jack Dee').reason).toContain('Jason Tindall');
});

test('reported duplicate searches show one photo card and old links show full details', async ({ page }) => {
  for (const [name, alias] of [['Batman', 'batman-super-hero'], ['Bernie Clifton', 'bernie-clifton'], ['Bobby Ball', 'bobby-ball']]) {
    await page.goto('/mugshots/all');
    await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill(name);
    await expect(page.locator('.mugshot-card')).toHaveCount(1);
    const img = page.locator('.mugshot-photo');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
    await page.goto(`/mugshots/${alias}`);
    const kept = publicData.catalogue.find(m => m.song === publicData.aliases[alias]);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(kept.info);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.santaradio.co.uk/mugshots/${kept.song}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await expect(page.locator('.mugshots-preview')).toContainText('636');
});

test('import preserves routes and images and safely handles source text', () => {
  expect(catalogue).toHaveLength(735);
  expect(report.matched).toBe(672);
  expect(new Set(catalogue.map(m => m.song)).size).toBe(735);
  for (const entry of report.matches) {
    const m = catalogue.find(m => m.song === entry.slug);
    expect(m.image).toBe(entry.image);
    expect(m.socialUrl === '' || /^https:\/\/x\.com\/[a-z0-9_]{1,15}$/i.test(m.socialUrl)).toBe(true);
  }
  expect(repair('UKâ€™s cafÃ©')).toBe('UK’s café');
  expect(plainText('<script>alert(1)</script><a href="javascript:x">Photo: A &amp; B</a>')).toBe('Photo: A & B');
  expect(socialUrl('https://evil.example/person')).toBe('');
  expect(socialUrl('@Valid_Name')).toBe('https://x.com/Valid_Name');
  expect(socialUrl('@Broken handle')).toBe('');
  expect(() => parseRows("INSERT INTO `messages2` VALUES (1,'broken")).toThrow();
  const rows = parseRows(fs.readFileSync('attached_assets/cl57-mugshots_1791308171421.sql', 'utf8'));
  expect(rows).toHaveLength(664);
  const { output } = reconcile(catalogue, rows);
  expect(output).toEqual(catalogue);
});

test('full biographies, photo credits, safe social links and mobile layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const slug of ['steve-davis-snoker-player', 'jeremy-kyle-tv-personality']) {
    const m = catalogue.find(m => m.song === slug);
    await page.goto(`/mugshots/${slug}`);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(m.info);
    await expect(page.locator('.mugshot-photo-credit')).toContainText('Bruce Davis');
    await expect(page.getByRole('link', { name: `Follow ${m.artist} on X` })).toHaveAttribute('href', m.socialUrl);
    await expect(page.locator('.mugshot-detail-photo')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/mugshots/alesha-santa');
  await expect(page.getByRole('heading', { name: 'Celebrity Not Found' })).toBeVisible();
  await expect(page.locator('.mugshot-social')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Davina has one complete profile and zero-word URLs are unavailable', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/mugshots/all');
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Davina');
  await expect(page.locator('.mugshot-card')).toHaveCount(1);
  await expect(page.locator('.mugshot-card')).toContainText('Davina McCall');
  await page.locator('.mugshot-card').click();
  await expect(page).toHaveURL(/davina-mccall-tv-presenter$/);
  await expect(page.locator('.mugshot-detail-desc')).toContainText('Big Brother');
  await expect.poll(() => page.locator('.mugshot-detail-photo').evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
  for (const m of publicData.removed) {
    await page.goto(`/mugshots/${m.song}`);
    await expect(page.getByRole('heading', { name: 'Celebrity Not Found' })).toBeVisible();
  }
});

test('gallery pagination, search, hover, focus and motion preferences', async ({ page }) => {
  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  await expect(cards).toHaveCount(48);
  await page.getByRole('button', { name: /Load More/ }).click();
  await expect(cards).toHaveCount(96);
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Jeremy Kyle');
  await expect(cards).toHaveCount(1);
  const card = cards.first(), frame = card.locator('.mugshot-photo-frame');
  const animation = () => frame.evaluate(el => getComputedStyle(el, '::after').animationName);
  expect(await animation()).toBe('none');
  await card.hover();
  expect(await animation()).toBe('mugshot-edge-shimmer');
  await page.getByRole('button', { name: 'Effects On', exact: true }).click();
  await card.hover();
  expect(await animation()).toBe('none');
  await expect(card).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Effects Off', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.hover();
  expect(await animation()).toBe('none');
  await expect(card).toHaveCSS('transform', 'none');
  await page.mouse.move(0, 0);
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).focus();
  await page.keyboard.press('Tab');
  await expect(card).toHaveCSS('outline-style', 'solid');
  await card.click();
  await expect(page).toHaveURL(/mugshots\/jeremy-kyle-tv-personality$/);
});

test('missing photos keep a usable fallback', async ({ page }) => {
  await page.route('**/mugshot-images/**', route => route.abort());
  await page.goto('/mugshots/jeremy-kyle-tv-personality');
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  await page.goto('/mugshots/all');
  await expect(page.locator('.mugshot-fallback').first()).toBeVisible();
});
