import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, externalMedia: false, savedAt: Date.now(),
    }));
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
});

async function assertDestination(page) {
  await expect(page).toHaveURL(/\/#nice-list$/);
  const checker = page.locator('#nice-list');
  await expect(checker).toBeFocused();
  const offset = async () => {
    const box = await checker.boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    return box.y - nav.y - nav.height;
  };
  await expect.poll(offset).toBeGreaterThanOrEqual(0);
  await expect.poll(offset).toBeLessThan(100);
  await expect(checker.getByRole('heading', { name: 'Quick Nice List Check', exact: true })).toBeAttached();
}

test('Nice List? scrolls to the homepage checker and works again without losing the entered name', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('navigation').getByRole('link', { name: 'Nice List?', exact: true });
  await expect(link).toHaveAttribute('href', '/#nice-list');
  await link.focus();
  await page.keyboard.press('Enter');
  await assertDestination(page);
  await expect(link).toHaveAttribute('aria-current', 'location');
  const input = page.locator('#nice-list').getByRole('combobox');
  await input.fill('Erin');
  await page.evaluate(() => window.scrollTo(0, 0));
  await link.click();
  await assertDestination(page);
  await expect(input).toHaveValue('Erin');
});

test('Nice List? returns from the Head Elf page to the homepage checker, and direct links work', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/naughty-or-nice-list-checker', { waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation').getByRole('link', { name: 'Nice List?', exact: true }).click();
  await assertDestination(page);
  await expect(page.locator('.nn-office')).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertDestination(page);
});

test('Nice List? fits desktop navigation and closes the phone menu before scrolling', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [width, size] of [[1440, ''], [1280, ''], [1201, ''], [390, ''], [320, ''], [1280, '200%']]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(value => { document.documentElement.style.fontSize = value; }, size);
    await page.evaluate(() => window.scrollTo(0, 0));
    const menu = nav.getByRole('button', { name: 'Open menu' });
    const collapsed = await menu.isVisible();
    if (collapsed) await menu.click();
    const links = nav.locator('.navbar-links');
    const link = links.getByRole('link', { name: 'Nice List?', exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    if (!collapsed) {
      const logo = await nav.locator('.navbar-logo').boundingBox();
      const items = await links.locator('li').all();
      let previous = logo.x + logo.width;
      for (const item of items) {
        const rect = await item.boundingBox();
        expect(rect.x).toBeGreaterThanOrEqual(previous);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        previous = rect.x + rect.width;
      }
    }
    await nav.screenshot({ path: testInfo.outputPath(`nice-list-nav-${width}-${size || 'normal'}.png`), animations: 'disabled' });
    await link.click();
    await expect(page.locator('#nice-list')).toBeFocused();
    if (collapsed) await expect(links).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
