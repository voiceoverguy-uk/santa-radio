import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

test('completed free greeting provides a personalised MP4 and measures only download clicks', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(20000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const folder = mkdtempSync(join(tmpdir(), 'free-video-'));
  try {
    const audio = join(folder, 'test.mp3');
    execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', audio]);
    const events = [];
    await page.route('**/api/santa-message-access', route => route.fulfill({ json: { authorized: true } }));
    await page.route('**/names-data/latest.json', route => route.fulfill({ json: ['Oliver'] }));
    await page.route('**/api/santa-names', route => route.fulfill({ json: { records: [{ id: 'test-recording', name: 'Oliver', selectionToken: 'fixture', previewUrl: '/api/santa-name-preview?token=fixture' }] } }));
    await page.route('**/api/santa-message', route => route.fulfill({ contentType: 'audio/mpeg', headers: { 'X-Message-Receipt': 'test-receipt' }, body: readFileSync(audio) }));
    await page.route('**/api/message-statistics', route => { events.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
    await page.goto('/free-santa-message');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const maker = page.locator('.santa-message-box');
    await maker.getByRole('combobox').fill('Oliver');
    await maker.getByRole('option').first().click();
    await maker.getByRole('button', { name: 'Create message', exact: true }).click();
    const video = page.locator('.fsm-personal-video video');
    const link = maker.getByRole('link', { name: 'Download your message' });
    await expect(link).toBeVisible({ timeout: 90000 });
    await expect(video).toBeVisible();
    await expect(page.locator('.fsm-video-preview')).toHaveCount(0);
    expect(await video.evaluate(el => el.controls)).toBe(false);
    await page.getByRole('button', { name: 'Play Santa’s video message for Oliver', exact: true }).click();
    await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause Santa’s video message for Oliver', exact: true }).click();
    const sizes = await page.evaluate(() => {
      const nav = document.querySelector('.nav-message'), download = document.querySelector('.santa-free-video__download');
      return { nav: nav.getBoundingClientRect().height, download: download.getBoundingClientRect().height, navFont: getComputedStyle(nav).fontSize, downloadFont: getComputedStyle(download).fontSize };
    });
    expect(sizes.download).toBe(sizes.nav);
    expect(sizes.downloadFont).toBe(sizes.navFont);
    await expect(page.locator('.message-creation-indicator')).toHaveCount(0);
    expect(events.filter(event => event.action === 'mp4-download')).toHaveLength(0);
    await expect(maker.getByRole('progressbar', { name: 'MP4 creation progress' })).toHaveAttribute('value', '1');
    await page.locator('.fsm-personal-video').screenshot({ path: '/tmp/santa-personal-player.png' });
    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Santa-message-for-Oliver.mp4');
    const output = join(folder, 'video.mp4'); await download.saveAs(output);
    execFileSync(ffmpeg, ['-v', 'error', '-i', output, '-map', '0:a:0', '-f', 'null', '-']);
    await expect.poll(() => events.filter(event => event.action === 'mp4-download').length).toBe(1);
    // A repeat click downloads again without counting the same receipt twice.
    await link.click({ force: true });
    expect(events.filter(event => event.action === 'mp4-download')).toHaveLength(1);
    await expect.poll(() => video.evaluate(el => el.videoWidth / el.videoHeight)).toBeCloseTo(16 / 9);
    await expect(maker.getByRole('link', { name: 'Download your audio' })).toHaveCount(0);
    await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }); Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.sharedFile = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size }; } }); });
    await maker.getByRole('button', { name: 'Share this greeting', exact: true }).click({ force: true });
    await expect.poll(() => page.evaluate(() => window.sharedFile?.type)).toBe('video/mp4');
    expect(await page.evaluate(() => window.sharedFile.name)).toBe('Santa-message-for-Oliver.mp4');
    await expect(maker.getByRole('progressbar', { name: 'MP4 creation progress' })).toHaveCount(0, { timeout: 5000 });
    await expect(video).toBeVisible();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
