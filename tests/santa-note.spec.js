import { test, expect } from '@playwright/test';
import { santaNotes } from '../src/data/santaNotes.js';

test('Santa bubble shows dots, types the whole message slowly and rotates without Pause', async ({ page }) => {
  expect(santaNotes).toHaveLength(25);
  expect(new Set(santaNotes).size).toBe(25);
  expect(Math.max(...santaNotes.map(text => (`Santa here... ${text}`).length)) * 60 + 900).toBeLessThan(8500);
  const start = new Date('2026-10-07T12:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const bubble = page.locator('.santa-note');
  const text = bubble.locator('.santa-note-text');
  await expect(bubble.locator('button')).toHaveCount(0);
  await expect(bubble.locator('.santa-note-dots')).toBeVisible();
  await expect(text).toHaveText('');
  await page.clock.runFor(1020);
  await expect(text).toHaveText('Sa');
  await page.clock.runFor(3000);
  await expect(text).toHaveText(`Santa here... ${santaNotes[0]}`);
  await page.clock.runFor(5980);
  await expect(text).toHaveAttribute('aria-label', `Santa here... ${santaNotes[1]}`);
  await expect(bubble.locator('.santa-note-dots')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(text).toHaveText(`Santa here... ${santaNotes[1]}`);
  await expect(bubble.locator('.santa-note-dots')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
