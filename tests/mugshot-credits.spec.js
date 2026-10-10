import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { normalizePhotoCredit } from '../src/data/mugshot-credit.js';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const raw = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));

test('all observed Bruce credit spellings normalise without changing other attributions', () => {
  for (const credit of [
    'Photo: Bruce Davis', 'Bruce Davis', 'Bruce Davis - Celebrity Stalker',
    'Bruce Davis – Celebrity Stalker', 'Brce Davis', 'bruce Davis',
    'Bruce Davis e', 'bruce Davis e', 'Photo credit: Photo: Bruce Davis',
  ]) {
    expect(normalizePhotoCredit(credit)).toBe('Bruce Davis');
  }
  for (const credit of [
    'Photo: Matthew Stone', '@voiceoverman', 'VoiceoverGuy', 'Celebrity Stalker',
    '', 'Bruce Davies', 'Bruce Davis Jr.',
  ]) {
    expect(normalizePhotoCredit(credit)).toBe(credit);
  }
});

test('complete public catalogue has uniform Bruce credits and preserves other credits and originals', () => {
  const before = JSON.stringify(raw);
  const { catalogue } = buildCatalogue(raw);
  const bruce = catalogue.filter(profile => /br(?:u)?ce\s+davis/i.test(profile.credit));
  expect(bruce.length).toBeGreaterThan(0);
  expect(bruce.every(profile => profile.credit === 'Bruce Davis')).toBe(true);
  const others = catalogue.filter(profile => !bruce.includes(profile));
  expect(others.length).toBeGreaterThan(0);
  for (const profile of others) {
    const original = raw.find(row => row.song === profile.song);
    expect(profile.credit).toBe(original.credit);
  }
  expect(JSON.stringify(raw)).toBe(before);
});

test('all corrected profiles show exactly one credit label and named photographers remain intact', async ({ page }) => {
  test.setTimeout(90000);
  const typoCredits = new Set(['Brce Davis', 'bruce Davis', 'Bruce Davis e', 'bruce Davis e']);
  const { catalogue } = buildCatalogue(raw);
  const corrected = catalogue.filter(profile => typoCredits.has(raw.find(row => row.song === profile.song)?.credit));
  const prefixed = catalogue.find(profile => raw.find(row => row.song === profile.song)?.credit === 'Photo: Bruce Davis');
  const others = catalogue.filter(profile => profile.credit !== 'Bruce Davis');
  for (const profile of [...corrected, prefixed, ...others]) {
    await page.goto(`/mugshots/${profile.song}`, { waitUntil: 'domcontentloaded' });
    const caption = page.locator('.mugshot-photo-credit');
    if (profile.credit) {
      await expect(caption).toHaveText(`Photo credit: ${profile.credit}`);
      if (profile.credit === 'Bruce Davis') await expect(caption).not.toContainText('Photo credit: Photo:');
    } else {
      await expect(caption).toHaveCount(0);
    }
  }
});
