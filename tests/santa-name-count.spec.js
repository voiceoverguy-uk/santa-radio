import { test, expect } from '@playwright/test';
import { openMessageDesk } from './helpers/message-access.js';

const demrie = { id: 'demrie', name: 'Demrie', downloadName: 'Santa-message-for-Demrie.mp3' };

test('hosted total appears before typing, stays independent of matches and refreshes new uploads', async ({ page }) => {
  await page.clock.install();
  let total = 274, renders = 0;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  await page.route('**/api/santa-names?*', route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    return route.fulfill({ json: { records: q ? [demrie] : [], hostedCount: total, warning: null } });
  });
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('274 names available to download', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Child’s first name')).toHaveValue('');
  total = 275;
  await page.clock.fastForward(75_000);
  await expect(page.getByText('275 names available to download', { exact: true })).toBeVisible();
  await page.getByLabel('Child’s first name').fill('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  await expect(page.getByText('275 names available to download', { exact: true })).toBeVisible();
  expect(renders).toBe(0);
});

test('unavailable inventory does not invent a zero total and a retry restores the count', async ({ page }) => {
  let failed = true;
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: failed ? null : 1,
    warning: failed ? 'The hosted name list is unavailable. Only existing recordings are shown.' : null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('Name total temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText('0 names available to download', { exact: true })).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'Refresh name list' }).click();
  await expect(page.getByText('1 name available to download', { exact: true })).toBeVisible();
});

test('large totals fit on mobile and genuine empty inventory displays zero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let total = 12_345;
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: total, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('12,345 names available to download', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  total = 0;
  await page.getByLabel('Child’s first name').fill('Unknown');
  await expect(page.getByText('0 names available to download', { exact: true })).toBeVisible();
});
