import { test, expect } from '@playwright/test';

test('all 20 sounds are available and new clips decode and toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.soundboard-btn')).toHaveCount(20);
  const files = ['christmas-dinner-ready', 'merry-kiss-mas', 'no', 'yes', 'ready-for-christmas', 'proper-chrimbo', 'goodbye', 'ho-ho-ho'];
  for (const file of files) {
    const duration = await page.evaluate(async file => {
      const context = new AudioContext();
      try {
        const response = await fetch(`/audio/soundboard/${file}.mp3`);
        if (!response.ok) throw new Error('Missing sound');
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return buffer.duration;
      } finally { await context.close(); }
    }, file);
    expect(duration).toBeGreaterThan(0);
  }
  await page.evaluate(() => {
    window.clips = [];
    HTMLMediaElement.prototype.play = function () { window.clips.push(this); return Promise.resolve(); };
  });
  const first = page.getByRole('button', { name: 'Ho Ho Ho', exact: true });
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await first.click();
  const next = page.getByRole('button', { name: 'Goodbye', exact: true });
  await next.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await expect(next).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.clips.slice(0, -1).every(a => !a.getAttribute('src')))).toBe(true);
  await page.evaluate(() => window.clips.at(-1).dispatchEvent(new Event('ended')));
  await expect(next).toHaveAttribute('aria-pressed', 'false');
});
