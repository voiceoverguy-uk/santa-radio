import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import { approachMugshotBoundary } from './helpers/mugshots-batches.js';

const { catalogue } = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8')));
const cardsOn = page => page.locator('.mugshots-grid .mugshot-card');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
});

async function openGallery(page) {
  await page.goto('/mugshots/all');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

for (const width of [390, 1440]) {
  test(`successive automatic batches preserve cards, focus and scroll and exhaust at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openGallery(page);
    const cards = cardsOn(page);
    await expect(cards).toHaveCount(100);
    await expect(page.locator('.load-more-btn')).toHaveCount(0);
    await expect(page.locator('.mugshots-batch-fallback')).toHaveCSS('clip-path', 'inset(50%)');
    // Keep a real existing card focused, without triggering the last-card keyboard path.
    await cards.nth(90).focus();
    await cards.first().evaluate(node => { window.retainedCard = node; });
    const focus = await page.evaluate(() => document.activeElement.getAttribute('href'));
    while (await page.locator('.mugshots-batch-sentinel').count()) {
      const previous = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
      await approachMugshotBoundary(page);
      const position = await page.evaluate(() => window.scrollY);
      await expect(cards).toHaveCount(Math.min(previous.length + 100, catalogue.length));
      expect((await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).slice(0, previous.length)).toEqual(previous);
      expect(await page.evaluate(() => document.activeElement.getAttribute('href'))).toBe(focus);
      expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(position, 0);
      expect(await cards.first().evaluate(node => node === window.retainedCard)).toBe(true);
    }
    await expect(cards).toHaveCount(catalogue.length);
    const paths = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    expect(new Set(paths).size).toBe(catalogue.length);
    expect([...paths].sort()).toEqual(catalogue.map(profile => `/mugshots/${profile.song}`).sort());
    await expect(page.locator('.mugshots-batch-fallback')).toHaveCount(0);
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'All matching mugshots are shown.' })).toHaveCount(1);
    // Further scrolling at the end must not restart observation.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await expect(cards).toHaveCount(catalogue.length);
    const search = page.getByRole('combobox', { name: 'Find a famous face' });
    await search.fill('Jeremy Kyle');
    await expect(cards).toHaveCount(1);
    await expect(page.locator('.mugshots-batch-sentinel')).toHaveCount(0);
    await search.fill('no-such-famous-face-1099');
    await expect(cards).toHaveCount(0);
    await expect(page.locator('.mugshots-batch-fallback')).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(cards).toHaveCount(100);
    await approachMugshotBoundary(page);
    await expect(cards).toHaveCount(200);
    await page.getByRole('button', { name: 'A–Z', exact: true }).click();
    await expect(cards).toHaveCount(100);
    expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))))
      .toEqual(catalogue.slice(0, 100).map(profile => `/mugshots/${profile.song}`));
    await expect(cards.first().locator('img')).toHaveAttribute('loading', 'lazy');
  });
}

test('keyboard reaches appended cards without moving focus and unsupported browsers have a usable fallback', async ({ page }) => {
  await page.addInitScript(() => { window.IntersectionObserver = undefined; });
  await openGallery(page);
  const cards = cardsOn(page);
  const fallback = page.getByRole('button', { name: /Show next mugshots/ });
  await expect(fallback).toBeVisible();
  await expect(cards).toHaveCount(100);
  await cards.nth(98).focus();
  await page.keyboard.press('Tab');
  await expect(cards).toHaveCount(200);
  await expect(cards.nth(99)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cards.nth(100)).toBeFocused();
  await fallback.focus();
  while (await cards.count() < catalogue.length) {
    const before = await cards.count();
    await page.keyboard.press('Enter');
    await expect(cards).toHaveCount(Math.min(before + 100, catalogue.length));
    await expect(page.locator('.mugshots-batch-fallback')).toBeFocused();
  }
  await expect(page.locator('.mugshots-batch-fallback')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(catalogue.length);
  await page.keyboard.press('Tab');
  await expect(page.locator('.mugshots-batch-fallback')).toHaveCount(0);
});

test('duplicate and stale observer notifications cannot advance new search or sort results', async ({ page }) => {
  await page.addInitScript(() => {
    window.galleryObservers = [];
    window.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; window.galleryObservers.push(this); }
      observe(node) { this.node = node; }
      disconnect() { this.disconnected = true; }
    };
  });
  await openGallery(page);
  const cards = cardsOn(page);
  await expect(cards).toHaveCount(100);
  await page.evaluate(() => {
    const observer = window.galleryObservers.findLast(item =>
      !item.disconnected && item.node?.classList.contains('mugshots-batch-sentinel'));
    window.oldGalleryObserver = observer;
    for (let i = 0; i < 5; i++) observer.callback([{ isIntersecting: true }]);
  });
  await expect(cards).toHaveCount(200);
  await page.evaluate(() => {
    window.pendingGalleryObserver = window.galleryObservers.findLast(item =>
      !item.disconnected && item.node?.classList.contains('mugshots-batch-sentinel'));
  });
  await page.getByRole('button', { name: 'A–Z', exact: true }).click();
  await expect(cards).toHaveCount(100);
  await page.evaluate(() => {
    window.oldGalleryObserver.callback([{ isIntersecting: true }]);
    window.pendingGalleryObserver.callback([{ isIntersecting: true }]);
    window.pendingGalleryObserver = window.galleryObservers.findLast(item =>
      !item.disconnected && item.node?.classList.contains('mugshots-batch-sentinel'));
  });
  await expect(cards).toHaveCount(100);
  await page.getByRole('combobox', { name: 'Find a famous face' }).fill('Jeremy Kyle');
  await expect(cards).toHaveCount(1);
  expect(await page.evaluate(() => window.oldGalleryObserver.disconnected)).toBe(true);
  await page.evaluate(() => window.pendingGalleryObserver.callback([{ isIntersecting: true }]));
  await expect(cards).toHaveCount(1);
  await cards.first().click();
  expect(await page.evaluate(() => window.galleryObservers.filter(item =>
    item.node?.classList.contains('mugshots-batch-sentinel')).every(item => item.disconnected))).toBe(true);
});
