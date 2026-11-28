import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const temporary = mkdtempSync(join(tmpdir(), 'santa-video-test-'));
const mp3 = join(temporary, 'test-message.mp3');
execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-y', mp3]);
test.afterAll(() => rmSync(temporary, { recursive: true, force: true }));
test.use({ extraHTTPHeaders: { Authorization: `Bearer studio-owner.${'a'.repeat(43)}` } });

test('Dashboard authorization protects media; source supports bounded ranges', async ({ request, baseURL }) => {
  for (const path of ['/api/santa-videos', '/api/santa-videos?asset=source', '/api/santa-videos?asset=bells']) {
    expect((await fetch(new URL(path, baseURL))).status).toBe(401);
    expect((await fetch(new URL(path, baseURL), { headers: { Authorization: `Basic ${Buffer.from('santa:wrong').toString('base64')}` } })).status).toBe(401);
  }
  const source = await request.get('/api/santa-videos?asset=source', { headers: { Range: 'bytes=0-99' } });
  expect(source.status()).toBe(206);
  expect((await source.body()).length).toBe(100);
  expect(source.headers()['cache-control']).toContain('no-store');
  expect((await request.get('/api/santa-videos?asset=source', { headers: { Range: 'bytes=999999999-' } })).status()).toBe(416);
});

test('creates a playable MP4, tracks time, downloads, and can cancel another build', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/api/santa-videos');
  await expect(page.locator('#create')).toBeDisabled();
  await expect(page.locator('#bells')).toBeChecked();
  await expect(page.locator('#average-stitch')).toHaveText('—');
  await page.locator('#audio-file').setInputFiles(mp3);
  await page.locator('#create').click();
  await expect(page.locator('#cancel')).toBeVisible();
  await expect(page.locator('#bells')).toBeDisabled();
  await expect(page.locator('#timer')).not.toHaveText('00:00.0');
  await expect(page.locator('#result')).toBeVisible({ timeout: 150000 });
  await expect(page.locator('#percent')).toHaveText('100%');
  await expect(page.locator('#stitching')).not.toHaveText('—');
  await page.locator('#video-preview').evaluate(video => new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve();
    video.onloadedmetadata = resolve; video.onerror = reject;
  }));
  const duration = await page.locator('#video-preview').evaluate(video => video.duration);
  expect(duration).toBeGreaterThan(102); expect(duration).toBeLessThan(103);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('test-message-santa-video.mp4');
  const saved = join(temporary, 'result.mp4'); await download.saveAs(saved);
  execFileSync(ffmpeg, ['-v', 'error', '-i', saved, '-t', '4', '-f', 'null', '-']);
  await expect(page.locator('#summary')).toContainText('Sleighbells on');
  await expect(page.locator('#history-count')).toHaveText('Based on 1 completed build.');
  console.log('Browser build:', await page.locator('#summary').textContent());
  await page.locator('#bells').uncheck();
  await expect(page.locator('#result')).toBeHidden();
  let requestedBells = false;
  page.on('request', request => { if (request.url().includes('asset=bells')) requestedBells = true; });
  await page.locator('#create').click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 150000 });
  await expect(page.locator('#summary')).toContainText('Sleighbells off');
  expect(requestedBells).toBe(false);
  await expect(page.locator('#history-count')).toHaveText('Based on 2 completed builds.');
  await expect(page.locator('#history-rows tr')).toHaveCount(2);
  const average = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('santa-video-stitcher-history-v1'));
    return rows.reduce((sum, row) => sum + row.stitchingMs, 0) / rows.length / 1000;
  });
  expect(Math.abs(parseFloat(await page.locator('#average-stitch').textContent()) - average)).toBeLessThan(0.1);
  console.log('Browser build without bells:', await page.locator('#summary').textContent());
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/santa-videos-mobile.png', fullPage: true });
  await page.locator('#create').click();
  await page.locator('#cancel').click();
  await expect(page.locator('#status')).toContainText('Cancelled');
  await expect(page.locator('#create')).toBeEnabled();
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#history-count')).toHaveText('Based on 2 completed builds.');
  await page.reload();
  await expect(page.locator('#history-count')).toHaveText('Based on 2 completed builds.');
  await page.locator('#clear-history').click();
  await expect(page.locator('#average-stitch')).toHaveText('—');
  await expect(page.locator('#history-count')).toHaveText('No completed builds yet.');
});


test('selects from the shared live-name endpoint and burns the name onto the parchment', async ({ page }) => {
  test.setTimeout(300000);
  let nameRequests = 0;
  await page.route('**/names-data/latest.json', async route => {
    nameRequests++;
    await route.fulfill({ json: ['Oliver', 'Olivia', 'Óscar'] });
  });
  await page.goto('/api/santa-videos');
  await page.locator('#name-search').fill('Oli');
  await page.getByRole('option', { name: 'Olivia', exact: true }).click();
  expect(nameRequests).toBe(1);
  await expect(page.locator('#name-status')).toContainText('Olivia will appear');
  await page.locator('#audio-file').setInputFiles(mp3);
  await page.locator('#create').click();
  await expect(page.locator('#name-search')).toBeDisabled();
  await expect(page.locator('#result')).toBeVisible({ timeout: 250000 });
  await expect(page.locator('#summary')).toContainText('Name: Olivia');
  await expect(page.locator('#average-with-name')).not.toHaveText('—');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const file = join(temporary, 'named-video.mp4');
  await (await downloadPromise).saveAs(file);
  execFileSync(ffmpeg, ['-v', 'error', '-ss', '13', '-i', file, '-frames:v', '1', '-y', '/tmp/santa-name-overlay.png']);
  console.log('Named video:', await page.locator('#summary').textContent());
});

test('name picker supports keyboard selection and rejects unselected typed names', async ({ page }) => {
  await page.route('**/names-data/latest.json', route => route.fulfill({ json: ['Oliver', 'Olivia'] }));
  await page.goto('/api/santa-videos');
  await page.locator('#name-search').fill('Oli');
  await expect(page.locator('#name-results').getByRole('option')).toHaveCount(2);
  await page.locator('#name-search').press('ArrowUp');
  await page.locator('#name-search').press('Enter');
  await expect(page.locator('#name-search')).toHaveValue('Olivia');
  await expect(page.locator('#name-status')).toContainText('Olivia will appear');
  await page.locator('#audio-file').setInputFiles(mp3);
  await page.locator('#name-search').fill('Oliver');
  await page.locator('#create').click();
  await expect(page.locator('#error')).toContainText('Choose a name from the live list');
  await expect(page.locator('#cancel')).toBeHidden();
  await page.locator('#name-clear').click();
  await expect(page.locator('#name-search')).toHaveValue('');
});
