import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { openMessageDesk } from './helpers/message-access.js';
import { savedSantaGreeting as pilot } from '../src/data/savedSantaGreeting.js';

let savedBytes;
test.beforeAll(async () => {
  const response = await fetch(pilot.url, { signal: AbortSignal.timeout(10000) });
  expect(response.status).toBe(200);
  savedBytes = Buffer.from(await response.arrayBuffer());
  expect(createHash('sha256').update(savedBytes).digest('hex')).toBe(pilot.sha256);
});

async function createArabella(page) {
  await openMessageDesk(page);
  await page.getByLabel('Child’s first name').fill('Arabella');
  await page.getByRole('option', { name: 'Arabella', exact: true }).click();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'For Arabella, from Santa' })).toBeVisible({ timeout: 90000 });
}

test('CORS-enabled saved hit has zero generation calls and preserves bytes, playback, download and native sharing', async ({ page }) => {
  test.setTimeout(90000);
  let generations = 0;
  await page.route('**/api/santa-message', route => { generations++; return route.abort(); });
  await page.route(`${pilot.url}?*`, route => route.fulfill({
    contentType: 'audio/mpeg', body: savedBytes, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: async ({ files }) => {
      const file = files[0];
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      window.sharedGreeting = {
        name: file.name, type: file.type, size: file.size,
        sha256: Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join(''),
      };
    } });
  });
  await createArabella(page);
  const audio = page.locator('.message-result audio');
  await audio.evaluate(element => element.play());
  await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download Arabella’s greeting' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Santa-message-for-Arabella.mp3');
  expect(await readFile(await download.path())).toEqual(savedBytes);
  await page.getByRole('button', { name: 'Share this greeting' }).click();
  await expect.poll(() => page.evaluate(() => window.sharedGreeting)).toEqual({
    name: 'Santa-message-for-Arabella.mp3', type: 'audio/mpeg', size: pilot.bytes, sha256: pilot.sha256,
  });
  expect(generations).toBe(0); // No generation endpoint => no name download, decode or FFmpeg.
});

test('forced saved-file failure falls back to actual FFmpeg generation, preserving the greeting', async ({ page }) => {
  test.setTimeout(120000);
  let generations = 0;
  page.on('request', request => { if (request.url().endsWith('/api/santa-message')) generations++; });
  await page.route(`${pilot.url}?*`, route => route.fulfill({
    status: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Missing',
  }));
  await createArabella(page);
  const result = await page.locator('.message-result audio').evaluate(async element => {
    const bytes = await (await fetch(element.src)).arrayBuffer();
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(bytes.slice(0));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return { duration: decoded.duration,
        sha256: Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('') };
    } finally { await context.close(); }
  });
  expect(result.duration).toBeGreaterThan(35);
  expect(result.duration).toBeLessThan(50);
  expect(result.sha256).toBe(pilot.sha256);
  expect(generations).toBe(1);
});

test('real cPanel CORS is reported, not replaced with simulated success', async ({ page }, info) => {
  test.setTimeout(90000);
  for (const origin of [new URL(info.project.use.baseURL).origin, 'https://www.santaradio.co.uk']) {
    await page.goto(`${origin}/free-santa-message`);
    const result = await page.evaluate(async url => {
      try {
        const response = await fetch(url, {
          mode: 'cors', credentials: 'omit', cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        return { readable: response.ok, bytes: (await response.arrayBuffer()).byteLength };
      } catch (error) { return { readable: false, error: error.name }; }
    }, `${pilot.url}?recipe=${pilot.recipeVersion}`);
    console.log('REAL_CORS', origin, JSON.stringify(result));
    await info.attach(`cors-${new URL(origin).hostname}`, { body: JSON.stringify(result), contentType: 'application/json' });
    // Either setting is valid operationally: a blocked host must remain a miss.
    if (result.readable) expect(result.bytes).toBe(pilot.bytes);
    else expect(['TypeError', 'TimeoutError']).toContain(result.error);
  }
});
