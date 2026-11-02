import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const path = '/santa-message-workshop';
const answers = ['9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest — Fantasy place'];

async function openReview(page, { live = false } = {}) {
  await unlockWorkshop(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  if (!live) {
    await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
    await page.route('**/api/santa-names', route => route.fulfill({ json: { records: [
      { id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2', selectionToken: 'expired-token',
        previewUrl: '/api/santa-name-preview?token=expired-token' },
    ] } }));
    await page.route('**/api/santa-name-preview?*', route => route.fulfill({
      contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
    }));
  }
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  const checkPlaceholder = async input => {
    const colours = await input.evaluate(node => ({
      placeholder: getComputedStyle(node, '::placeholder').color,
      text: getComputedStyle(node).color,
      opacity: getComputedStyle(node, '::placeholder').opacity,
    }));
    expect(colours.placeholder).toBe('rgb(138, 138, 138)');
    expect(colours.opacity).toBe('1');
    expect(colours.placeholder).not.toBe(colours.text);
  };
  await checkPlaceholder(page.getByRole('combobox', { name: 'Search recorded names', exact: true }));
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill(live ? 'Arabella' : 'Dixie');
  const nameOption = page.getByRole('option', { name: live ? /^Arabella/ : /Dixie/ }).first();
  await expect(nameOption).toBeVisible({ timeout: 15000 });
  await nameOption.click();
  await page.locator('.smw-button-next').click();
  for (const answer of answers) {
    const search = page.getByRole('searchbox');
    if (await search.count()) await checkPlaceholder(search);
    const option = page.getByRole('option', { name: answer, exact: true });
    await option.scrollIntoViewIfNeeded();
    await option.click();
    await page.locator('.smw-button-next').click();
  }
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeVisible();
}

test('review create placement on desktop and phones, real MP3 playback/download, local spelling and cleanup', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.revokedAudioUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.revokedAudioUrls.push(url); revoke(url); };
  });
  const submissions = [];
  await page.route('**/api/santa-studio-message', async route => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('generated-artifacts/studio-test-message.mp3') });
  });
  await openReview(page);
  for (const width of [1365, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const create = page.getByRole('button', { name: 'Create message', exact: true });
    await create.scrollIntoViewIfNeeded();
    const bounds = await create.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThan(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const dock = page.locator('.radio-dock');
    if (await dock.isVisible()) {
      expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
    }
    await page.screenshot({ path: `generated-artifacts/studio-review-${width}.png` });
  }
  await page.getByRole('button', { name: 'Play recorded name for Dixie', exact: true }).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('');
  const result = page.getByRole('region', { name: 'Your finished Santa message' });
  await expect(result).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toEqual({ name: 'dixie-variant', age: 'year-9', activity: 'teamwork', achievement: 'jigsaw', treat: 'buche', place: 'forest' });
  const player = result.locator('audio');
  await expect.poll(() => player.evaluate(node => node.readyState)).toBeGreaterThanOrEqual(1);
  const duration = await player.evaluate(node => node.duration);
  expect(duration).toBeGreaterThan(40);
  await player.evaluate(node => node.play());
  await expect.poll(() => player.evaluate(node => node.currentTime)).toBeGreaterThan(0.1);
  await player.evaluate(node => node.pause());
  const url = await player.getAttribute('src');
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('D’Arcy');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
  await expect(player).toHaveAttribute('src', url);
  await result.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'generated-artifacts/studio-completed-mobile.png' });
  const download = result.getByRole('link', { name: /Download MP3/ });
  await expect(download).toHaveAttribute('download', 'santa-message-for-D’Arcy.mp3');
  const downloaded = page.waitForEvent('download');
  await download.click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('santa-message-for-D’Arcy.mp3');
  expect(submissions).toHaveLength(1);
  await page.getByRole('button', { name: 'Change Working hard at', exact: true }).click();
  await expect(result).toHaveCount(0);
  expect(await page.evaluate(url => window.revokedAudioUrls.includes(url), url)).toBe(true);
  await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
  expect(submissions[1].activity).toBe('instrument');
  const nextUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  // BrowserRouter updates history before React commits the new page. Wait for
  // the old page to actually leave, then observe its resource cleanup.
  await expect(page.locator('.smw-page')).toHaveCount(0);
  await expect.poll(() => page.evaluate(url => window.revokedAudioUrls.includes(url), nextUrl)).toBe(true);
});

