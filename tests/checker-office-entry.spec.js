import { test, expect } from '@playwright/test';

const path = '/naughty-or-nice-list-checker';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, externalMedia: false, savedAt: Date.now(),
    }));
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Test silent fallback', 'NotAllowedError'));
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/names-data/*.json', route => route.fulfill({ json: ['Erin', 'Erica'] }));
});

async function assertEntryPosition(page) {
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector('.nn-office .nn-panel').getBoundingClientRect();
    const title = document.querySelector('.nn-office h1').getBoundingClientRect();
    const nav = document.querySelector('.navbar').getBoundingClientRect();
    const dock = document.querySelector('.radio-dock:not([hidden])')?.getBoundingClientRect();
    const top = nav.bottom + 16;
    const bottom = Math.max(top + 100, Math.min(innerHeight - 16, dock?.height ? dock.top - 16 : innerHeight - 16));
    const start = Math.min(panel.top, title.top);
    const end = Math.max(panel.bottom, title.bottom);
    const wanted = top + Math.max(0, (bottom - top - (end - start)) / 2);
    return Math.abs(start - wanted);
  })).toBeLessThan(2);
  await expect(page.locator('.nn-office h1')).toHaveAccessibleName('Naughty or Nice List Checker');
  const logo = page.locator('.nn-office-title-logo');
  await expect(logo).toHaveAttribute('src', '/images/naughty-or-nice-logo.webp');
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(image =>
    image.complete && image.naturalWidth === 1659 && image.getBoundingClientRect().width <= 205)).toBe(true);
  const bottomClearance = await page.evaluate(() => {
    const scene = document.querySelector('.nn-office .nn-scene').getBoundingClientRect();
    const panel = document.querySelector('.nn-office .nn-panel').getBoundingClientRect();
    return scene.bottom - panel.bottom;
  });
  expect(bottomClearance).toBeGreaterThanOrEqual(28);
  expect(bottomClearance).toBeLessThanOrEqual(61);
}

async function assertDirectQuickChecker(page) {
  const quickCheck = page.locator('#nice-list');
  await expect(quickCheck).toBeVisible();
  await expect(quickCheck.getByRole('heading', { name: 'Head Elf’s Naughty or Nice List Checker' })).toBeVisible();
  await expect(quickCheck.getByRole('heading', { name: 'Quick Nice List Check' })).toBeVisible();
  await expect(quickCheck.getByRole('combobox', { name: 'Confirm first name' })).toBeVisible();
  await expect(quickCheck.getByRole('button', { name: 'Check', exact: true })).toBeVisible();
  await expect(page.locator('.nn-office')).toHaveCount(0);
}

test('a direct desktop URL opens the simple homepage checker, including after reload', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await assertDirectQuickChecker(page);
  const layout = await page.evaluate(() => {
    const section = document.querySelector('#nice-list').getBoundingClientRect();
    const button = document.querySelector('#nice-list button[type="submit"]').getBoundingClientRect();
    return { sectionLeft: section.left, sectionRight: section.right, buttonLeft: button.left,
      buttonRight: button.right, viewport: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(layout.sectionLeft).toBeGreaterThanOrEqual(0);
  expect(layout.sectionRight).toBeLessThanOrEqual(layout.viewport);
  expect(layout.buttonLeft).toBeGreaterThanOrEqual(0);
  expect(layout.buttonRight).toBeLessThanOrEqual(layout.viewport);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('direct-quick-check-desktop.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertDirectQuickChecker(page);
});

test('direct phone URL keeps the simple checker usable without opening the keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await assertDirectQuickChecker(page);
  await expect(page.locator('#nice-list').getByRole('combobox')).not.toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('direct-quick-check-phone.png') });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await assertDirectQuickChecker(page);
  const geometry = await page.evaluate(() => {
    const section = document.querySelector('#nice-list').getBoundingClientRect();
    const button = document.querySelector('#nice-list button[type="submit"]').getBoundingClientRect();
    return { sectionLeft: section.left, sectionRight: section.right, buttonLeft: button.left,
      buttonRight: button.right, viewport: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.sectionLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.sectionRight).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.buttonLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.buttonRight).toBeLessThanOrEqual(geometry.viewport);
});

test('homepage handoff opens in the same place and entry settling stops on visitor scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const widget = page.locator('#nice-list');
  await widget.getByRole('combobox').fill('Erin');
  await widget.getByRole('button', { name: 'Lets check', exact: true }).click();
  await widget.getByRole('link', { name: 'Lets check with Head Elf' }).click({ timeout: 15000 });
  await assertEntryPosition(page);
  await expect(page.getByRole('combobox')).toHaveValue('Erin');
  await page.mouse.wheel(0, -300);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
