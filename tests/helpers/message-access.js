import { expect } from '@playwright/test';
import { BREVO_FORM_URL } from '../../src/lib/santaMessageAccess.js';
import { santaNames, findSantaMessage } from '../../src/data/santaMessages.js';
import { randomUUID } from 'node:crypto';
import { issueFreeAccess, freeSession, FREE_ACCESS_COOKIE } from '../../server/santa-message-access.js';

export const brevoUrl = `${BREVO_FORM_URL}?isAjax=1`;
// Unique surname avoids mistaking SantaMessageExample asset URLs for leaked PII.
export const adult = { FIRSTNAME: 'Testparent', LASTNAME: 'AccessFixtureSurname', EMAIL: 'parent@example.test' };

export async function fillAccessForm(page) {
  for (const [field, value] of Object.entries(adult)) {
    await page.locator(`.santa-message-access input[name="${field}"]`).fill(value);
  }
}

export async function mockBrevo(page, json = { success: true }, status = 200) {
  // Mock provider acceptance only in this browser. The application still
  // verifies its real signed grant and database-backed message allowance.
  const grantEmail = `browser-fixture-${randomUUID()}@example.test`;
  const grant = issueFreeAccess(grantEmail);
  await page.route('**/api/santa-message-access', route => {
    if (route.request().method() === 'GET') return route.fulfill({
      json: { authorized: !!freeSession({ headers: route.request().headers() }), availableAt: 0 },
    });
    return route.fulfill({
      status, json, headers: json.success === true && status === 200
        ? { 'Set-Cookie': `${FREE_ACCESS_COOKIE}=${grant}; Path=/; HttpOnly; Secure; SameSite=Lax` } : {},
    });
  });
  await page.route(brevoUrl, route => route.fulfill({
    status, json, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  return { renewGrant: () => issueFreeAccess(grantEmail) };
}

export async function mockSantaNames(target) {
  await target.route('**/api/santa-names', route => {
    const query = (route.request().postDataJSON()?.query || '').trim().toLowerCase();
    return route.fulfill({ json: {
      records: santaNames.filter(name => name.toLowerCase().startsWith(query)).slice(0, 10).map(name => ({
        ...findSantaMessage(name), selectionToken: 'controlled-fixture-token',
        previewUrl: '/api/santa-name-preview?token=controlled-fixture-token',
      })),
      hostedCount: 0, warning: null,
    } });
  });
}

export async function openMessageDesk(page, { mockNames = true, path = '/free-santa-message' } = {}) {
  await mockBrevo(page);
  if (mockNames) await mockSantaNames(page);
  await page.goto(path);
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).evaluate(
    element => element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('First Name')).toBeVisible();
}
