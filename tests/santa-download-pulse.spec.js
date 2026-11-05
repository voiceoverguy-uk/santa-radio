import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openMessageDesk } from './helpers/message-access.js';

test.use({ hasTouch: true });

for (const reducedMotion of ['no-preference', 'reduce'])
for (const [activation, width] of [['keyboard', 390], ['pointer', 1440], ['touch', 390]]) {
  test(`download hands glow to Preview using ${activation} with ${reducedMotion} motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-02T12:00:00Z'));
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
    const invitation = page.getByRole('region', { name: 'Bespoke Santa message invitation' });
    const preview = invitation.getByRole('link', { name: 'Preview Olivia’s bespoke message package', exact: true });
    await expect(preview).toHaveCSS('animation-name', 'none');
    await expect(preview).toHaveCSS('box-shadow', 'none');
    await page.mouse.move(0, 0);
    await expect(preview).toHaveCSS('background-color', 'rgb(234, 211, 154)');
    const before = await preview.evaluate(node => {
      const css = getComputedStyle(node);
      return { background: css.backgroundColor, color: css.color, radius: css.borderRadius,
        width: node.offsetWidth, height: node.offsetHeight };
    });
    const activate = async target => {
      if (activation === 'keyboard') {
        await target.focus();
        await target.press('Enter');
      } else if (activation === 'touch') await target.tap();
      else await target.click();
    };
    const scrollBefore = await page.evaluate(() => scrollY);
    const downloadEvent = page.waitForEvent('download');
    await activate(link);
    // The handoff is activation-driven, not waiting for download completion.
    await expect(preview).toHaveClass(/__link--highlight/);
    await expect(preview).toHaveCSS('animation-name',
      reducedMotion === 'reduce' ? 'none' : 'message-bespoke-glow');
    // Settle the existing hover transition before checking the unchanged fill.
    await page.mouse.move(0, 0);
    await expect(preview).toHaveCSS('background-color', before.background);
    const after = await preview.evaluate(node => {
      const css = getComputedStyle(node);
      return { background: css.backgroundColor, color: css.color, radius: css.borderRadius,
        width: node.offsetWidth, height: node.offsetHeight };
    });
    expect(after).toEqual(before);
    await expect(invitation).toHaveCSS('box-shadow', 'none');
    expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
    if (reducedMotion === 'reduce') {
      await expect(preview).toHaveCSS('box-shadow', 'rgba(239, 52, 58, 0.44) 0px 0px 12px 3px');
    }
    await page.locator('.santa-message-box').screenshot({
      path: `generated-artifacts/bespoke-glow-${activation}-${reducedMotion}.jpg`, animations: 'disabled',
    });
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('Santa-recorded-message-for-Olivia.mp3');
    expect(await download.failure()).toBeNull();
    await expect(link).not.toHaveClass(/message-download--pending/);
    await expect(link).toHaveCSS('animation-name', 'none');
    if (activation === 'keyboard') {
      await preview.focus();
      await preview.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(preview).toBeFocused();
      expect(await preview.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
    }
    await activate(preview);
    await expect(preview).not.toHaveClass(/__link--highlight/);
    await expect(preview).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('#santa-studio-title')).toBeFocused();
    await expect(page.locator('#santa-studio-promotion .studio-gifts')).toHaveAttribute('data-demo-name', 'Olivia');
    const retryEvent = page.waitForEvent('download');
    await activate(link);
    expect((await retryEvent).suggestedFilename()).toBe('Santa-recorded-message-for-Olivia.mp3');
    await expect(preview).not.toHaveClass(/__link--highlight/);
    await expect(link).toHaveCSS('animation-name', 'none');
  });
}
