import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockSantaNames } from './helpers/message-access.js';
import { MESSAGE_ACCESS_KEY } from '../src/lib/santaMessageAccess.js';
import { MESSAGE_ALLOWANCE_KEY, MESSAGE_COOLDOWN_MS } from '../src/lib/santaMessageAllowance.js';

const audio = readFileSync('server/santa-audio/sleighbells.mp3');
const mp3 = { contentType: 'audio/mpeg', body: audio };
const fixedNow = 1801915200000;

async function openMaker(page, path) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.getByLabel('First Name')).toBeVisible();
}

async function create(page, name = 'Olivia') {
  await page.getByLabel('First Name').fill(name);
  await expect(page.getByRole('option', { name, exact: true })).toBeVisible();
  await page.getByLabel('First Name').press('Escape');
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('heading', { name: `To ${name} from Santa` })).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  test.setTimeout(120000);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === new URL(test.info().project.use.baseURL).hostname || url.protocol === 'blob:'
      ? route.continue() : route.abort();
  });
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await mockSantaNames(context);
  await context.route('**/api/santa-message', route => route.fulfill(mp3));
  await context.addInitScript(({ accessKey, now }) => {
    sessionStorage.setItem(accessKey, 'granted');
    window.testNow = now;
    Date.now = () => window.testNow;
  }, { accessKey: MESSAGE_ACCESS_KEY, now: fixedNow });
});

for (const path of ['/', '/free-santa-message']) {
  for (const width of [390, 1440]) {
    test(`completed message, downloads, share and one Studio card work at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openMaker(page, path);
      await expect(page.locator('.santa-message-aside > .santa-studio-promotion')).toHaveCount(1);
      await create(page);

      const result = page.getByLabel('Santa’s greeting for Olivia', { exact: true });
      const promo = page.locator('#santa-studio-promotion');
      await expect(result.locator('audio')).toBeVisible();
      await expect(result.getByRole('link', { name: 'Download your audio' })).toBeVisible();
      await expect(result.getByRole('button', { name: 'Download your Nice List certificate' })).toBeVisible();
      await expect(result.getByRole('button', { name: 'Share this greeting', exact: true })).toBeVisible();
      await expect(promo).toHaveCount(1);
      await expect(promo).toContainText('When the Studio launches');
      await expect(promo).toContainText('age, activities, achievements, country and festive treats');
      await expect(promo).toContainText('Each Studio message will include a free personalised Nice List certificate');
      await expect(promo).toContainText('The basic free greeting includes one too');
      await expect(promo.getByText('Coming soon', { exact: true })).toBeVisible();
      await expect(promo).not.toContainText(/price|checkout/i);
      await expect(page.getByRole('button', { name: 'more magic?', exact: true })).toHaveCount(0);
      await expect(page.locator('.message-wait, .message-cooldown-status, [role="timer"]')).toHaveCount(0);
      await expect(page.locator('.message-wait-downloads > #santa-studio-promotion')).toHaveCount(1);
      await expect(page.locator('.santa-message-aside > #santa-studio-promotion')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);

      const actions = result.locator('.message-download-actions');
      const downloadLink = await result.getByRole('link', { name: 'Download your audio' }).boundingBox();
      const certificate = await result.getByRole('button', { name: 'Download your Nice List certificate' }).boundingBox();
      const share = await result.getByRole('button', { name: 'Share this greeting', exact: true }).boundingBox();
      const actionsBox = await actions.boundingBox();
      expect(share.width).toBe(48);
      expect(share.x + share.width).toBeLessThanOrEqual(actionsBox.x + actionsBox.width + 1);
      expect(share.x).toBeGreaterThan(downloadLink.x);
      expect(share.x).toBeGreaterThan(certificate.x);
      if (width === 390) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await result.screenshot({ path: 'test-results/completed-message-mobile.png' });
      }

      const download = page.waitForEvent('download');
      await result.getByRole('link', { name: 'Download your audio' }).click();
      expect((await download).suggestedFilename()).toBe('santa-recorded-message-for-Olivia.mp3');
    });
  }
}

test('an early attempt caused by stale page state explains when the next free message is available', async ({ page }) => {
  let generations = 0;
  await page.route('**/api/santa-message', route => {
    generations++;
    return route.fulfill(mp3);
  });
  await openMaker(page, '/free-santa-message');
  await page.getByLabel('First Name').fill('Olivia');
  await page.getByRole('option', { name: 'Olivia', exact: true }).click();
  const deadline = fixedNow + MESSAGE_COOLDOWN_MS;
  await page.evaluate(({ key, availableAt, duration }) => {
    localStorage.setItem(key, JSON.stringify({ used: 1, availableAt, cooldownMs: duration }));
  }, { key: MESSAGE_ALLOWANCE_KEY, availableAt: deadline, duration: MESSAGE_COOLDOWN_MS });
  await page.locator('.santa-message-box form').evaluate(form => form.requestSubmit());
  const expectedTime = await page.evaluate(time => new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(time)), deadline);
  await expect(page.locator('.message-cooldown-status')).toContainText(expectedTime);
  await expect(page.locator('.message-result')).toHaveCount(0);
  expect(generations).toBe(0);
});

test('the two-hour deadline persists through reload and updates another tab without a countdown', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMaker(page, '/free-santa-message');
  const otherTab = await context.newPage();
  await openMaker(otherTab, '/free-santa-message');

  await create(page);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), MESSAGE_ALLOWANCE_KEY);
  expect(MESSAGE_COOLDOWN_MS).toBe(2 * 60 * 60 * 1000);
  expect(saved).toEqual({
    used: 1,
    availableAt: fixedNow + MESSAGE_COOLDOWN_MS,
    cooldownMs: MESSAGE_COOLDOWN_MS,
  });
  const expectedTime = await page.evaluate(deadline => new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(deadline)), saved.availableAt);

  await expect(otherTab.locator('.message-cooldown-status')).toContainText(expectedTime);
  await expect(otherTab.locator('.message-result')).toHaveCount(0);
  await expect(otherTab.locator('.message-cooldown-status')).toContainText('isn’t saved by this site');
  await expect(otherTab.locator('[role="timer"], .message-wait')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.message-cooldown-status')).toContainText(expectedTime);
  await expect(page.locator('.message-result')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
  await expect(page.locator('.santa-message-aside > #santa-studio-promotion')).toHaveCount(1);
  await expect(page.locator('.message-wait-downloads')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'more magic?', exact: true })).toHaveCount(0);
});
