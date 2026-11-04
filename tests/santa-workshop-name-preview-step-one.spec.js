import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

// Bounded private lookup and same-origin capabilities, not a public inventory
// or remote filenames. Deliberately independent of the legacy preview suite.
const records = [
  { id: 'fixture-demrie', name: 'Demrie' },
  { id: 'fixture-dixie', name: 'Dixie', variant: 'First recording' },
  { id: 'fixture-dixie-3', name: 'Dixie', variant: 'Alternative recording' },
].map(record => ({
  ...record, selectionToken: `selection-${record.id}`,
  previewUrl: `/api/santa-name-preview?token=${record.id}`,
}));
const audioBytes = readFileSync('server/santa-audio/names/arabella.wav');

test.beforeEach(async ({ page }) => {
  await unlockWorkshop(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/names-data/*.json', route => route.fulfill({ json: ['Demrie', 'Dixie'] }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-names', route => {
    expect(route.request().method()).toBe('POST');
    const { query } = route.request().postDataJSON();
    return route.fulfill({ json: {
      records: records.filter(record => record.name.toLowerCase().startsWith(query.toLowerCase())),
      warning: null,
    } });
  });
  await page.route('**/api/santa-name-preview?token=*', route => route.fulfill({ contentType: 'audio/wav', body: audioBytes }));
  await page.addInitScript(() => {
    window.previewMode = 'playing';
    window.previewPlays = [];
    window.revokedPreviews = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.revokedPreviews.push(url); revoke(url); };
    const NativeAudio = window.Audio;
    window.testAudios = [];
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      window.testAudios.push(audio);
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
    window.nativeMediaMethods = Object.fromEntries(['load', 'pause', 'play'].map(key => [key, HTMLMediaElement.prototype[key]]));
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { this.testPauseCount = (this.testPauseCount || 0) + 1; };
    HTMLMediaElement.prototype.play = function () {
      if (this.src.startsWith('blob:')) {
        window.previewPlays.push(this.src);
        if (window.previewMode === 'reject') return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
        if (window.previewMode === 'hold') return new Promise((resolve, reject) => { window.rejectHeldPreview = reject; });
      }
      queueMicrotask(() => {
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
      });
      return Promise.resolve();
    };
  });
});

async function openStudio(page) {
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toBeVisible();
}

async function selectName(page, alternative = false) {
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill(alternative ? 'Dix' : 'Dem');
  if (alternative) await page.getByRole('option', { name: 'Dixie', exact: true }).click();
  await page.getByRole('option', { name: alternative ? 'Dixie Alternative recording' : 'Demrie', exact: true }).click();
}

const playButton = (page, name = 'Demrie') => page.getByRole('button', { name: `Play recorded name for ${name}`, exact: true });
const stopButton = (page, name = 'Demrie') => page.getByRole('button', { name: `Stop recorded name for ${name}`, exact: true });
const next = page => page.locator('.smw-actions .smw-button-next').click();
async function expectStopped(page) {
  await expect.poll(() => page.evaluate(() => window.testAudios.filter(audio => audio.getAttribute('src')?.startsWith('blob:')).length)).toBe(0);
}
async function finishChoices(page) {
  await next(page);
  await page.getByRole('listbox').press('Home');
  await next(page);
  await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
  for (let index = 0; index < 4; index++) {
    await page.getByRole('listbox').press('Home');
    await next(page);
  }
  await expect(page.locator('.smw-summary')).toBeVisible();
}

test('step one previews the exact variant only on keyboard demand without generating or storing details', async ({ page }) => {
  const downloads = [], writes = [];
  page.on('request', request => {
    if (request.url().includes('/api/santa-name-preview?')) downloads.push(request.url());
    if (request.method() === 'POST' && !request.url().endsWith('/api/santa-names')) writes.push(request.url());
  });
  await openStudio(page);
  await expect(page.locator('.smw-name-preview-button')).toHaveCount(0);
  await selectName(page, true);
  await expect(page.locator('.smw-name-status')).toContainText('Selected name: Dixie — Alternative recording');
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => window.previewPlays)).toEqual([]);
  const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const play = playButton(page, 'Dixie');
  const bounds = await play.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('combobox').focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(stopButton(page, 'Dixie')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  expect(downloads.map(url => new URL(url).searchParams.get('token'))).toEqual(['fixture-dixie-3']);
  expect(await page.evaluate(() => window.testAudios.findLast(audio => audio.src.startsWith('blob:')).volume)).toBe(0.5);
  await page.keyboard.press('Space');
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expectStopped(page);
  await play.click();
  await expect(stopButton(page, 'Dixie')).toBeVisible();
  expect(downloads).toHaveLength(1);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(before);
});

