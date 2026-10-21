import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

for (const width of [1440, 390]) {
  test(`gold underline follows page navigation and browser history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const openMenu = async () => {
      const button = nav.getByRole('button', { name: 'Open menu', exact: true });
      if (await button.isVisible()) await button.click();
    };
    for (const [label, path] of [
      ['Home', '/'], ['Apps', '/apps'], ['Music', '/christmas-music'],
      ['Celebrity Mugshots', '/mugshots/all'], ['Santa Tracker', '/santa-tracker'],
      ['FREE Santa Message', '/free-santa-message'],
    ]) {
      await openMenu();
      const link = nav.getByRole('link', { name: label, exact: true, includeHidden: true });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(link).toHaveAttribute('aria-current', 'page');
      if (width <= 1200) await expect(nav.locator('#main-menu')).toBeHidden();
      await openMenu();
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect.poll(() => link.evaluate(el => getComputedStyle(el, '::after').transform))
        .toBe('matrix(1, 0, 0, 1, 0, 0)');
      expect(await link.evaluate(el => getComputedStyle(el, '::after').backgroundColor)).toBe('rgb(230, 206, 134)');
      expect(await link.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('nav-arrival-underline');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goBack();
    await openMenu();
    await expect(nav.getByRole('link', { name: 'Santa Tracker', exact: true })).toHaveAttribute('aria-current', 'page');
  });
}

test('reduced motion keeps the active underline without animation on nested pages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/christmas-artist/60-chris-rea-driving-home-for-christmas');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const active = nav.getByRole('link', { name: 'Music', exact: true });
  await expect(active).toHaveAttribute('aria-current', 'page');
  expect(await active.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  expect(await active.evaluate(el => getComputedStyle(el, '::after').transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
});
