import { test, expect } from '@playwright/test';
import { freeMessageCodeEmail } from '../server/free-message-code-email.js';

for (const width of [390, 1280]) {
  test(`email confirmation gates the maker at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let authorized = false, requests = 0, optedIn = false;
    await page.route('**/api/santa-message-access', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { authorized } });
      const data = route.request().postDataJSON();
      if (data.action === 'request-code') { requests++; optedIn = data.marketingOptIn; return route.fulfill({ json: { state: 'verification', verificationId: '00000000-0000-4000-8000-000000000001' } }); }
      if (data.code !== '012345') return route.fulfill({ status: 400, json: { success: false, message: 'That code doesn’t match. Check your email and try again.' } });
      authorized = true; return route.fulfill({ json: { success: true } });
    });
    await page.route('**/api/santa-names', route => route.fulfill({ json: { records: [], hostedCount: 0 } }));
    await page.goto('/free-santa-message');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.locator('input[name="FIRSTNAME"]').fill('Test');
    await page.locator('input[name="LASTNAME"]').fill('Parent');
    await page.locator('input[name="EMAIL"]').fill('parent@example.test');
    await expect(page.getByRole('checkbox', { name: /Yes, send me relevant/ })).not.toBeChecked();
    if (width === 1280) await page.getByRole('checkbox', { name: /Yes, send me relevant/ }).check();
    await page.getByRole('button', { name: 'Email my verification code' }).click();
    expect(optedIn).toBe(width === 1280);
    await expect(page.getByLabel('Six-digit email code')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).not.toBeVisible();
    await expect(page.getByText('Confirm your email to unlock your free message.', { exact: false })).toBeVisible();
    await page.getByLabel('Six-digit email code').fill('999999');
    await page.getByRole('button', { name: 'Confirm email & unlock my message' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'doesn’t match' })).toBeVisible();
    await page.getByRole('button', { name: 'Change email or request another code' }).click();
    await page.getByRole('button', { name: 'Email my verification code' }).click();
    expect(requests).toBe(2);
    await page.screenshot({ path: `/tmp/santa-verification-form-${width}.png`, fullPage: true });
    await page.getByLabel('Six-digit email code').fill('012345');
    await page.getByRole('button', { name: 'Confirm email & unlock my message' }).click();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeVisible();
  });
}
test('branded verification email fits a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(freeMessageCodeEmail('012345').html);
  await expect(page.getByRole('heading', { name: 'A little Christmas magic awaits' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/santa-free-verification-email.png', fullPage: true });
});
