import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2',
    JSON.stringify({ version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now() })));
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`preview controls keep readable styling and working actions at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker/preview');
    const panel = page.locator('.tracker-preview-panel');
    const header = panel.getByRole('button', { name: 'Preview Controls' });
    const toggle = panel.getByRole('switch', { name: 'Preview mode' });
    await expect(header).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toHaveCSS('background-color', 'rgb(64, 83, 72)');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    await expect(toggle).toHaveCSS('background-color', 'rgb(155, 17, 30)');
    await expect(toggle.locator('.tracker-preview-switch-thumb')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 20, 0)');

    // Inspect every actual button, including controls below the panel's scroll fold.
    const styles = await panel.locator('button').evaluateAll(buttons => buttons.map(button => {
      const css = getComputedStyle(button);
      const box = button.getBoundingClientRect();
      return {
        label: button.textContent.trim() || button.getAttribute('aria-label'),
        appearance: css.appearance, color: css.color, background: css.backgroundColor,
        border: css.borderStyle, width: box.width, height: box.height,
        fits: box.left >= 0 && box.right <= innerWidth,
        textFits: button.scrollWidth <= button.clientWidth + 1,
      };
    }));
    expect(styles.length).toBeGreaterThan(20);
    for (const style of styles) {
      expect(style.label).toBeTruthy();
      expect(style.appearance).toBe('none');
      expect(style.color).toBe('rgb(255, 248, 231)');
      expect(style.background).not.toMatch(/255, 255, 255|rgba\(0, 0, 0, 0\)/);
      expect(style.width).toBeGreaterThan(0);
      expect(style.height).toBeGreaterThan(0);
      expect(style.fits).toBe(true);
      expect(style.textFits).toBe(true);
    }
    const speed = panel.getByRole('button', { name: '10×', exact: true });
    await speed.click();
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    await expect(speed).toHaveAttribute('aria-pressed', 'true');
    await expect(speed).toHaveCSS('background-color', 'rgb(56, 82, 50)');
    await expect(speed).toHaveCSS('border-color', 'rgb(230, 206, 134)');
    await expect(panel.getByRole('button', { name: '1×', exact: true })).toHaveAttribute('aria-pressed', 'false');
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('santa-tracker-preview')));
    await panel.getByRole('button', { name: '24 December', exact: true }).click();
    expect(await saved()).toMatchObject({ enabled: true, jumpTarget: 'christmas-eve-start', speedMultiplier: 10 });
    expect(new Date((await saved()).simulatedStartMs).toISOString()).toMatch(/-12-24T09:00:00\.000Z$/);
    await expect(panel).toContainText('-12-24 09:');
    await panel.getByRole('button', { name: 'Route Start', exact: true }).click();
    expect(new Date((await saved()).simulatedStartMs).toISOString()).toMatch(/-12-24T09:55:00\.000Z$/);
    await panel.getByRole('button', { name: '25 December', exact: true }).click();
    expect(new Date((await saved()).simulatedStartMs).toISOString()).toMatch(/-12-25T23:59:00\.000Z$/);
    const jump = panel.getByRole('button', { name: 'Australia', exact: true });
    await jump.hover();
    await expect(jump).toHaveCSS('background-color', 'rgb(36, 77, 57)');
    await jump.click();
    expect(await saved()).toMatchObject({ jumpTarget: 'australia', speedMultiplier: 10 });
    await panel.getByRole('button', { name: '2min', exact: true }).click();
    expect(await saved()).toMatchObject({ enabled: true, jumpTarget: 'route-start' });
    expect((await saved()).speedMultiplier).toBeGreaterThan(300);
    await panel.getByRole('button', { name: 'Reset to Real Time' }).click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(speed).toHaveCount(0);
    expect(await saved()).toBeNull();
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeHidden();
    // Real keyboard navigation, not programmatic focus alone, activates focus-visible.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(header).toBeFocused();
    await expect(header).toHaveCSS('outline-style', 'solid');
    await expect(header).toHaveCSS('outline-color', 'rgb(230, 206, 134)');
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toBeVisible();
    await page.goto('/santa-tracker');
    await expect(page.locator('.tracker-preview-panel')).toHaveCount(0);
  });
}
