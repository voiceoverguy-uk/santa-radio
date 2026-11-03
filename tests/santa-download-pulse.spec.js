import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openMessageDesk } from './helpers/message-access.js';

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`audio download pulses until activated with ${reducedMotion} motion`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ reducedMotion });
    const audio = readFileSync('server/santa-audio/sleighbells.mp3');
    await page.route('**/api/santa-greeting?*', route => route.fulfill({ json: { available: false } }));
    await page.route('**/api/santa-message', route => route.fulfill({
      contentType: 'audio/mpeg', body: audio,
    }));
    await openMessageDesk(page);
    await page.getByLabel('First Name').fill('Olivia');
    await page.getByRole('option', { name: 'Olivia', exact: true }).click();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    const link = page.getByRole('link', { name: 'Download your audio', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS('animation-name',
      reducedMotion === 'reduce' ? 'none' : 'message-download-glow');
    await link.focus();
    const downloadEvent = page.waitForEvent('download');
    await link.press('Enter');
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('santa-recorded-message-for-Olivia.mp3');
    expect(await download.failure()).toBeNull();
    await expect(link).not.toHaveClass(/message-download--pending/);
    await expect(link).toHaveCSS('animation-name', 'none');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(link).toHaveCSS('animation-name', 'none');
  });
}
