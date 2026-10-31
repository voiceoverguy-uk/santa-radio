import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const catalogue = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'))).catalogue;
const cardsSelector = '.mugshots-preview .mug-card';
const urls = page => page.locator(cardsSelector).evaluateAll(cards => cards.map(card => card.getAttribute('href')));

async function prepare(page, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '' }));
  await page.goto('/');
  await expect(page.locator(cardsSelector)).toHaveCount(4);
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

async function checkBindings(page) {
  const records = await page.locator(cardsSelector).evaluateAll(cards => cards.map(card => ({
    href: card.getAttribute('href'),
    name: card.querySelector('strong').textContent,
    role: card.querySelector('.mug-info > span').textContent,
    src: card.querySelector('img')?.getAttribute('src'),
    alt: card.querySelector('img')?.getAttribute('alt'),
  })));
  expect(new Set(records.map(record => record.href)).size).toBe(4);
  for (const record of records) {
    const profile = catalogue.find(profile => `/mugshots/${profile.song}` === record.href);
    expect(profile?.homepage).toBe(true);
    expect(record.name).toBe(profile.artist);
    expect(record.role).toBe(profile.link);
    expect(record.src).toBe(profile.image);
    expect(record.alt).toBe(`${profile.artist} holding a Santa Radio mug`);
  }
}

for (const width of [1440, 390]) {
  test(`new approved batches replace cards left to right every ten seconds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await prepare(page);
    const initial = await urls(page);
    await page.clock.runFor(9999);
    expect(await urls(page)).toEqual(initial);
    await page.clock.runFor(1);
    let current = await urls(page);
    expect(current[0]).not.toBe(initial[0]);
    expect(current.slice(1)).toEqual(initial.slice(1));
    await checkBindings(page);
    for (let index = 1; index < 4; index++) {
      await page.clock.runFor(350);
      current = await urls(page);
      expect(current.slice(0, index + 1).every(url => !initial.includes(url))).toBe(true);
      expect(current.slice(index + 1)).toEqual(initial.slice(index + 1));
      await checkBindings(page);
    }
    const second = await urls(page);
    await page.clock.runFor(8949);
    expect(await urls(page)).toEqual(second);
    await page.clock.runFor(1);
    expect((await urls(page))[0]).not.toBe(second[0]);
    expect((await urls(page)).slice(1)).toEqual(second.slice(1));
    await page.clock.runFor(1050);
    await checkBindings(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.mugshots-card-content').first().evaluate(node => getComputedStyle(node).animationName)).toBe('mugshots-photo-reveal');
  });
}

test('hover and keyboard focus pause replacement, then resume on a fresh ten-second cycle', async ({ page }) => {
  await prepare(page);
  const cards = page.locator(cardsSelector);
  const initial = await urls(page);
  await cards.first().hover();
  await page.clock.runFor(20000);
  expect(await urls(page)).toEqual(initial);
  await page.mouse.move(0, 0);
  await cards.first().focus();
  await page.clock.runFor(20000);
  expect(await urls(page)).toEqual(initial);
  await page.locator('.mugshots-gallery-button').focus();
  await page.clock.runFor(9999);
  expect(await urls(page)).toEqual(initial);
  await page.clock.runFor(1051);
  expect((await urls(page)).every(url => !initial.includes(url))).toBe(true);
});

test('pause control cancels a partly replaced row and allows deliberate resuming', async ({ page }) => {
  await prepare(page, 'reduce');
  await page.clock.runFor(10000);
  const partial = await urls(page);
  await page.getByRole('button', { name: 'Pause photo refresh' }).click();
  await expect(page.getByRole('button', { name: 'Resume photo refresh' })).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(30000);
  expect(await urls(page)).toEqual(partial);
  await page.getByRole('button', { name: 'Resume photo refresh' }).click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(11050);
  expect((await urls(page)).every(url => !partial.includes(url))).toBe(true);
  expect(await page.locator('.mugshots-card-content').first().evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await checkBindings(page);
});

test('hidden tabs pause and navigation clears pending replacements', async ({ page }) => {
  await prepare(page);
  const initial = await urls(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(30000);
  expect(await urls(page)).toEqual(initial);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(11050);
  expect((await urls(page)).every(url => !initial.includes(url))).toBe(true);
  await page.locator('.mugshots-gallery-button').click();
  await expect(page).toHaveURL(/\/mugshots\/all$/);
  await page.clock.runFor(20000);
  await expect(page.locator(cardsSelector)).toHaveCount(0);
  await expect(page.locator('.mugshots-page-hero')).toBeVisible();
});
