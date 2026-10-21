import { test, expect } from '@playwright/test';
import { openMessageDesk } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY } from '../src/lib/santaMessageAllowance.js';
import { randomUUID } from 'node:crypto';
import { databasePool } from '../server/name-request-store.js';

const confirmation = 'Your request has been saved. Check back in a week to see if Santa has added it.';
test('a missing name can be requested without generating audio or consuming allowance', async ({ page }) => {
  let submissions = 0, renders = 0, payload;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  await page.route('**/api/name-requests', route => {
    submissions++; payload = route.request().postDataJSON();
    return route.fulfill({ json: { saved: true, name: payload.name, duplicate: false, message: confirmation } });
  });
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('Replit');
  await expect(page.getByRole('button', { name: 'Request this name', exact: true })).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);
  await page.getByRole('button', { name: 'Request this name', exact: true }).click();
  await expect(page.getByText(confirmation, { exact: true })).toBeVisible();
  expect(payload.name).toBe('Replit');
  expect(payload.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(submissions).toBe(1); expect(renders).toBe(0);
  expect(await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY)).toBe(before);
  await page.getByLabel('First Name').fill('Olivia');
  await expect(page.getByRole('button', { name: 'Request this name', exact: true })).toHaveCount(0);
  await expect(page.getByText(confirmation, { exact: true })).toHaveCount(0);
});

for (const path of ['/', '/free-santa-message']) test(`request failure is shown honestly and a retry can save the name on ${path}`, async ({ page }) => {
  await page.setViewportSize({ width: path === '/' ? 1280 : 390, height: 844 });
  let calls = 0, tokens = [];
  await page.route('**/api/name-requests', route => {
    calls++;
    tokens.push(route.request().postDataJSON().requestId);
    return calls === 1 ? route.fulfill({ status: 503, json: { error: 'Requests are temporarily unavailable.' } })
      : route.fulfill({ json: { saved: true, name: 'Replit', duplicate: false, message: confirmation } });
  });
  await openMessageDesk(page, { path });
  await page.getByLabel('First Name').fill('Replit');
  await page.getByRole('button', { name: 'Request this name', exact: true }).click();
  await expect(page.locator('.name-request-note[role="alert"]')).toContainText('Requests are temporarily unavailable.');
  await expect(page.getByText(confirmation, { exact: true })).toHaveCount(0);
  await page.locator('.name-request-button').click();
  await expect(page.getByText(confirmation, { exact: true })).toBeVisible();
  expect(calls).toBe(2);
  expect(tokens[0]).toBe(tokens[1]);
});

test('invalid names and an unavailable inventory never offer a false missing-name request', async ({ page }) => {
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('<script>');
  await expect(page.getByText('No matching recording yet. Try another name.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request this name', exact: true })).toHaveCount(0);
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: null, warning: 'The hosted name list is unavailable.',
  } }));
  await page.getByLabel('First Name').fill('Replit');
  await expect(page.getByText('The hosted name list is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request this name', exact: true })).toHaveCount(0);
});

test('pending requests ignore repeated clicks and do not attach stale confirmation to another name', async ({ page }) => {
  let calls = 0, release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/name-requests', async route => {
    calls++; await held; await route.fulfill({ json: { saved: true, name: 'Replit', duplicate: false, message: confirmation } }).catch(() => {});
  });
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('Replit');
  const button = page.getByRole('button', { name: 'Request this name', exact: true });
  await button.evaluate(el => { el.click(); el.click(); });
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator('.name-request-button')).toBeDisabled();
  await page.getByLabel('First Name').fill('Olivia');
  release();
  await expect(page.getByRole('option', { name: 'Olivia', exact: true })).toBeVisible();
  await expect(page.getByText(confirmation, { exact: true })).toHaveCount(0);
});

