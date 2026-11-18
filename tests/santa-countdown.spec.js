import { test, expect } from '@playwright/test';

test('countdown follows the saved deadline through reload and unlocks at zero', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T22:00:00Z') });
  await page.route('**/api/santa-message-access', route => route.fulfill({ json: { authorized: true } }));
  await page.addInitScript(() => {
    if (!localStorage.getItem('santa-message-allowance')) localStorage.setItem('santa-message-allowance', JSON.stringify({used: 1, availableAt: Date.now() + 65000, cooldownMs: 7200000}));
  });
  await page.goto('/free-santa-message');
  const notice = page.getByRole('timer');
  await expect(notice).toHaveText('Your next free message available in 1m 5s.');
  await page.clock.fastForward(5000);
  await expect(notice).toHaveText('Your next free message available in 1m 0s.');
  await page.reload();
  await expect(notice).toHaveText('Your next free message available in 1m 0s.');
  await page.clock.fastForward(59000);
  await expect(notice).toHaveText('Your next free message available in 0m 1s.');
  await page.clock.fastForward(1000);
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Create message', exact: true})).toBeVisible();
});
