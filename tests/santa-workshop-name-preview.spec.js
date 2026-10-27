import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

test.beforeEach(async ({ page }) => { await unlockWorkshop(page); });
import { workshopCatalogueFixture as workshopCatalogue } from './fixtures/workshop-catalogue.js';

const root = 'https://stagcommunications.com/santaradio/names/';
const audioBytes = readFileSync('server/santa-audio/names/arabella.wav');
const records = [
  { id: 'demrie', name: 'Demrie', previewUrl: root + 'demrie.wav' },
  { id: 'dixie', name: 'Dixie', variant: 'dixie.wav', previewUrl: root + 'dixie.wav' },
  { id: 'dixie-3', name: 'Dixie', variant: 'dixie3.wav', previewUrl: root + 'dixie3.wav' },
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogue }));
  await page.route('**/api/santa-names?inventory=hosted', route => route.fulfill({
    json: { records, hostedCount: records.length, warning: null },
  }));
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.previewAudios = [];
    window.heardNames = [];
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      window.previewAudios.push(audio);
      audio.addEventListener('playing', () => {
        if (audio.src.startsWith('https://stagcommunications.com/santaradio/names/')) window.heardNames.push(audio.src);
      });
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
  });
});

async function review(page, variant = false, name = 'Demrie') {
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill(variant ? 'Dix' : name.slice(0, 3));
  if (variant) await page.getByRole('option').filter({ hasText: 'dixie3.wav' }).click();
  else await page.getByRole('option', { name, exact: true }).click();
  await page.locator('.smw-button-next').click();
  for (let index = 0; index < 5; index++) {
    await page.getByRole('listbox').press('Home');
    await page.locator('.smw-button-next').click();
  }
  await expect(page.locator('.smw-summary')).toBeVisible();
}

async function fakeMedia(page) {
  await page.addInitScript(() => {
    window.previewMode = 'playing';
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { this.testPauseCount = (this.testPauseCount || 0) + 1; };
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/santaradio/names/')) {
        if (window.previewMode === 'reject') return Promise.reject(new Error('Playback blocked'));
        if (window.previewMode === 'hold') return new Promise((resolve, reject) => { window.rejectHeldPreview = reject; });
      }
      queueMicrotask(() => {
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
      });
      return Promise.resolve();
    };
  });
}

test('keyboard plays only the exact recorded-name WAV on demand without generation, storage or spelling changes', async ({ page }) => {
  const audioRequests = [], writes = [];
  await page.route(root + '*', route => {
    audioRequests.push(route.request().url());
    return route.fulfill({ contentType: 'audio/wav', body: audioBytes });
  });
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await review(page, true);
  expect(audioRequests).toEqual([]);
  const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const play = page.getByRole('button', { name: 'Play recorded name for Dixie', exact: true });
  const box = await play.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await play.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.heardNames)).toContain(root + 'dixie3.wav');
  expect(audioRequests).toEqual([root + 'dixie3.wav']);
  expect(await page.evaluate(() => window.previewAudios.at(-1).volume)).toBe(0.5);
  await expect(play).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(before);
  expect(writes).toEqual([]);
  await expect(page.locator('.smw-summary-row').first()).toContainText('Dixie');
});

test('stopping, late rejection, editing and leaving the review clean up the selected clip', async ({ page }) => {
  await fakeMedia(page);
  await review(page);
  const play = page.getByRole('button', { name: 'Play recorded name for Demrie', exact: true });
  await page.evaluate(() => { window.previewMode = 'hold'; });
  await play.click();
  await page.getByRole('button', { name: 'Stop recorded name for Demrie', exact: true }).click();
  await page.evaluate(() => { window.previewMode = 'playing'; });
  await play.click();
  await expect(page.getByRole('button', { name: 'Stop recorded name for Demrie', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.rejectHeldPreview(new Error('Late failure')));
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Change Their name', exact: true }).click();
  expect(await page.evaluate(() => window.previewAudios.filter(audio => audio.hasAttribute('src') && audio.src.includes('/santaradio/names/')).length)).toBe(0);
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dix');
  await page.getByRole('option').filter({ hasText: 'dixie3.wav' }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await page.getByRole('button', { name: 'Play recorded name for Dixie', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.heardNames.at(-1))).toBe(root + 'dixie3.wav');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => window.previewAudios.filter(audio => audio.hasAttribute('src') && audio.src.includes('/santaradio/names/')).length)).toBe(0);
});

test('blocked playback and load timeout show honest retry feedback on a narrow enlarged screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await fakeMedia(page);
  await review(page);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const play = page.getByRole('button', { name: 'Play recorded name for Demrie', exact: true });
  await page.evaluate(() => { window.previewMode = 'reject'; });
  await play.click();
  await expect(page.getByRole('alert')).toContainText('could not be played');
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await page.clock.install();
  await page.evaluate(() => { window.previewMode = 'hold'; });
  await play.click();
  await page.clock.fastForward(15001);
  await page.clock.runFor(1000);
  const closeOffer = page.getByRole('button', { name: 'Close Santa message offer', exact: true });
  if (await closeOffer.isVisible()) await closeOffer.click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('alert')).toContainText('could not be played');
  await page.evaluate(() => { window.previewMode = 'playing'; });
  await play.click();
  await expect(page.getByRole('button', { name: 'Stop recorded name for Demrie', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('radio pauses for the name, resumes afterwards and manual radio playback stops the preview', async ({ page }) => {
  await fakeMedia(page);
  await review(page);
  const radio = page.locator('.radio-dock button').filter({ hasText: /Listen Live|Pause|Connecting/ });
  const play = page.getByRole('button', { name: 'Play recorded name for Demrie', exact: true });
  await radio.click();
  await expect(radio).toContainText('Pause');
  await play.click();
  await expect(radio).toContainText('Listen Live');
  await page.evaluate(() => window.previewAudios.findLast(audio => audio.src.includes('/santaradio/names/')).dispatchEvent(new Event('ended')));
  await expect(radio).toContainText('Pause');
  await play.click();
  await expect(radio).toContainText('Listen Live');
  await radio.click();
  await expect(radio).toContainText('Pause');
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.previewAudios.filter(audio => audio.hasAttribute('src') && audio.src.includes('/santaradio/names/')).length)).toBe(0);
});

test('the real hosted Fabian recording plays and leaves a review screenshot', async ({ page }) => {
  await page.unroute('**/api/santa-names?inventory=hosted');
  await review(page, false, 'Fabian');
  const play = page.getByRole('button', { name: 'Play recorded name for Fabian', exact: true });
  await play.click();
  await expect.poll(() => page.evaluate(() => window.heardNames.length), { timeout: 20000 }).toBe(1);
  const actual = await page.evaluate(() => window.heardNames[0]);
  expect(actual).toMatch(/^https:\/\/stagcommunications\.com\/santaradio\/names\/fabian\.(wav|mp3)$/i);
  await expect(play).toBeVisible({ timeout: 15000 });
  await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/name-preview-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.smw-summary-row').first().screenshot({ path: 'generated-artifacts/workshop/name-preview-mobile-real.png' });
});
