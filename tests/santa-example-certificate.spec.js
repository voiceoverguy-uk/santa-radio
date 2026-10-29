import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openMessageDesk } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY } from '../src/lib/santaMessageAllowance.js';

const audio = readFileSync('server/santa-audio/sleighbells.mp3');
async function noFreeCertificates(page) {
  await expect(page.locator('.santa-certificate-examples, .santa-certificate-dialog, .message-certificate')).toHaveCount(0);
  await expect(page.locator('.message-intro, .message-result').filter({ hasText: /certificate/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /certificate/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /certificate/i })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.testNow = 1801915200000;
    Date.now = () => window.testNow;
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: async data => {
      window.sharedTypes = data.files.map(file => file.type);
    } });
  });
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

for (const path of ['/', '/free-santa-message']) {
  for (const width of [390, 1440]) {
    test(`free audio remains usable without certificates before creation, on SPA restoration and cooldown at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let generations = 0;
      const certificateRequests = [];
      page.on('request', request => {
        if (request.url().includes('/certificates/')) certificateRequests.push(request.url());
      });
      await page.route('**/api/santa-message', route => {
        generations++;
        return route.fulfill({ contentType: 'audio/mpeg', body: audio });
      });
      await openMessageDesk(page, { path });
      await noFreeCertificates(page);
      const start = page.getByRole('button', { name: 'Hear an example audio message', exact: true });
      await expect(start).toBeEnabled();
      await page.getByLabel('First Name').fill('Olivia');
      await page.getByRole('option', { name: 'Olivia', exact: true }).click();
      await page.getByRole('button', { name: 'Create message', exact: true }).click();
      const result = page.getByLabel('Santa’s greeting for Olivia', { exact: true });
      await expect(result).toBeVisible();
      await noFreeCertificates(page);
      let before = await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);
      await result.locator('audio').evaluate(element => element.play());
      await expect.poll(() => result.locator('audio').evaluate(element => element.currentTime)).toBeGreaterThan(0);
      await result.locator('audio').evaluate(element => element.pause());
      for (let repetition = 0; repetition < 2; repetition++) {
        const pending = page.waitForEvent('download');
        await result.getByRole('link', { name: 'Download your audio' }).click();
        const download = await pending;
        expect(download.suggestedFilename()).toBe('santa-recorded-message-for-Olivia.mp3');
        expect(readFileSync(await download.path())).toEqual(audio);
      }
      await result.getByRole('button', { name: 'Share this greeting', exact: true }).click();
      expect(await page.evaluate(() => window.sharedTypes)).toEqual(['audio/mpeg']);
      expect(await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY)).toBe(before);
      // Keep both tab-local results when another allowance becomes available.
      await page.evaluate(key => {
        window.testNow = JSON.parse(localStorage.getItem(key)).availableAt;
        dispatchEvent(new Event('focus'));
      }, MESSAGE_ALLOWANCE_KEY);
      await page.getByLabel('First Name').fill('Erin');
      await page.getByRole('option', { name: 'Erin', exact: true }).click();
      await page.getByRole('button', { name: 'Create message', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'To Erin from Santa' })).toBeVisible();
      await expect(page.locator('.message-result')).toHaveCount(2);
      before = await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);
      // SPA navigation preserves the in-memory greeting on the other entry point.
      if (path === '/') {
        if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('navigation', { name: 'Main navigation' })
          .getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
      } else await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
      await expect(result).toBeVisible();
      await expect(page.locator('.message-result')).toHaveCount(2);
      await expect(page.getByLabel('Santa’s greeting for Erin', { exact: true })
        .getByRole('link', { name: 'Download your audio' })).toBeEnabled();
      await expect(result.getByRole('link', { name: 'Download your audio' })).toBeEnabled();
      await noFreeCertificates(page);
      await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
      expect(await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY)).toBe(before);
      expect(generations).toBe(2);
      expect(certificateRequests).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      // A fresh document retains the allowance, not the tab-local audio.
      await page.reload();
      await expect(page.locator('.message-cooldown-status')).toBeVisible();
      await expect(page.locator('.message-result')).toHaveCount(0);
      await noFreeCertificates(page);
      expect(generations).toBe(2);
    });
  }

  test(`saved greeting cache remains audio-only on ${path}`, async ({ page }) => {
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      records: [{ id: 'arabella', name: 'Arabella', downloadName: 'santa-recorded-message-for-Arabella.mp3' }],
      hostedCount: 1, warning: null,
    } }));
    const url = 'https://stagcommunications.com/santaradio/greetings-cache/free-offer-test.mp3';
    await page.route('**/api/santa-greeting?*', route => route.fulfill({ json: {
      available: true, greeting: {
        url, sha256: createHash('sha256').update(audio).digest('hex'), bytes: audio.length, recipeVersion: 'test',
      },
    } }));
    await page.route(`${url}?*`, route => route.fulfill({
      contentType: 'audio/mpeg', body: audio, headers: { 'Access-Control-Allow-Origin': '*' },
    }));
    let generations = 0;
    await page.route('**/api/santa-message', route => {
      generations++;
      return route.fulfill({ status: 500 });
    });
    await openMessageDesk(page, { path, mockNames: false });
    await page.getByLabel('First Name').fill('Arabella');
    await page.getByRole('option', { name: 'Arabella', exact: true }).click();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
    await noFreeCertificates(page);
    expect(generations).toBe(0);
  });
}
