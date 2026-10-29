import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({ context }) => {
  const hostname = new URL(test.info().project.use.baseURL).hostname;
  await context.route('**/*', route =>
    new URL(route.request().url()).hostname === hostname ? route.continue() : route.abort());
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('partnership banner preserves the approved copy and fits desktop and narrow screens', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const banner = page.locator('.partnership-strip');
  const heading = banner.getByRole('heading', { name: 'Your brand. Part of their Christmas.', exact: true });
  const button = banner.getByRole('link', { name: 'Explore Christmas sponsorship →', exact: true });
  await expect(button).toHaveAttribute('href', '/submit-a-song?mode=sponsorship');
  await expect(banner.getByText('CHRISTMAS PARTNERSHIP 2026', { exact: true })).toHaveCount(1);
  await expect(heading).toHaveCount(1);
  await expect(banner.getByText('Put your Christmas brand alongside Santa Radio, with two recorded sponsor mentions every hour, 24/7; a banner on every website page and your branding when our apps open—through 31 December.', { exact: true })).toHaveCount(1);
  await expect(banner.getByText('65,000 website active users in 2025 · Approx. 247,000 cumulative Apple app units across our streaming apps', { exact: true })).toHaveCount(1);
  await expect(banner).not.toContainText('£2,500');
  await expect(button).toHaveAttribute('href', '/submit-a-song?mode=sponsorship');

  for (const width of [1440, 1024, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await banner.evaluate(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const previous = element.previousElementSibling.getBoundingClientRect();
      const next = element.nextElementSibling.getBoundingClientRect();
      const texts = [...element.querySelectorAll('h2, p, a')].map(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].every(rect =>
          rect.left >= box.left - .5 && rect.right <= box.right + .5 &&
          rect.top >= box.top - .5 && rect.bottom <= box.bottom + .5);
      });
      return {
        width: box.width, adjacent: Math.abs(previous.bottom - box.top) < 1 && Math.abs(next.top - box.bottom) < 1,
        fits: texts.every(Boolean), topBorder: style.borderTopWidth, bottomBorder: style.borderBottomWidth,
        topColour: style.borderTopColor, bottomColour: style.borderBottomColor,
        backgroundColour: style.backgroundColor,
        copyColours: [...element.querySelectorAll('h2, p, a')].map(node => getComputedStyle(node).color),
        buttonColour: getComputedStyle(element.querySelector('a')).color,
        buttonBackground: getComputedStyle(element.querySelector('a')).backgroundColor,
        pattern: style.backgroundImage,
      };
    });
    expect(geometry.width).toBe(width);
    expect(geometry.adjacent).toBe(true);
    expect(geometry.fits).toBe(true);
    expect(geometry.topBorder).toBe('1px');
    expect(geometry.bottomBorder).toBe('1px');
    expect(geometry.topColour).toBe(geometry.bottomColour);
    expect(geometry.backgroundColour).toBe('rgb(7, 23, 16)');
    expect(geometry.copyColours).toEqual([
      'rgb(224, 200, 127)', 'rgb(255, 250, 240)',
      'rgb(246, 242, 232)', 'rgb(221, 201, 133)', 'rgb(255, 250, 240)',
    ]);
    expect(geometry.buttonColour).toBe('rgb(255, 250, 240)');
    expect(geometry.buttonBackground).toBe('rgb(16, 39, 27)');
    expect(geometry.pattern).toContain('data:image/svg+xml');
    expect(geometry.pattern).toContain('%23C6A85C');
    const titleBox = await heading.boundingBox();
    const buttonBox = await button.boundingBox();
    expect(buttonBox.height).toBeGreaterThanOrEqual(56);
    expect(buttonBox.width).toBeGreaterThanOrEqual(width <= 767 ? width - 40 : 246);
    expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (width >= 1024) expect(buttonBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
    if (width <= 767) expect(buttonBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 390) {
      await banner.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      mkdirSync('generated-artifacts/partnership-checks', { recursive: true });
      await page.screenshot({ path: `generated-artifacts/partnership-checks/${width}.png` });
    }
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionStyles = await button.evaluate(element => ({
    color: getComputedStyle(element).color,
    background: getComputedStyle(element).backgroundColor,
    transitionDuration: getComputedStyle(element).transitionDuration,
    pattern: getComputedStyle(element.closest('.partnership-strip')).backgroundImage,
  }));
  expect(reducedMotionStyles.color).toBe('rgb(255, 250, 240)');
  expect(reducedMotionStyles.background).toBe('rgb(16, 39, 27)');
  expect(reducedMotionStyles.transitionDuration).toBe('0s');
  expect(reducedMotionStyles.pattern).toContain('%23C6A85C');
});

test('keyboard activation opens the sponsorship enquiry mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const button = page.locator('.partnership-strip a');
  await button.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  // Establish keyboard modality before checking the visible focus indicator.
  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  expect(await button.evaluate(element => element.matches(':focus-visible') &&
    getComputedStyle(element).outlineStyle !== 'none')).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/submit-a-song\?mode=sponsorship$/);
  await expect(page.getByRole('heading', { name: 'Christmas sponsorship enquiry', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Christmas sponsorship', exact: true })).toBeChecked();
  await expect(page.locator('form input[name="EMAIL"]')).toBeVisible();
});
