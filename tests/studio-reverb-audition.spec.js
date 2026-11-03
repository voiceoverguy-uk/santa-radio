import { test, expect } from '@playwright/test';

test('preview audition plays both MP3s, pauses the other player, seeks, and never autoplays', async ({ page }) => {
  await page.goto('/preview/studio-voice-reverb');
  await expect(page.getByRole('heading', { name: 'Studio voice reverb audition' })).toBeVisible();
  const players = page.locator('audio');
  await expect(players).toHaveCount(2);
  expect(await players.evaluateAll(elements => elements.every(audio => audio.paused && !audio.autoplay && audio.preload === 'none'))).toBe(true);
  for (let index = 0; index < 2; index++) {
    await players.nth(index).evaluate(audio => audio.play());
    await expect.poll(() => players.nth(index).evaluate(audio => audio.currentTime)).toBeGreaterThan(0.2);
    expect(await players.nth(1 - index).evaluate(audio => audio.paused)).toBe(true);
    expect(await players.nth(index).evaluate(audio => audio.error)).toBe(null);
    expect(await players.nth(index).evaluate(audio => audio.duration)).toBeGreaterThan(10);
  }
  for (let index = 0; index < 2; index++) {
    await players.nth(index).evaluate(audio => audio.play());
    await players.nth(index).evaluate(audio => { audio.currentTime = audio.duration - 0.4; });
    await expect.poll(() => players.nth(index).evaluate(audio => audio.ended)).toBe(true);
  }
  // Same page works on a phone without overflowing or hiding the controls.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
