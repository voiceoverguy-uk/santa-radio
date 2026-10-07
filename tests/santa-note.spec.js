import { test, expect } from '@playwright/test';
import { santaNotes, daysUntilChristmasEve, formatSantaNote } from '../src/data/santaNotes.js';

test('compact mobile Santa bubbles show every message in full without moving the reserved slot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const text = page.locator('.santa-note-text');
  await expect(text).toContainText('Santa here...');
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const sizes = await text.evaluate((element, notes) => {
      const span = element.querySelector('span');
      return notes.map(note => {
        span.textContent = `Santa here... ${note}`;
        // Measure every complete rotating message, including the longest ones.
        const range = document.createRange();
        range.selectNodeContents(span);
        const content = range.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return {
          height: box.height,
          slotHeight: element.closest('.hero-santa-note').getBoundingClientRect().height,
          fits: content.top >= box.top && content.bottom <= box.bottom
            && content.left >= box.left && content.right <= box.right,
        };
      });
    }, santaNotes.map(note => formatSantaNote(note, 78)));
    expect(sizes[0].height).toBeLessThanOrEqual(80);
    expect(sizes.every(size => size.fits)).toBe(true);
    expect(new Set(sizes.map(size => size.slotHeight)).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Christmas Eve notes use calendar days and roll over after Christmas Eve', () => {
  expect(daysUntilChristmasEve(new Date(2026, 9, 7, 23, 59))).toBe(78);
  expect(daysUntilChristmasEve(new Date(2026, 11, 23, 12))).toBe(1);
  expect(daysUntilChristmasEve(new Date(2026, 11, 24, 23, 59))).toBe(0);
  expect(daysUntilChristmasEve(new Date(2026, 11, 25))).toBe(364);
  expect(daysUntilChristmasEve(new Date(2028, 0, 1))).toBe(358);
  expect(formatSantaNote(santaNotes[3], 1)).toBe("Head Elf tells me we'll be ready in 1 day!");
  expect(formatSantaNote(santaNotes[3], 78)).toBe("Head Elf tells me we'll be ready in 78 days!");
});

test('Santa shows dots then the entire message at once, rotates and respects reduced motion', async ({ page }) => {
  expect(santaNotes).toHaveLength(51);
  expect(new Set(santaNotes).size).toBe(51);
  const start = new Date('2026-10-07T12:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'FREE Audio Message', exact: true })).toBeVisible();
  const bubble = page.locator('.santa-note');
  const text = bubble.locator('.santa-note-text');
  await expect(bubble.getByText('Sent with Elfie', { exact: true })).toBeVisible();
  await expect(bubble.locator('button')).toHaveCount(0);
  await expect(bubble.locator('.santa-note-dots')).toBeVisible();
  await expect(text).toHaveText('');
  await page.clock.runFor(1900);
  await expect(bubble.locator('.santa-note-dots')).toBeVisible();
  await expect(text).toHaveText('');
  await page.clock.runFor(100);
  await expect(text).toHaveText(`Santa here... ${santaNotes[0]}`);
  await expect(bubble.locator('.santa-note-dots')).toHaveCount(0);
  await expect(text).toHaveAttribute('aria-label', `Santa here... ${santaNotes[0]}`);
  await page.clock.runFor(13000);
  await expect(text).toHaveAttribute('aria-label', `Santa here... ${santaNotes[1]}`);
  await expect(bubble.locator('.santa-note-dots')).toBeVisible();
  await expect(text).toHaveText('');
  await page.clock.runFor(1900);
  await expect(text).toHaveText('');
  await page.clock.runFor(100);
  await expect(text).toHaveText(`Santa here... ${santaNotes[1]}`);
  await page.clock.runFor(13000);
  await expect(text).toHaveText('');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(text).toHaveText(`Santa here... ${santaNotes[2]}`);
  await expect(bubble.locator('.santa-note-dots')).toHaveCount(0);
  await page.clock.runFor(15000);
  await expect(text).toHaveText("Santa here... Head Elf tells me we'll be ready in 78 days!");
  await page.clock.setSystemTime(new Date('2026-10-08T12:00:00Z'));
  await page.clock.runFor(1000);
  await expect(text).toHaveText("Santa here... Head Elf tells me we'll be ready in 77 days!");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
