import { expect } from '@playwright/test';
import { BREVO_FORM_URL } from '../../src/lib/santaMessageAccess.js';

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

export async function openMessageDesk(page) {
  await mockBrevo(page);
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
}
