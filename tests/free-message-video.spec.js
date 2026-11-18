import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

test('completed free greeting provides a personalised MP4 and measures only download clicks', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(20000);
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
    const video = maker.locator('.santa-free-video video');
    const link = maker.getByRole('link', { name: 'Download your MP4 video' });
    await expect(link).toBeVisible({ timeout: 90000 });
    await expect(video).toBeVisible();
    expect(events.filter(event => event.action === 'mp4-download')).toHaveLength(0);
    await expect(maker.getByRole('progressbar', { name: 'MP4 creation progress' })).toHaveAttribute('value', '1');
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
    await expect(maker.getByRole('link', { name: 'Download your audio' })).toBeVisible();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
