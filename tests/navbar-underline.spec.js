import { test, expect } from '@playwright/test';
import { expectHighlight } from './helpers/navbar-highlight.js';

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
      if (width > 1200) await expectHighlight(nav, link);
      else {
        expect(await link.evaluate(el => getComputedStyle(el, '::after').backgroundColor)).toBe('rgb(230, 206, 134)');
        expect(await link.evaluate(el => getComputedStyle(el, '::after').height)).toBe('2px');
        expect(await nav.locator('#main-menu').evaluate(el => getComputedStyle(el, '::before').display)).toBe('none');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goBack();
    await openMenu();
    await expect(nav.getByRole('link', { name: 'Santa Tracker', exact: true })).toHaveAttribute('aria-current', 'page');
    if (width > 1200) await expectHighlight(nav, nav.getByRole('link', { name: 'Santa Tracker', exact: true }));
    await page.goForward();
    await expect(nav.getByRole('link', { name: 'FREE Santa Message', exact: true, includeHidden: true })).toHaveAttribute('aria-current', 'page');
    await openMenu();
  });
}

test('reduced motion keeps the active underline without animation on nested pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/christmas-artist/60-chris-rea-driving-home-for-christmas');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const active = nav.getByRole('link', { name: 'Music', exact: true });
  await expect(active).toHaveAttribute('aria-current', 'page');
  await expectHighlight(nav, active);
  expect(await nav.locator('#main-menu').evaluate(el => getComputedStyle(el, '::before').transitionDuration)).toBe('0s');
  const apps = nav.getByRole('link', { name: 'Apps', exact: true });
  await apps.hover();
  await expectHighlight(nav, apps);
  await page.mouse.move(0, 200);
  await expectHighlight(nav, active);
});

test('one underline tracks rapid desktop hovers, including radio and the inset red button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const home = nav.getByRole('link', { name: 'Home', exact: true });
  const radio = nav.locator('.nav-radio');
  const message = nav.locator('.nav-message');
  await expectHighlight(nav, home);
  for (const control of [nav.getByText('Apps', { exact: true }), radio, nav.getByText('Music', { exact: true }), message, home, message]) {
    // Do not wait for the transition: the next hover interrupts the previous one.
    await control.hover();
  }
  await expectHighlight(nav, message);
  await expect(message).toHaveCSS('background-color', 'rgb(155, 17, 30)');
  await expect(message).toHaveCSS('color', 'rgb(230, 206, 134)');
  await expect(home).toHaveCSS('color', 'rgb(225, 230, 220)');
  await radio.hover();
  await expectHighlight(nav, radio);
  await expect(radio).toHaveText('Listen Live');
  await expect(radio).toHaveCSS('color', 'rgb(230, 206, 134)');
  await expect(page).toHaveURL(/\/$/);
  await expect(home).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  expect(await nav.locator('a').evaluateAll(links => links.every(el => getComputedStyle(el, '::after').content === 'none'))).toBe(true);
  expect(await nav.locator('#main-menu').evaluate(el => parseFloat(getComputedStyle(el, '::before').transitionDuration))).toBeGreaterThan(0);
  await page.mouse.move(0, 200);
  await expectHighlight(nav, home);
  await expect(home).toHaveCSS('color', 'rgb(230, 206, 134)');
});

test('keyboard focus moves the highlight without activating links and restores it on blur', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.mouse.move(0, 200);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  // Start at the logo, then use real Tab input to establish keyboard modality.
  await nav.getByRole('link', { name: 'Santa Radio home' }).focus();
  for (const control of await nav.locator('#main-menu a, #main-menu button').all()) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS('outline-style', 'solid');
    await expectHighlight(nav, control);
  }
  await page.keyboard.press('Tab');
  await expectHighlight(nav, nav.getByRole('link', { name: 'Apps', exact: true }));
  await expect(page).toHaveURL(/\/apps$/);
  await expect(nav.locator('.nav-radio')).toHaveText('Listen Live');
});

test('responsive changes discard hover and retain static nested-route highlighting on touch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/christmas-artist/60-chris-rea-driving-home-for-christmas');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const music = nav.getByRole('link', { name: 'Music', exact: true });
  await nav.locator('.nav-message').hover();
  await expectHighlight(nav, nav.locator('.nav-message'));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const open = nav.getByRole('button', { name: 'Open menu', exact: true });
    if (await open.isVisible()) await open.click();
    await expect(music).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('#main-menu')).not.toHaveAttribute('data-interacting', 'true');
    await nav.locator('.nav-radio').dispatchEvent('pointermove', { pointerType: 'touch', bubbles: true });
    await expect(nav.locator('#main-menu')).not.toHaveAttribute('data-interacting', 'true');
    expect(await music.evaluate(el => getComputedStyle(el, '::after').height)).toBe('2px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(nav.locator('#main-menu')).toBeHidden();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectHighlight(nav, music);
  // Enlarged browser text uses the same font-relative container breakpoint.
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await expect(nav.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible();
});

test('geometry follows resized layout and late font metrics without a new hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/apps');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const message = nav.locator('.nav-message');
  await message.hover();
  await expectHighlight(nav, message);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectHighlight(nav, message);
  // A font change can move a hovered control away from the stationary pointer.
  // Check the route fallback rather than artificially retaining that hover.
  await page.mouse.move(0, 200);
  const apps = nav.getByRole('link', { name: 'Apps', exact: true });
  await expectHighlight(nav, apps);
  await page.evaluate(() => {
    document.querySelector('#main-menu').style.fontFamily = 'monospace';
    document.fonts.dispatchEvent(new Event('loadingdone'));
  });
  await expectHighlight(nav, apps);
});
