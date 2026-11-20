import { expect } from '@playwright/test';

export async function expectStudioHeader(page, sandbox = false) {
  const studio = page.locator('main.smw-page');
  await expect(studio.locator('h1.smw-visually-hidden')).toHaveText('Santa’s Message Maker Studio');
  await expect(studio.locator('.smw-intro')).toHaveCount(0);
  const notice = studio.getByRole('complementary', { name: 'Sandbox test notice', exact: true });
  if (sandbox) {
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Sandbox test payment confirmed — no real money moved.');
    await expect(notice).toContainText('Secure return emails are live-site only.');
  } else {
    await expect(notice).toHaveCount(0);
  }
}