test('retryable preparation errors, cancel and late responses cannot resurrect old audio after editing', async ({ page }) => {
  test.setTimeout(60000);
  let attempt = 0, release;
  await page.route('**/api/santa-studio-message', async route => {
    attempt++;
    if (attempt === 1) return route.fulfill({ status: 503, json: { error: 'A recording could not be loaded. Please try again.' } });
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('generated-artifacts/studio-test-message.mp3') }).catch(() => {});
  });
  await openReview(page);
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('A recording could not be loaded');
  await page.getByRole('button', { name: 'Retry message', exact: true }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect.poll(() => attempt).toBe(2);
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  release();
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect.poll(() => attempt).toBe(3);
  await page.getByRole('button', { name: 'Change A festive treat for Santa', exact: true }).click();
  release();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
});

test('real protected API stitches chosen hosted clips without depending on short-lived name tokens', async ({ page }) => {
  test.setTimeout(150000);
  // No mocks for names, catalogue, access, generation, or MP3 decoding.
  await openReview(page, { live: true });
  const requests = [];
  page.on('request', req => { if (req.url().includes('/api/santa-studio-message')) requests.push(req); });
  const responsePromise = page.waitForResponse(res => res.url().endsWith('/api/santa-studio-message'), { timeout: 120000 });
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), response.status() === 200 ? 'Generated MP3' : await response.text()).toBe(200);
  const payload = requests[0].postDataJSON();
  expect(Object.keys(payload).sort()).toEqual(['achievement', 'activity', 'age', 'name', 'place', 'treat']);
  expect(payload.name).toMatch(/^(?:f-[a-f0-9]{64}|arabella)$/);
  expect(response.headers()['cache-control']).toContain('no-store');
  const player = page.locator('.smw-message-result audio');
  await expect(player).toBeVisible();
  await expect.poll(() => player.evaluate(node => node.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  expect(await player.evaluate(node => node.duration)).toBeGreaterThan(60);
  await player.evaluate(node => node.play());
  await expect.poll(() => player.evaluate(node => node.currentTime)).toBeGreaterThan(0.1);
  await player.evaluate(node => node.pause());
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download MP3/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^santa-message-for-Arabella\.mp3$/);
  await download.saveAs('generated-artifacts/studio-live-hosted-message.mp3');
});

test('full-message playback coordinates with radio and pagehide clears temporary audio', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/api/santa-studio-message', route => route.fulfill({
    contentType: 'audio/mpeg', body: readFileSync('generated-artifacts/studio-test-message.mp3'),
  }));
  await page.route('https://global.citrus3.com:8164/**', route => route.fulfill({
    contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
  }));
  await openReview(page);
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  const player = page.locator('.smw-message-result audio');
  await expect(player).toBeVisible();
  // The approved Studio hides its dock. Exercise its still-mounted real control
  // without changing that appearance or making external radio requests.
  const radio = page.locator('.radio-dock .radio-play');
  await radio.evaluate(node => node.click());
  await expect(radio).toContainText('Pause');
  await player.evaluate(node => node.play());
  await expect(radio).toContainText('Listen Live');
  await player.evaluate(node => node.pause());
  await expect(radio).toContainText('Pause');
  await player.evaluate(node => node.play());
  await expect(radio).toContainText('Listen Live');
  await radio.evaluate(node => node.click());
  await expect(radio).toContainText('Pause');
  await expect.poll(() => player.evaluate(node => node.paused)).toBe(true);
  await player.evaluate(node => node.dispatchEvent(new Event('ended')));
  await expect(radio).toContainText('Pause');
  const url = await player.getAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(player).toHaveCount(0);
  expect(await page.evaluate(async url => {
    try { return (await fetch(url)).ok; } catch { return false; }
  }, url)).toBe(false);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
});
