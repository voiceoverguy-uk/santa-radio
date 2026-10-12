import { test, expect } from '@playwright/test';
import { openMessageDesk } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY, MESSAGE_COOLDOWN_MS } from '../src/lib/santaMessageAllowance.js';

const shareUrl = 'https://www.santaradio.co.uk/free-santa-message';

test.beforeEach(async ({ context }, testInfo) => {
  await context.addInitScript(({ key, duration, legacy }) => {
    Date.now = () => 1801915200000;
    localStorage.setItem(key, JSON.stringify(legacy
      ? { used: 2, availableAt: Date.now() + 25 * 60000 }
      : { used: 2, availableAt: Date.now() + duration, cooldownMs: duration }));
  }, { key: MESSAGE_ALLOWANCE_KEY, duration: MESSAGE_COOLDOWN_MS, legacy: testInfo.title.startsWith('an existing') });
});

async function open(page) {
  await openMessageDesk(page);
  await expect(page.getByRole('timer')).toHaveText('10:00');
  await expect(page.getByRole('button', { name: 'Share with friends', exact: true })).toBeVisible();
}

test('native sharing sends the public maker link without names or access details and preserves the cooldown', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async data => { window.sharedData = data; } });
  });
  await open(page);
  const before = await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);
  await page.getByRole('button', { name: 'Share with friends', exact: true }).click();
  await expect(page.getByText('Sharing options opened.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.sharedData)).toEqual({
    title: 'Free personalised Santa message | Santa Radio',
    text: 'Create a free personalised Santa audio message and enjoy Christmas music on Santa Radio.',
    url: shareUrl,
  });
  expect(await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY)).toBe(before);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
});

test('without native sharing, the link is copied with accessible confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedLink = text; } } });
  });
  await open(page);
  await page.getByRole('button', { name: 'Share with friends', exact: true }).click();
  await expect(page.getByText('Link copied. Paste it into a message to tell your friends.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.copiedLink)).toBe(shareUrl);
});

test('cancelling native sharing does not copy the link or display a false success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { window.didCopy = true; } } });
  });
  await open(page);
  await page.getByRole('button', { name: 'Share with friends', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share with friends', exact: true })).toBeEnabled();
  await expect(page.locator('.message-share-status')).toHaveCount(0);
  expect(await page.evaluate(() => window.didCopy)).toBeUndefined();
});

test('failed native sharing falls back to copying the same link', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async () => { throw new Error('Not available'); } });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedLink = text; } } });
  });
  await open(page);
  await page.getByRole('button', { name: 'Share with friends', exact: true }).click();
  await expect(page.getByText('Link copied. Paste it into a message to tell your friends.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.copiedLink)).toBe(shareUrl);
});

test('unavailable sharing and blocked clipboard leave a selectable link on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Blocked'); } } });
  });
  await open(page);
  await page.getByRole('button', { name: 'Share with friends', exact: true }).click();
  await expect(page.getByText('Copy this link to tell your friends:', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Link to share')).toHaveValue(shareUrl);
  await expect(page.getByLabel('Link to share')).toHaveAttribute('readonly', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('.message-wait').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.screenshot({ path: 'generated-artifacts/santa-message-ten-minute-share-mobile.jpg' });
});

test('an existing 30-minute wait is shortened without restarting it', async ({ page }) => {
  await openMessageDesk(page);
  await expect(page.getByRole('timer')).toHaveText('05:00');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
});
