import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`isolated private demo, keyboard and pointer selection at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const calls = [];
    const errors = [];
    page.on('request', req => calls.push(req.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*stagcommunications*', route => route.abort());
    await page.goto('/names');
    const input = page.getByRole('combobox', { name: 'Name', exact: true });
    await expect(input).toBeVisible();
    await input.fill('d');
    await page.waitForTimeout(250);
    expect(calls.filter(url => url.includes('/api/names-demo'))).toHaveLength(0);
    const start = Date.now();
    await input.fill('da');
    await expect(page.getByRole('option').first()).toBeVisible();
    console.log(`${viewport.width}px typing-to-suggestions including 160ms debounce: ${Date.now() - start}ms`);
    expect(await page.getByRole('option').count()).toBeLessThanOrEqual(10);
    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'opt-0');
    const first = await page.getByRole('option').first().textContent();
    await input.press('Enter');
    await expect(input).toHaveValue(first);
    await expect(page.locator('#chosen')).toHaveText(`Selected: ${first}`);
    await input.fill('ma');
    await expect(page.getByRole('option').first()).toBeVisible();
    const tapped = await page.getByRole('option').first().textContent();
    await page.getByRole('option').first().click();
    await expect(input).toHaveValue(tapped);
    await input.fill('jo');
    await input.press('Escape');
    await page.waitForTimeout(250);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(calls.some(url => /stagcommunications|snapshot\.json/.test(url))).toBe(false);
    expect(calls.filter(url => new URL(url).pathname !== '/names' && new URL(url).pathname !== '/api/names-demo')).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('old responses cannot reopen dismissed results, and errors are announced', async ({ page }) => {
  await page.route('**/api/names-demo', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ json: { names: ['Test'] } });
  });
  await page.goto('/names');
  const input = page.getByRole('combobox');
  await input.fill('da');
  await expect(page.getByRole('status')).toHaveText('Searching…');
  await input.press('Escape');
  await page.waitForTimeout(450);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await page.unroute('**/api/names-demo');
  await page.route('**/api/names-demo', route =>
    route.fulfill({ status: 429, json: { error: 'Too many requests. Please wait.' } }));
  await input.fill('ma');
  await expect(page.getByRole('status')).toContainText('Too many requests');
});
