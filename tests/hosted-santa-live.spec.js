import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { openMessageDesk } from './helpers/message-access.js';
import { fetchLimited, parseNameIndex, NAMES_INDEX, localRecords } from '../server/santa-name-library.js';

// Explicitly opt in: real read-only host GETs and two on-demand Preview renders.
// Only Brevo acceptance is intercepted, in this isolated browser context.
test('real hosted catalogue, selection, playback, downloads and two-message allowance in Preview', async ({ page }, info) => {
  test.skip(process.env.HOSTED_SANTA_LIVE_TEST !== '1', 'Opt in with HOSTED_SANTA_LIVE_TEST=1; never target production.');
  expect(new URL(info.project.use.baseURL).hostname).toMatch(/(?:\.replit\.dev|^127\.0\.0\.1|^localhost)$/);
  test.setTimeout(120000);
  const catalogue = parseNameIndex(await fetchLimited(NAMES_INDEX, 2 * 1024 * 1024));
  const selected = catalogue.find(record => record.file === 'demrie.mp3');
  expect(selected).toBeTruthy();
  expect(localRecords.some(record => record.id === selected.id)).toBe(false);
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  let renders = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/santa-message' && request.method() === 'POST') renders++;
  });
  await openMessageDesk(page, { mockNames: false });
  await expect(page.locator('.message-name-count')).toHaveText(`${catalogue.length.toLocaleString('en-GB')} names available`, { timeout: 20000 });
  const input = page.getByLabel('First Name');
  await input.fill('Demr');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  expect(renders).toBe(0);
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/santa-message');
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({ name: selected.id });
    expect(response.headers()['content-type']).toBe('audio/mpeg');
    await expect(page.locator('.message-result')).toHaveCount(i + 1, { timeout: 30000 });
    const audio = page.locator('.message-result audio').nth(i);
    await audio.evaluate(element => element.play());
    await expect.poll(() => audio.evaluate(element => element.currentTime), { timeout: 10000 }).toBeGreaterThan(0.1);
    expect(await audio.evaluate(element => element.error)).toBeNull();
    await audio.evaluate(element => element.pause());
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download your audio' }).nth(i).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Santa-message-for-Demrie.mp3');
    await mkdir('generated-artifacts/hosted-names', { recursive: true });
    const path = `generated-artifacts/hosted-names/real-demrie-${i + 1}.mp3`;
    await download.saveAs(path);
    const browserBytes = await audio.evaluate(async element => {
      const bytes = new Uint8Array(await (await fetch(element.src)).arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    });
    expect((await readFile(path)).equals(Buffer.from(browserBytes, 'base64'))).toBe(true);
    await info.attach(`real-hosted-greeting-${i + 1}`, { path, contentType: 'audio/mpeg' });
  }
  await expect(input).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
  await expect(page.getByText('You’ve created 2 Free Santa messages for now.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download your audio' })).toHaveCount(2);
  expect(renders).toBe(2);
  await page.screenshot({ path: 'generated-artifacts/hosted-names/real-preview-result.jpg', fullPage: true });
});
