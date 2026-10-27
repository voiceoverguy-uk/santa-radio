import { test, expect } from '@playwright/test';

for (const path of ['/', '/free-santa-message']) {
  test(`real voice tagline and accessible tooltip on ${path}`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      records: [], hostedCount: 9775, warning: null,
    } }));
    await page.goto(path);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const minimise = page.getByRole('button', { name: 'Minimise radio player', exact: true });
    if (await minimise.isVisible()) await minimise.click();
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const tagline = page.locator('.santa-voice-tagline');
    await expect(tagline.getByRole('heading')).toHaveText('Their name. Santa’s REAL VOICE.');
    const trigger = tagline.getByRole('button', { name: 'About Santa’s real voice', exact: true });
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeHidden();
    await tagline.getByRole('heading').hover({ position: { x: 5, y: 5 } });
    await expect(tooltip).toBeHidden();
    await expect(tagline.getByRole('heading')).toHaveCSS('text-decoration-line', 'none');
    await expect(trigger).toHaveCSS('text-decoration-line', 'none');
    await expect(trigger.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await trigger.evaluate(node =>
      node.parentElement.tagName === 'H3' && node.parentElement.lastElementChild === node)).toBe(true);
    await trigger.hover();
    await expect(tooltip).toHaveText('This is NOT another AI voice');
    expect(await tooltip.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeLessThan(13);
    expect(await tooltip.evaluate(node => parseFloat(getComputedStyle(node).paddingTop))).toBeLessThanOrEqual(6);
    await expect(tooltip).toHaveCSS('box-shadow', 'none');
    await expect(tooltip).toHaveCSS('border-top-width', '0px');
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
    await trigger.focus();
    await expect(tooltip).toBeVisible();
    await expect(trigger).toHaveAccessibleDescription('This is NOT another AI voice');
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(trigger).toBeFocused();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(tooltip).toBeHidden();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await trigger.click();
    await expect(tooltip).toBeVisible();
    const bounds = await tooltip.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    expect(await tagline.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addStyleTag({ content: 'html { font-size: 100%; }' });
    await tagline.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await page.screenshot({ path: `generated-artifacts/workshop/real-voice-${path === '/' ? 'home' : 'maker'}.png`, animations: 'disabled' });
  });
}
