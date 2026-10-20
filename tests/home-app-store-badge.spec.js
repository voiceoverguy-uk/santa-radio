import { test, expect } from '@playwright/test';

const destination = 'https://apps.apple.com/gb/app/santa-radio/id1021183593';

test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === new URL(test.info().project.use.baseURL).hostname
      ? route.continue() : route.abort();
  });
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
});

test('official badge links safely to Santa Radio and supports keyboard activation', async ({ page }) => {
  const badge = page.locator('.hero a').filter({ has: page.locator('img[src="/images/download-on-the-app-store.svg"]') });
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveAttribute('href', destination);
  await expect(badge).toHaveAttribute('target', '_blank');
  await expect(badge).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(badge).toHaveAccessibleName(/Santa Radio.*App Store/i);
  const image = badge.locator('img');
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  const asset = await page.request.get('/images/download-on-the-app-store.svg');
  expect(asset.ok()).toBe(true);
  expect(await asset.text()).toContain('Download_on_the_App_Store_Badge_US-UK');
  await badge.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(badge).toBeFocused();
  const outline = await badge.evaluate(el => {
    const style = getComputedStyle(el);
    return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.style).not.toBe('none');
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.close();
  await expect(page.locator('.soundboard-link')).toHaveAttribute('href', destination);
  await expect(page.locator('.hero-actions').getByRole('link', { name: 'FREE Santa Message', exact: true })).toHaveAttribute('href', '/free-santa-message');
  await expect(page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
});

test('badge fits below the actions and above the countdown on phones and desktops', async ({ page }) => {
  const badge = page.locator('.hero img[src="/images/download-on-the-app-store.svg"]');
  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await badge.boundingBox();
    const actions = await page.locator('.hero-actions').boundingBox();
    const countdown = await page.locator('.hero-countdown').boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(40);
    expect(bounds.width / bounds.height).toBeCloseTo(119.66407 / 40, 2);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y - (actions.y + actions.height)).toBeGreaterThanOrEqual(bounds.height / 4);
    expect(countdown.y - (bounds.y + bounds.height)).toBeGreaterThanOrEqual(bounds.height / 4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
