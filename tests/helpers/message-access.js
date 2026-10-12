import { expect } from '@playwright/test';
import { BREVO_FORM_URL } from '../../src/lib/santaMessageAccess.js';
import { santaNames, findSantaMessage } from '../../src/data/santaMessages.js';

export const brevoUrl = `${BREVO_FORM_URL}?isAjax=1`;
export const adult = { FIRSTNAME: 'Testparent', LASTNAME: 'Example', EMAIL: 'parent@example.test' };

export async function fillAccessForm(page) {
  for (const [field, value] of Object.entries(adult)) {
    await page.locator(`.santa-message-access input[name="${field}"]`).fill(value);
  }
}

export async function mockBrevo(page, json = { success: true }, status = 200) {
  await page.route(brevoUrl, route => route.fulfill({
    status, json, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
}

export async function openMessageDesk(page, { mockNames = true } = {}) {
  await mockBrevo(page);
  if (mockNames) await page.route('**/api/santa-names?*', route => {
    const query = new URL(route.request().url()).searchParams.get('q').trim().toLowerCase();
    return route.fulfill({ json: {
      records: santaNames.filter(name => name.toLowerCase().startsWith(query)).map(findSantaMessage),
      hostedCount: 0, warning: null,
    } });
  });
  await page.goto('/free-santa-message');
  const reject = page.getByRole('button', { name: 'Reject optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).evaluate(
    element => element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
}
