import { test, expect } from '@playwright/test';
import fs from 'node:fs';

function snowSwitch(page) {
  return page.getByRole('switch', { name: 'Snow', exact: true });
}

async function expectSnowState(page, on) {
  const toggle = snowSwitch(page);
  await expect(toggle).toHaveAccessibleName('Snow');
  await expect(toggle).toBeChecked({ checked: on });
  await expect(toggle).toHaveText(on ? /Snow\s*On/ : /Snow\s*Off/);
  await expect(toggle).not.toHaveAttribute('aria-pressed');
}

async function expectFallingSnow(page) {
  const snow = page.locator('.site-snow');
  await expect(snow).toBeVisible();
  const flake = snow.locator('i').nth(4);
  await expect(flake).toHaveCSS('animation-name', 'site-snowfall');
  // Check actual movement, not just a label or an animation declaration.
  const before = await flake.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => flake.evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
}

test('Chrome snow turns off/on, moves and persists through reload/navigation', async ({ page }) => {
  await page.goto('/');
  const toggle = snowSwitch(page);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('.effects-toggle')).toHaveCount(0);
  await expect(page.getByRole('contentinfo').locator('.effects-toggle')).toHaveCount(1);
  await expectSnowState(page, true);
  await expectFallingSnow(page);
  await toggle.click();
  await expectSnowState(page, false);
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await page.reload();
  await expectSnowState(page, false);
  await toggle.click();
  await expectSnowState(page, true);
  await expectFallingSnow(page);
  await page.reload();
  await expectFallingSnow(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Apps', exact: true }).click();
  await expectSnowState(page, true);
  await expectFallingSnow(page);
});

test('reduced-motion default is off but explicit Snow On animates only snow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Legacy "on" was automatically saved; it must not override accessibility.
  await page.addInitScript(() => {
    if (!localStorage.getItem('santa-snow-preference')) localStorage.setItem('santa-effects', 'on');
  });
  await page.goto('/');
  const toggle = snowSwitch(page);
  await expectSnowState(page, false);
  await expect(toggle.locator('.effects-toggle-thumb')).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await toggle.click();
  await expectSnowState(page, true);
  await expectFallingSnow(page);
  await expect(page.locator('.hero-aurora')).toBeHidden();
  await expect(page.locator('.hero-aurora')).toHaveCSS('animation-name', 'none');
  await page.reload();
  await expectFallingSnow(page);
  await toggle.click();
  await page.reload();
  await expectSnowState(page, false);
  await expect(page.locator('.site-snow')).toHaveCount(0);
});

test('automatic snow follows device motion changes until a visitor chooses', async ({ page }) => {
  await page.goto('/');
  await expectFallingSnow(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectSnowState(page, false);
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectFallingSnow(page);
  await snowSwitch(page).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.site-snow')).toHaveCount(0);
});

test('legacy saved Snow Off remains off', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('santa-effects', 'off'));
  await page.goto('/');
  await expectSnowState(page, false);
  await expect(page.locator('.site-snow')).toHaveCount(0);
  await snowSwitch(page).click();
  await expectFallingSnow(page);
});

test('snow switch works even when browser storage is blocked', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage blocked', 'SecurityError'); },
    });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expectSnowState(page, false);
  await snowSwitch(page).click();
  await expectSnowState(page, true);
  await expectFallingSnow(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Apps', exact: true }).click();
  await expectSnowState(page, true);
  await snowSwitch(page).click();
  await expectSnowState(page, false);
  await expect(page.locator('.site-snow')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile touch snow switch works with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto(`${test.info().project.use.baseURL}/`);
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).tap();
    await expectSnowState(page, false);
    await snowSwitch(page).tap();
    await expectSnowState(page, true);
    await expectFallingSnow(page);
    await snowSwitch(page).tap();
    await expectSnowState(page, false);
    await expect(page.locator('.site-snow')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

for (const width of [1280, 390]) {
  test(`footer snow control supports keyboard and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/apps');
    const toggle = page.getByRole('contentinfo').getByRole('switch', { name: 'Snow', exact: true });
    await expectSnowState(page, true);
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    await toggle.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await toggle.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(toggle).toBeFocused();
    expect(await toggle.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    const box = await toggle.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const thumb = toggle.locator('.effects-toggle-thumb');
    await expect(thumb).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 15, 0)');
    fs.mkdirSync('generated-artifacts', { recursive: true });
    await page.screenshot({ path: `generated-artifacts/snow-footer-${width}-on.jpg` });
    await page.keyboard.press('Enter');
    await expectSnowState(page, false);
    await expect(page.locator('.site-snow')).toHaveCount(0);
    await expect(thumb).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await page.screenshot({ path: `generated-artifacts/snow-footer-${width}-off.jpg` });
    await page.keyboard.press('Space');
    await expectSnowState(page, true);
    await expectFallingSnow(page);
  });
}

test('phone footer switch remains reachable above compact and expanded radio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const toggle = snowSwitch(page);
  const dock = page.locator('.radio-dock');
  for (const expanded of [false, true]) {
    if (expanded) await dock.getByRole('button', { name: 'Expand radio player' }).click();
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect.poll(async () => {
      const controlBox = await toggle.boundingBox();
      const dockBox = await dock.boundingBox();
      return controlBox.y >= 0 && controlBox.y + controlBox.height <= dockBox.y;
    }).toBe(true);
    await toggle.click();
    await expectSnowState(page, expanded);
  }
});
