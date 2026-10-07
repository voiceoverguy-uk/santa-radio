import { test, expect } from '@playwright/test';

test('recorded Santa greeting validates names, decodes and downloads the real MP3', async ({ page }) => {
  await page.goto('/free-santa-message');
  const input = page.getByLabel('Child’s first name');
  const submit = page.getByRole('button', { name: 'Find Santa’s message' });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Please enter');
  await input.fill('Not recorded');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Only Arabella');
  await expect(page.locator('.message-result')).toHaveCount(0);
  await input.fill('  aRaBeLlA  ');
  await submit.click();
  await expect(page.getByRole('heading', { name: 'For Arabella, from Santa' })).toBeVisible();
  const audio = page.locator('.message-result audio');
  await expect(audio).not.toHaveAttribute('autoplay');
  expect(await audio.evaluate(a => a.paused)).toBe(true);
  const duration = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      const response = await fetch('/audio/messages/arabella.mp3');
      if (!response.ok) throw new Error('Missing recording');
      return (await context.decodeAudioData(await response.arrayBuffer())).duration;
    } finally { await context.close(); }
  });
  expect(duration).toBeGreaterThan(60);
  expect(duration).toBeLessThan(80);
  await audio.evaluate(async a => { await a.play(); });
  await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download Arabella’s greeting' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Santa-message-for-Arabella.mp3');
  expect(await download.failure()).toBeNull();
  await input.fill('Another name');
  await expect(page.locator('.message-result')).toHaveCount(0);
});

test('message desk fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/free-santa-message');
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
