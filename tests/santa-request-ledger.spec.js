import { test, expect } from '@playwright/test';

test('isolated staff UI preserves failed actions, records into history and downloads all rows on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const date = '2026-10-12T12:00:00.000Z';
  const item = { id: 'éranes', name: 'Éranes', count: 8, firstRequestedAt: date, lastRequestedAt: date, recordedAt: null };
  let recorded = false, attempts = 0;
  await page.route('**/api/name-requests**', route => {
    if (route.request().method() === 'PATCH') {
      if (++attempts === 1) return route.fulfill({ status: 503, json: { error: 'Could not record yet. Retry safely.' } });
      recorded = true; return route.fulfill({ json: { recorded: true } });
    }
    const params = new URL(route.request().url()).searchParams;
    if (params.get('download')) return route.fulfill({ contentType: 'text/plain; charset=utf-8', body: 'First name\tRequests\r\nÉranes\t8\r\nBeyondPage\t2\r\n' });
    const status = params.get('status');
    return route.fulfill({ json: { status, total: (status === 'completed' ? recorded : !recorded) ? 1 : 0,
      page: 1, pageSize: 100, requests: (status === 'completed' ? recorded : !recorded)
        ? [{ ...item, ...(status === 'completed' ? { id: '1', recordedAt: date } : {}) }] : [] } });
  });
  await page.goto('/tests/fixtures/request-ledger.html');
  await expect(page.getByRole('cell', { name: 'Éranes', exact: true })).toBeVisible();
  const action = page.getByRole('button', { name: 'Mark Éranes recorded' });
  await action.click();
  await expect(page.getByRole('alert')).toContainText('Could not record yet.');
  await expect(page.getByRole('cell', { name: 'Éranes', exact: true })).toBeVisible();
  await action.click();
  await expect(page.locator('.staff-feedback[role="status"]')).toContainText('saved in completed history');
  await page.getByRole('button', { name: 'Completed history', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Éranes', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '8', exact: true })).toBeVisible();
  await page.screenshot({ path: 'generated-artifacts/name-request-ledger-mobile.jpg' });
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Download TXT', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('santa-name-requests-completed.txt');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('isolated staff UI does not reveal rows or offer downloads after rejection', async ({ page }) => {
  await page.route('**/api/name-requests**', route => route.fulfill({ status: 403, json: { error: 'Not approved.' } }));
  await page.goto('/tests/fixtures/request-ledger.html');
  await expect(page.getByRole('alert')).toContainText('Only the verified primary');
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download TXT' })).toBeDisabled();
});
