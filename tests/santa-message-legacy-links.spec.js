import { test, expect } from '@playwright/test';
import { mockBrevo, fillAccessForm } from './helpers/message-access.js';

async function setup(page, records = [{ id: 'cooper', name: 'Cooper', downloadName: 'Santa-message-for-Cooper.mp3' }]) {
  const requests = { searches: [], renders: [] };
  await mockBrevo(page);
  await page.route('**/api/santa-names?*', route => {
    const q = new URL(route.request().url()).searchParams.get('q').toLowerCase();
    requests.searches.push(q);
    return route.fulfill({ json: {
      records: q ? records.filter(record => [record.name, record.id].some(value => value.toLowerCase().startsWith(q))) : [],
      hostedCount: records.length, warning: null,
    } });
  });
  // Explicitly simulate a render failure to verify request wiring without
  // sending an invented MP3 or depending on the external recording host.
  await page.route('**/api/santa-message', route => {
    requests.renders.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: 'Test render unavailable.' } });
  });
  return requests;
}

async function openAccess(page) {
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
  await fillAccessForm(page);
  const button = page.getByRole('button', { name: 'Get my free Santa message' });
  await button.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await button.click();
  await expect(page.getByLabel('First Name')).toBeVisible();
}

test('old catalogue goes to the generic maker and preserves the adult gate', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/personalised-santa-message/all');
  await expect(page).toHaveURL(/\/free-santa-message$/);
  await expect(page.locator('.message-name-label')).toHaveCount(0);
  expect(requests.searches.every(query => query === '')).toBe(true);
  expect(requests.renders).toEqual([]);
  await openAccess(page);
  await expect(page.getByLabel('First Name')).toHaveValue('');
  await expect(page.locator('.message-name-count')).toHaveText('1 name available');
});

test('old name link carries a verified recording without submitting access or creating audio automatically', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/personalised-santa-message/Cooper?utm_source=google');
  await expect(page).toHaveURL(/\/free-santa-message\?utm_source=google&name=Cooper$/);
  await expect(page.locator('.message-name-label')).toHaveCount(0);
  expect(requests.searches.every(query => query === '')).toBe(true);
  expect(requests.renders).toEqual([]);
  await openAccess(page);
  await expect(page.getByLabel('First Name')).toHaveValue('Cooper');
  await expect(page.getByText('A recording for Cooper is available.', { exact: true })).toBeVisible();
  expect(requests.renders).toEqual([]);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/free-santa-message');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByText('Test render unavailable.', { exact: true })).toBeVisible();
  expect(requests.renders).toEqual([expect.objectContaining({ name: 'cooper' })]);
});

test('an unavailable legacy name stays explicit and cannot generate a different recording', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/personalised-santa-message/NoSuchRecordedName');
  await openAccess(page);
  await expect(page.getByLabel('First Name')).toHaveValue('NoSuchRecordedName');
  await expect(page.getByText('No matching recording yet. Try another name.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByText('We don’t have a recording for that name yet. Choose one of the suggested names.', { exact: true })).toBeVisible();
  expect(requests.renders).toEqual([]);
  await page.getByLabel('First Name').fill('Cooper');
  await expect(page.getByText('A recording for Cooper is available.', { exact: true })).toBeVisible();
});

test('a legacy filename with different display spelling requires the verified suggestion', async ({ page }) => {
  const requests = await setup(page, [{ id: 'mary-anne', name: 'Mary Anne', downloadName: 'Santa-message-for-Mary Anne.mp3' }]);
  await page.goto('/personalised-santa-message/Mary-Anne');
  await openAccess(page);
  await expect(page.getByLabel('First Name')).toHaveValue('Mary-Anne');
  await page.getByLabel('First Name').focus();
  await page.getByRole('option', { name: 'Mary Anne', exact: true }).click();
  await expect(page.getByText('Mary Anne is selected.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByText('Test render unavailable.', { exact: true })).toBeVisible();
  expect(requests.renders).toEqual([expect.objectContaining({ name: 'mary-anne' })]);
});

test('invalid direct name parameters are ignored instead of displayed or submitted', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/free-santa-message?name=%3Cscript%3E');
  await openAccess(page);
  await expect(page.getByLabel('First Name')).toHaveValue('');
  await expect(page.locator('.message-name-count')).toHaveText('1 name available');
  expect(requests.searches).toEqual(['']);
  expect(requests.renders).toEqual([]);
});
