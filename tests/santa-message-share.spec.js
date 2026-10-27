import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openMessageDesk, mockBrevo, fillAccessForm } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY, MESSAGE_COOLDOWN_MS } from '../src/lib/santaMessageAllowance.js';

test.describe('uncluttered recovery panel', () => {
test.beforeEach(async ({ context }, testInfo) => {
  await context.addInitScript(({ key, duration, legacy }) => {
    Date.now = () => 1801915200000;
    localStorage.setItem(key, JSON.stringify(legacy
      ? { used: 2, availableAt: Date.now() + 25 * 60000 }
      : { used: 1, availableAt: Date.now() + duration, cooldownMs: duration }));
  }, { key: MESSAGE_ALLOWANCE_KEY, duration: MESSAGE_COOLDOWN_MS, legacy: testInfo.title.startsWith('an existing') });
});

async function open(page, timer = '30:00') {
  await mockBrevo(page);
  await page.goto('/free-santa-message');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText(timer);
  await expect(page.getByRole('button', { name: 'Share with friends', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Listen to Santa Radio', exact: true })).toHaveCount(0);
}

test('recovery without a retained recording has no duplicate actions or fake greeting share', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Share this greeting', exact: true })).toHaveCount(0);
  await expect(page.locator('.radio-dock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
});

test('an existing 30-minute wait keeps its original deadline without restarting it', async ({ page }) => {
  await open(page, '25:00');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
});
});

test.describe('completed greeting sharing', () => {
  const recordings = {
    Olivia: readFileSync('server/santa-audio/sleighbells.mp3'),
    Erin: readFileSync('server/santa-audio/names/erin.wav'),
  };
  let renders;

  test.beforeEach(async ({ context, page }) => {
    renders = 0;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === new URL(test.info().project.use.baseURL).hostname || url.protocol === 'blob:'
        ? route.continue() : route.abort();
    });
    await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
    await page.route('**/api/santa-message', route => {
      renders++;
      const { name } = route.request().postDataJSON();
      return route.fulfill({ contentType: 'audio/mpeg', body: recordings[Object.keys(recordings).find(label => label.toLowerCase() === name)] });
    });
    await page.addInitScript(() => {
      Date.now = () => 1801915200000;
      window.checkedFiles = [];
      window.sharedFiles = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => {
        window.checkedFiles.push(data);
        return true;
      } });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
        window.sharedFiles.push(data);
      } });
    });
  });

  async function create(page, name = 'Olivia') {
    // Additional retained greetings must come from a later eligible period.
    if (await page.getByRole('timer').count()) {
      await page.evaluate(key => {
        const deadline = JSON.parse(localStorage.getItem(key)).availableAt;
        Date.now = () => deadline;
        dispatchEvent(new Event('focus'));
      }, MESSAGE_ALLOWANCE_KEY);
      await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
    }
    await page.getByLabel('First Name').fill(name);
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    const result = page.getByLabel(`Santa’s greeting for ${name}`, { exact: true });
    await expect(result).toBeVisible();
    return result;
  }

  async function allowance(page) {
    return page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);
  }

  test('shares each existing Blob with its download filename, including after navigation and during cooldown', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMessageDesk(page);
    await create(page);
    await create(page, 'Erin');
    await expect(page.getByRole('timer')).toHaveText('30:00');
    const before = await allowance(page);
    // Both greetings are retained across SPA navigation, not fetched again.
    await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
    for (const name of ['Erin', 'Olivia']) {
      const result = page.getByLabel(`Santa’s greeting for ${name}`, { exact: true });
      await result.getByRole('button', { name: 'Share this greeting', exact: true }).click();
      await expect(result.getByRole('status')).toHaveText('Greeting passed to your chosen sharing app.');
      const payload = await page.evaluate(async () => {
        const data = window.sharedFiles.at(-1);
        const file = data.files[0];
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        return {
          keys: Object.keys(data), count: data.files.length, isFile: file instanceof File,
          filename: file.name, type: file.type,
          hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
          sameFileChecked: window.checkedFiles.at(-1).files[0] === file,
        };
      });
      expect(payload).toEqual({
        keys: ['files'], count: 1, isFile: true,
        filename: `santa-recorded-message-for-${name}.mp3`, type: 'audio/mpeg',
        hash: createHash('sha256').update(recordings[name]).digest('hex'), sameFileChecked: true,
      });
      await expect(result.locator('audio')).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await result.getByRole('link', { name: 'Download your audio' }).click();
      expect((await downloadPromise).suggestedFilename()).toBe(payload.filename);
    }
    expect(await allowance(page)).toBe(before);
    expect(renders).toBe(2);
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Share with friends', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByLabel('Santa’s greeting for Olivia', { exact: true }).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.screenshot({ path: 'generated-artifacts/santa-greeting-file-share-mobile.jpg' });
  });

  test('native cancellation is quiet and permits another attempt without changing usage', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
      throw new DOMException('Cancelled', 'AbortError');
    } }));
    await openMessageDesk(page);
    const result = await create(page);
    const before = await allowance(page);
    await result.getByRole('button', { name: 'Share this greeting' }).click();
    await expect(result.getByRole('button', { name: 'Share this greeting' })).toBeEnabled();
    await expect(result.locator('.message-share-status')).toHaveCount(0);
    // Redefine the stub to confirm the same greeting can be retried.
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async data => window.sharedFiles.push(data) }));
    await result.getByRole('button', { name: 'Share this greeting' }).click();
    await expect(result.getByRole('status')).toContainText('chosen sharing app');
    expect(await allowance(page)).toBe(before);
    expect(renders).toBe(1);
  });

  for (const mode of ['no share', 'no canShare', 'files unsupported', 'capability check throws', 'sharing fails']) {
    test(`${mode} explains the download fallback and retains the MP3`, async ({ page }) => {
      await page.addInitScript(mode => {
        if (mode === 'no share') Object.defineProperty(navigator, 'share', { value: undefined });
        if (mode === 'no canShare') Object.defineProperty(navigator, 'canShare', { value: undefined });
        if (mode === 'files unsupported') Object.defineProperty(navigator, 'canShare', { value: () => false });
        if (mode === 'capability check throws') Object.defineProperty(navigator, 'canShare', { value: () => { throw new Error('Blocked'); } });
        if (mode === 'sharing fails') Object.defineProperty(navigator, 'share', { value: async () => { throw new Error('Blocked'); } });
      }, mode);
      await openMessageDesk(page);
      const result = await create(page);
      const before = await allowance(page);
      await result.getByRole('button', { name: 'Share this greeting' }).click();
      await expect(result.getByRole(mode.includes('throws') || mode.includes('fails') ? 'alert' : 'status')).toContainText('download link above');
      await expect(result.getByRole('button', { name: 'Share this greeting' })).toBeEnabled();
      const downloadPromise = page.waitForEvent('download');
      await result.getByRole('link', { name: 'Download your audio' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('santa-recorded-message-for-Olivia.mp3');
      expect(await download.failure()).toBeNull();
      expect(await allowance(page)).toBe(before);
      expect(renders).toBe(1);
      expect(await page.evaluate(() => window.sharedFiles.length)).toBe(0);
    });
  }

  test('disables duplicate sharing while the system share sheet is open', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: data => {
      window.sharedFiles.push(data);
      return new Promise(resolve => { window.finishShare = resolve; });
    } }));
    await openMessageDesk(page);
    const result = await create(page);
    await result.getByRole('button', { name: 'Share this greeting' }).click();
    await expect(result.getByRole('button', { name: 'Opening greeting share options…' })).toBeDisabled();
    await result.locator('.message-share button').evaluate(button => button.click());
    expect(await page.evaluate(() => window.sharedFiles.length)).toBe(1);
    await page.evaluate(() => window.finishShare());
    await expect(result.getByRole('button', { name: 'Share this greeting' })).toBeEnabled();
    expect(renders).toBe(1);
  });
});
