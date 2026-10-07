import { test, expect } from '@playwright/test';

test('recorded Santa greeting validates names, decodes and downloads the real MP3', async ({ page }) => {
  await page.goto('/free-santa-message');
  const input = page.getByLabel('Child’s first name');
  const submit = page.getByRole('button', { name: 'Create message' });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Please enter');
  await input.fill('Not recorded');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('suggested names');
  await expect(page.locator('.message-result')).toHaveCount(0);
  await input.fill('A');
  await expect(page.getByRole('option', { name: 'Arabella' })).toBeVisible();
  await input.fill('oli');
  await expect(page.getByRole('option', { name: 'Olivia' })).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('Olivia');
  await submit.click();
  await expect(page.getByRole('heading', { name: 'For Olivia, from Santa' })).toBeVisible({ timeout: 90000 });
  const audio = page.locator('.message-result audio');
  await expect(audio).not.toHaveAttribute('autoplay');
  expect(await audio.evaluate(a => a.paused)).toBe(true);
  const duration = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      const response = await fetch(document.querySelector('.message-result audio').src);
      if (!response.ok) throw new Error('Missing recording');
      return (await context.decodeAudioData(await response.arrayBuffer())).duration;
    } finally { await context.close(); }
  });
  expect(duration).toBeGreaterThan(65);
  expect(duration).toBeLessThan(75);
  await audio.evaluate(async a => { await a.play(); });
  await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download Olivia’s greeting' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Santa-message-for-Olivia.mp3');
  expect(await download.failure()).toBeNull();
  await input.fill('Another name');
  await expect(page.locator('.message-result')).toHaveCount(0);
});

test('suggestions cover all names without rendering until requested', async ({ page }) => {
  let renders = 0;
  page.on('request', req => { if (req.url().includes('/api/santa-message')) renders++; });
  await page.goto('/free-santa-message');
  const input = page.getByLabel('Child’s first name');
  for (const name of ['Arabella', 'Charlotte', 'Freya', 'Harry', 'Jack', 'Jess', 'Layla', 'Olivia']) {
    await input.fill(name.slice(0, 2));
    await page.getByRole('option', { name, exact: true }).click();
    await expect(input).toHaveValue(name);
  }
  expect(renders).toBe(0);
  await input.fill('Unknown');
  await expect(page.getByText('No matching recording yet. Try another name.')).toBeVisible();
  await page.route('**/api/santa-message', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Please try again.' }) }));
  await input.fill('Jack');
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again.');
  await expect(page.getByRole('button', { name: 'Create message' })).toBeEnabled();
});

test('message desk fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/free-santa-message');
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