test('successful audio is shared between step one, review and unrelated edits, then released on leaving', async ({ page }) => {
  let downloads = 0;
  page.on('request', request => { if (request.url().includes('/api/santa-name-preview?')) downloads++; });
  await openStudio(page);
  await selectName(page);
  await playButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await finishChoices(page);
  await expectStopped(page);
  await playButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await page.getByRole('button', { name: 'Change Age', exact: true }).click();
  await expectStopped(page);
  await next(page);
  await playButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await page.getByRole('button', { name: 'Change Their recorded name', exact: true }).click();
  await expectStopped(page);
  await expect(page.locator('.smw-name-status')).toContainText('Demrie');
  await playButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  expect(downloads).toBe(1);
  expect(await page.evaluate(() => window.revokedPreviews)).toEqual([]);
  await page.getByRole('link', { name: 'Home', exact: true }).first().click();
  await expectStopped(page);
  expect(await page.evaluate(() => window.revokedPreviews)).toHaveLength(1);
  await openStudio(page);
  await selectName(page);
  await playButton(page).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  expect(downloads).toBe(2);
});

test('clearing or replacing the name stops playback, discards audio and resets feedback', async ({ page }) => {
  await openStudio(page);
  await selectName(page);
  await playButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await page.getByRole('combobox').fill('Dix');
  await expect(page.locator('.smw-name-preview-button')).toHaveCount(0);
  await expectStopped(page);
  expect(await page.evaluate(() => window.revokedPreviews)).toHaveLength(1);
  await page.getByRole('option', { name: 'Dixie', exact: true }).click();
  await page.getByRole('option', { name: 'Dixie First recording', exact: true }).click();
  await page.evaluate(() => { window.previewMode = 'reject'; });
  await playButton(page, 'Dixie').click();
  await expect(page.locator('.smw-name-preview-error')).toContainText('browser blocked');
  await selectName(page, true);
  await expect(page.locator('.smw-name-preview-error')).toHaveCount(0);
  await expect(playButton(page, 'Dixie')).toHaveAttribute('aria-pressed', 'false');
});

for (const action of ['stop', 'clear', 'advance', 'leave']) {
  test(`pending private audio is cancelled on ${action} and cannot start late`, async ({ page }) => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let requested = false;
    await page.route('**/api/santa-name-preview?token=*', async route => {
      requested = true;
      await pending;
      await route.fulfill({ contentType: 'audio/wav', body: audioBytes }).catch(() => {});
    });
    await openStudio(page);
    await selectName(page);
    await playButton(page).click();
    await expect.poll(() => requested).toBe(true);
    await expect(stopButton(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.smw-name-preview-status')).toHaveText('Asking Santa... hold tight.');
    if (action === 'stop') await stopButton(page).click();
    if (action === 'clear') await page.getByRole('combobox').fill('');
    if (action === 'advance') await next(page);
    if (action === 'leave') {
      await page.getByRole('link', { name: 'Home', exact: true }).first().click();
      await expect(page.locator('.smw-page')).toHaveCount(0);
    }
    release();
    await expectStopped(page);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.previewPlays)).toEqual([]);
    await expect(page.locator('.smw-name-preview-error')).toHaveCount(0);
    if (action === 'advance') await page.getByRole('button', { name: 'Back', exact: true }).click();
    if (action === 'stop' || action === 'advance') {
      await expect(page.locator('.smw-name-preview-status')).toHaveText('');
      await playButton(page).click();
      await expect(stopButton(page)).toHaveAttribute('aria-busy', 'false');
    }
  });
}

