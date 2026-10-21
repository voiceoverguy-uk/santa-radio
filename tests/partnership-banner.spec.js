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
  const heading = banner.getByRole('heading', { name: 'Your Christmas magic. Our festive soundtrack.', exact: true });
  const button = banner.getByRole('link', { name: /Let’s talk Christmas/ });
  await expect(banner.getByText('A LITTLE CHRISTMAS PARTNERSHIP', { exact: true })).toHaveCount(1);
  await expect(heading).toHaveCount(1);
  await expect(banner.getByText('Got a Christmas market, festive event or unique Christmas product? Join Santa Radio with website and app banners, plus an on-air credit every hour.', { exact: true })).toHaveCount(1);
  await expect(banner.getByText('Heard across web, apps, CarPlay, Apple TV and the Mac app.', { exact: true })).toHaveCount(1);
  await expect(button).toHaveAttribute('href', '/submit-a-song');

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
      };
    });
    expect(geometry.width).toBe(width);
    expect(geometry.adjacent).toBe(true);
    expect(geometry.fits).toBe(true);
    expect(geometry.topBorder).toBe('1px');
    expect(geometry.bottomBorder).toBe('1px');
    expect(geometry.topColour).toBe(geometry.bottomColour);
    const titleBox = await heading.boundingBox();
    const buttonBox = await button.boundingBox();
    if (width >= 1024) expect(buttonBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
    if (width <= 767) expect(buttonBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 390) {
      await banner.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      mkdirSync('generated-artifacts/partnership-checks', { recursive: true });
      await page.screenshot({ path: `generated-artifacts/partnership-checks/${width}.png` });
    }
  }
});

test('keyboard activation opens the existing general contact form', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/submit-a-song$/);
  await expect(page.getByRole('heading', { name: 'Get in touch with Santa Radio', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'General enquiry', exact: true })).toBeChecked();
  await expect(page.locator('form input[name="EMAIL"]')).toBeVisible();
});
