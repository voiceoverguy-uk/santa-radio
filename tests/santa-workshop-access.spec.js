import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { openMessageDesk } from './helpers/message-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { mkdir } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-names?*', route => route.fulfill({
    json: { records: [{ id: 'demrie', name: 'Demrie', downloadName: 'santa-recorded-message-for-Demrie.mp3' }], hostedCount: 1, warning: null },
  }));
});

test('direct visits, client navigation and refresh stay locked without a valid session', async ({ page }) => {
  const document = await page.request.get('/santa-message-workshop');
  const html = await document.text();
  expect(html).not.toContain('What name should Santa say?');
  expect(html).not.toContain('smw-builder');
  expect(html).toContain('noindex');
  expect(document.headers()['cache-control']).toContain('no-store');
  let catalogue = 0;
  page.on('request', request => { if (request.url().includes('/api/santa-workshop-catalogue')) catalogue++; });
  await page.goto('/santa-message-workshop');
  await expect(page.getByLabel('Workshop password', { exact: true })).toBeVisible();
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Workshop password', { exact: true })).toBeVisible();
  expect(catalogue).toBe(0);
  await page.goto('/');
  await page.evaluate(() => {
    window.history.pushState({}, '', '/santa-message-workshop');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByLabel('Workshop password', { exact: true })).toBeVisible();
  await expect(page.locator('.smw-builder')).toHaveCount(0);
});

for (const width of [1280, 375]) {
  test(`discreet entry, keyboard dialog, errors and session refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await openMessageDesk(page, { mockNames: false });
    const minimise = page.getByRole('button', { name: 'Minimise radio player' });
    if (await minimise.isVisible()) await minimise.click();
    const entry = page.getByRole('button', { name: 'Open Santa workshop preview' });
    await expect(page.locator('.workshop-coming-soon')).toHaveText('More customisable options coming soon.');
    expect(await entry.evaluate(node => getComputedStyle(node).textDecorationLine)).toBe('none');
    expect(await page.locator('.service-notice').evaluate(node => node.nextElementSibling.className)).toBe('workshop-coming-soon');
    await entry.scrollIntoViewIfNeeded();
    await mkdir('generated-artifacts/workshop-access', { recursive: true });
    if (width === 1280) {
      await page.locator('.service-notice').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const clip = await page.locator('.santa-message-box').evaluate(node => {
        const box = node.getBoundingClientRect();
        const notice = node.querySelector('.service-notice').getBoundingClientRect();
        const sentence = node.querySelector('.workshop-coming-soon').getBoundingClientRect();
        return { x: box.x, y: notice.y - 28, width: box.width, height: sentence.bottom - notice.y + 56 };
      });
      await page.screenshot({ path: 'generated-artifacts/workshop-access/entry.jpg', clip });
    }
    await entry.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    const field = dialog.getByLabel('Workshop password', { exact: true });
    await expect(dialog).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('type', 'password');
    if (width === 1280) await dialog.screenshot({ path: 'generated-artifacts/workshop-access/dialog.jpg' });
    const close = dialog.getByRole('button', { name: 'Close workshop access' });
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(entry).toBeFocused();
    await page.keyboard.press('Space');
    await field.fill('definitely-not-the-password');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('alert')).toContainText('not correct');
    await expect(page).toHaveURL(/free-santa-message/);
    // A transient network failure leaves the same form available for retry.
    await page.route('**/api/santa-workshop-access', route => route.abort('failed'));
    await field.fill('network-retry');
    await dialog.getByRole('button', { name: 'Enter workshop' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await page.unroute('**/api/santa-workshop-access');
    // Obtain only an ephemeral test-server password, never the owner's secret.
    await field.fill(process.env.WORKSHOP_TEST_PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/santa-message-workshop$/);
    await expect(page.getByRole('heading', { name: 'What name should Santa say?' })).toBeVisible();
    const cookie = (await page.context().cookies()).find(item => item.name === 'santa-workshop-preview');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(cookie.expires).toBe(-1);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'What name should Santa say?' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Open Santa workshop preview' })).toHaveCount(0);
  });
}

test('missing configuration and network status failures stay locked and permit retry', async ({ page }) => {
  await page.route('**/api/santa-workshop-access', route => route.fulfill({
    status: 503, json: { error: 'Workshop preview access is not configured yet. Please try again later.' },
  }));
  await page.goto('/santa-message-workshop');
  await expect(page.getByRole('alert')).toContainText('not configured');
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  await page.unroute('**/api/santa-workshop-access');
  await page.getByRole('button', { name: 'Retry access check' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Workshop password', { exact: true })).toBeVisible();
});

test('closing a pending password request cancels navigation and clears the field', async ({ page }) => {
  await openMessageDesk(page, { mockNames: false });
  const entry = page.getByRole('button', { name: 'Open Santa workshop preview' });
  await entry.click();
  const dialog = page.getByRole('dialog');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/santa-workshop-access', async route => {
    await pending;
    await route.fulfill({ json: { authorized: true } }).catch(() => {});
  });
  await dialog.getByLabel('Workshop password', { exact: true }).fill('cancelled-test-attempt');
  await dialog.getByRole('button', { name: 'Enter workshop' }).click();
  await expect(dialog.getByRole('button', { name: 'Checking…' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close workshop access' }).click();
  release();
  await expect(dialog).not.toBeVisible();
  await expect(entry).toBeFocused();
  await expect(page).toHaveURL(/free-santa-message/);
  await entry.click();
  await expect(page.getByRole('dialog').getByLabel('Workshop password', { exact: true })).toHaveValue('');
});