for (const stage of ['step one', 'review']) {
  test(`loading copy remains readable at 320px with enlarged text on ${stage}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openStudio(page);
    await selectName(page);
    if (stage === 'review') await finishChoices(page);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await page.evaluate(() => { window.previewMode = 'hold'; });
    await playButton(page).click();
    const status = page.locator('.smw-name-preview-status');
    await expect(status).toHaveText('Asking Santa... hold tight.');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(stopButton(page)).toHaveAttribute('aria-busy', 'true');
    await status.scrollIntoViewIfNeeded();
    const bounds = await status.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    expect(await status.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `generated-artifacts/workshop/name-loading-${stage.replace(' ', '-')}-mobile.jpg` });
    await page.evaluate(() => window.testAudios.findLast(audio => audio.src.startsWith('blob:')).dispatchEvent(new Event('playing')));
    await expect(status).toHaveText('Playing name…');
    await expect(stopButton(page)).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => window.testAudios.findLast(audio => audio.src.startsWith('blob:')).dispatchEvent(new Event('ended')));
    await expect(status).toHaveText('');
    await expect(playButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expectStopped(page);
  });
}

test('retry, timeout and late media rejection remain recoverable at 320px with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  let attempts = 0;
  await page.route('**/api/santa-name-preview?token=*', route => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 503 })
      : route.fulfill({ contentType: 'audio/wav', body: audioBytes });
  });
  await openStudio(page);
  await selectName(page);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await playButton(page).click();
  await expect(page.locator('.smw-name-preview-error')).toContainText('temporarily unavailable');
  await expect(playButton(page)).toHaveAttribute('aria-describedby', /.+/);
  await page.evaluate(() => { window.previewMode = 'hold'; });
  await playButton(page).click();
  await expect.poll(() => page.evaluate(() => window.previewPlays.length)).toBe(1);
  await stopButton(page).click();
  await page.evaluate(() => { window.previewMode = 'playing'; });
  await playButton(page).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  await page.evaluate(() => window.rejectHeldPreview(new Error('Late failure')));
  await expect(page.locator('.smw-name-preview-error')).toHaveCount(0);
  await stopButton(page).click();
  await page.clock.install();
  await page.evaluate(() => { window.previewMode = 'hold'; });
  await playButton(page).click();
  await page.clock.fastForward(15001);
  await expect(page.locator('.smw-name-preview-error')).toContainText('could not be played');
  await page.evaluate(() => { window.previewMode = 'playing'; });
  await playButton(page).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const selector of ['.smw-name-search', '.smw-name-status', '.smw-name-preview-button', '.smw-activity-wording']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
  }
  await page.locator('.smw-name-preview-button').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'generated-artifacts/workshop/step-one-preview-mobile.jpg' });
});

test('step-one playback preserves radio pause, resume and manual override behaviour', async ({ page }) => {
  await openStudio(page);
  await selectName(page);
  // Studio intentionally hides the radio dock. Exercise its existing handler
  // without changing that presentation or pretending it is a visible control.
  const radio = page.locator('.radio-dock button').filter({ hasText: /Listen Live|Pause|Connecting/ });
  await radio.dispatchEvent('click');
  await expect(radio).toContainText('Pause');
  await playButton(page).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  await expect(radio).toContainText('Listen Live');
  await page.evaluate(() => window.testAudios.findLast(audio => audio.src.startsWith('blob:')).dispatchEvent(new Event('ended')));
  await expect(radio).toContainText('Pause');
  await playButton(page).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  await expect(radio).toContainText('Listen Live');
  await radio.dispatchEvent('click');
  await expect(radio).toContainText('Pause');
  await expect(playButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expectStopped(page);
});

test('native browser audio plays from the private fixture on step one and review, with normal mobile wrapping', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(HTMLMediaElement.prototype, window.nativeMediaMethods);
    window.nativeNamePlays = 0;
    const NativeAudio = window.Audio;
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      audio.addEventListener('playing', () => { if (audio.src.startsWith('blob:')) window.nativeNamePlays++; });
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  let downloads = 0;
  page.on('request', request => { if (request.url().includes('/api/santa-name-preview?')) downloads++; });
  await openStudio(page);
  await selectName(page, true);
  await page.locator('.smw-name-status').scrollIntoViewIfNeeded();
  await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/step-one-preview-mobile-normal.jpg' });
  await playButton(page, 'Dixie').click();
  await expect.poll(() => page.evaluate(() => window.nativeNamePlays)).toBe(1);
  await finishChoices(page);
  await playButton(page, 'Dixie').click();
  await expect.poll(() => page.evaluate(() => window.nativeNamePlays)).toBe(2);
  expect(downloads).toBe(1);
});