test('mobile request confirmation uses the server seasonal message and fits without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const december = confirmation.replace('a week', 'a couple of days');
  await page.route('**/api/name-requests', route => route.fulfill({ json: { saved: true, name: 'Replit', message: december } }));
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('Replit');
  await page.getByRole('button', { name: 'Request this name', exact: true }).click();
  await expect(page.getByText(december, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('.name-request').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.screenshot({ path: 'generated-artifacts/santa-name-request-mobile.jpg' });
});

test('staff routes are noindex and the live API rejects anonymous readers', async ({ page, request }) => {
  const response = await request.get('/api/name-requests');
  expect(response.status()).toBe(401);
  expect(await response.json()).not.toHaveProperty('requests');
  const route = await request.get('/request-names');
  expect(route.status()).toBe(200);
  expect(route.headers()['x-robots-tag']).toContain('noindex');
  expect(await route.text()).toContain('noindex, nofollow');
  await page.goto('/request-names');
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
  await expect(page.getByRole('link', { name: 'Sign in to view requests', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('table')).toHaveCount(0);
});

for (const path of ['/', '/free-santa-message']) test(`real saving and normal missing-name UI on ${path}`, async ({ page }) => {
  await page.setViewportSize({ width: path === '/' ? 1280 : 390, height: 900 });
  const name = 'UiCheck' + randomUUID().replace(/-/g, '').replace(/\d/g, digit => String.fromCharCode(65 + Number(digit)));
  const key = name.toLowerCase(), pool = databasePool();
  try {
    await openMessageDesk(page, { path, mockNames: false });
    for (const value of ['Eranes', 'Replit']) {
      await page.getByLabel('First Name').fill(value);
      await expect(page.getByRole('button', { name: 'Request this name', exact: true })).toBeVisible();
      await expect(page.locator('.name-request [role="alert"]')).toHaveCount(0);
    }
    await page.locator('.name-request').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.screenshot({ path: `generated-artifacts/name-request-normal-${path === '/' ? 'home' : 'mobile'}.jpg` });
    await page.getByLabel('First Name').fill(name);
    await page.getByRole('button', { name: 'Request this name', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Request saved', exact: true })).toBeDisabled();
    await expect(page.getByText(confirmation, { exact: true })).toBeVisible();
    const rows = await pool.query('SELECT request_count FROM santa_name_requests WHERE request_key=$1', [key]);
    expect(rows.rows[0].request_count).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally {
    await pool.query('DELETE FROM santa_name_request_submissions WHERE request_key=$1', [key]);
    await pool.query('DELETE FROM santa_name_requests WHERE request_key=$1', [key]);
  }
});

test('a 200 without a saved acknowledgement is not success', async ({ page }) => {
  await page.route('**/api/name-requests', route => route.fulfill({ json: { name: 'Replit', message: confirmation } }));
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('Replit');
  await page.getByRole('button', { name: 'Request this name', exact: true }).click();
  await expect(page.locator('.name-request [role="alert"]')).toContainText('unexpected reply');
  await expect(page.getByText(confirmation, { exact: true })).toHaveCount(0);
});

test('a lost real committed first response retries safely without its visitor cookie', async ({ page }) => {
  const name = 'LostResponse' + randomUUID().replace(/-/g, '').replace(/\d/g, digit => String.fromCharCode(65 + Number(digit)));
  const key = name.toLowerCase(), pool = databasePool();
  let calls = 0, token;
  try {
    await page.route('**/api/name-requests', async route => {
      const body = route.request().postDataJSON();
      if (++calls === 1) {
        token = body.requestId;
        const committed = await route.fetch();
        expect(committed.status()).toBe(200);
        await route.abort('failed');
      } else {
        expect(body.requestId).toBe(token);
        await route.continue();
      }
    });
    await openMessageDesk(page);
    await page.getByLabel('First Name').fill(name);
    await page.getByRole('button', { name: 'Request this name', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry name request', exact: true })).toBeVisible();
    await expect(page.getByText(confirmation, { exact: true })).toHaveCount(0);
    await page.context().clearCookies();
    await page.getByRole('button', { name: 'Retry name request', exact: true }).click();
    await expect(page.getByText(confirmation, { exact: true })).toBeVisible();
    expect((await pool.query('SELECT request_count FROM santa_name_requests WHERE request_key=$1', [key])).rows[0].request_count).toBe(1);
  } finally {
    await pool.query('DELETE FROM santa_name_request_submissions WHERE request_key=$1', [key]);
    await pool.query('DELETE FROM santa_name_requests WHERE request_key=$1', [key]);
  }
});

test('privacy-blocked storage and older UUID support still allow a safe in-page retry', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(...args) {
      if (this === sessionStorage) throw new DOMException('Blocked', 'SecurityError');
      return original.apply(this, args);
    };
  });
  const ids = [];
  await page.route('**/api/name-requests', route => {
    ids.push(route.request().postDataJSON().requestId);
    return ids.length === 1 ? route.fulfill({ status: 503, json: { error: 'Please retry.' } })
      : route.fulfill({ json: { saved: true, name: 'Replit', message: confirmation } });
  });
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('Replit');
  await page.getByRole('button', { name: 'Request this name', exact: true }).click();
  await expect(page.getByText('Your browser cannot remember retries after a refresh. Keep this page open when retrying.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry name request', exact: true }).click();
  await expect(page.getByText(confirmation, { exact: true })).toBeVisible();
  expect(ids[0]).toBe(ids[1]);
  expect(ids[0]).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('real public endpoint stores one requested name and does not count repeated clicks twice', async ({ request }) => {
  const name = 'Previewcheck' + randomUUID().replace(/-/g, '').replace(/\d/g, digit => String.fromCharCode(65 + Number(digit)));
  const key = name.toLowerCase();
  const pool = databasePool();
  try {
    const first = await request.post('/api/name-requests', { data: { name } });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ name, duplicate: false, message: confirmation });
    const second = await request.post('/api/name-requests', { data: { name } });
    expect(second.status()).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
    const rows = await pool.query('SELECT name, request_count FROM santa_name_requests WHERE request_key=$1', [key]);
    expect(rows.rows).toEqual([{ name, request_count: 1 }]);
  } finally {
    await pool.query('DELETE FROM santa_name_request_submissions WHERE request_key=$1', [key]);
    await pool.query('DELETE FROM santa_name_requests WHERE request_key=$1', [key]);
    await pool.end();
  }
});
