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

async function assertHomepageDestination(page) {
  await expect(page).toHaveURL(/\/#nice-list$/);
  const checker = page.locator('#nice-list');
  await expect(checker).toBeFocused();
  const offset = async () => {
    const box = await page.locator('.nn-quiz-intro').boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    return box.y - nav.y - nav.height;
  };
  await expect.poll(offset).toBeGreaterThanOrEqual(15);
  await expect.poll(offset).toBeLessThan(18);
  await expect(checker.getByRole('heading', { name: 'Quick Nice List Check', exact: true })).toBeAttached();
}

async function assertDestination(page) {
  await expect(page).toHaveURL(/\/naughty-or-nice-list-checker\/?$/);
  const checker = page.locator('#nice-list');
  await expect(checker.getByRole('heading', { name: 'Head Elf’s Naughty or Nice List Checker', exact: true })).toBeVisible();
  await expect(checker.getByRole('combobox', { name: 'Confirm first name' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const link = nav.getByRole('link', { name: 'Nice List?', exact: true, includeHidden: true });
  await expect(link).toHaveAttribute('href', '/naughty-or-nice-list-checker');
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(link).toHaveClass('active');
  await expect(nav.getByRole('link', { name: 'Home', exact: true, includeHidden: true })).not.toHaveAttribute('aria-current');
  await expect(page.locator('.nn-office')).toHaveCount(0);
}

async function assertMobileDestination(page) {
  const topClearance = () => page.evaluate(() => {
    const frame = document.querySelector('.nn-widget-frame').getBoundingClientRect();
    const nav = document.querySelector('.navbar').getBoundingClientRect();
    return frame.top - nav.bottom;
  });
  const playerClearance = () => page.evaluate(() => {
    const frame = document.querySelector('.nn-widget-frame').getBoundingClientRect();
    const player = document.querySelector('.radio-dock:not([hidden])')?.getBoundingClientRect();
    return (player?.height ? player.top : innerHeight) - frame.bottom;
  });
  await expect.poll(topClearance).toBeGreaterThanOrEqual(15);
  await expect.poll(topClearance).toBeLessThan(18);
  await expect.poll(playerClearance).toBeGreaterThanOrEqual(15);
  await expect(page.locator('.nn-widget-frame').getByRole('heading', { name: 'Quick Nice List Check' })).toBeVisible();
  await expect(page.locator('.nn-widget-frame').getByRole('combobox')).toBeVisible();
}

test('Nice List? opens the standalone checker by keyboard and stays current on repeat visits', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('navigation').getByRole('link', { name: 'Nice List?', exact: true });
  await expect(link).toHaveAttribute('href', '/naughty-or-nice-list-checker');
  await expect(link).not.toHaveAttribute('aria-current');
  await link.focus();
  await page.keyboard.press('Enter');
  await assertDestination(page);
  const input = page.locator('#nice-list').getByRole('combobox');
  await input.fill('Erin');
  await link.click();
  await assertDestination(page);
  await expect(input).toHaveValue('Erin');
});

test('homepage direct fragment loads still place the form between fixed controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#nice-list', { waitUntil: 'domcontentloaded' });
  await assertMobileDestination(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertMobileDestination(page);

});

test('mobile Nice List navigation from another page closes the menu and opens the standalone checker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: 'Open menu' }).click();
  await page.keyboard.press('Escape');
  await expect(nav.locator('.navbar-links')).toBeHidden();
  await nav.getByRole('button', { name: 'Open menu' }).click();
  await nav.getByRole('link', { name: 'Nice List?', exact: true }).click();
  await assertDestination(page);
  await expect(nav.locator('.navbar-links')).toBeHidden();
  await expect(nav.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await nav.getByRole('button', { name: 'Open menu' }).click();
  await expect(nav.getByRole('link', { name: 'Nice List?', exact: true })).toBeVisible();
  await nav.getByRole('link', { name: 'Nice List?', exact: true }).click();
  await expect(nav.locator('.navbar-links')).toBeHidden();
});

test('mobile fragment settling stops when visitors scroll or interact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#nice-list', { waitUntil: 'domcontentloaded' });
  await assertMobileDestination(page);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.locator('.nn-widget-frame').evaluate(element => element.getBoundingClientRect().top))
    .toBeLessThan(0);
  await page.evaluate(() => {
    const section = document.querySelector('#nice-list');
    const previous = section.previousElementSibling;
    previous.style.minHeight = `${previous.getBoundingClientRect().height + 180}px`;
    document.fonts.dispatchEvent(new Event('loadingdone'));
  });
  await page.waitForTimeout(250);
  await expect(page.locator('.nn-widget-frame')).toBeAttached();
  await expect.poll(() => page.locator('.nn-widget-frame').evaluate(element => element.getBoundingClientRect().top))
    .toBeLessThan(0);
});

test('direct checker links and reloads identify Nice List? as the current page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  for (const path of ['/naughty-or-nice-list-checker', '/naughty-or-nice-list-checker/']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await assertDestination(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertDestination(page);
  }
});

test('Nice List? opens the checker from another page and browser history restores the active destination', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const link = nav.getByRole('link', { name: 'Nice List?', exact: true });
  await link.click();
  await assertDestination(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(nav.getByRole('link', { name: 'Apps', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(link).not.toHaveAttribute('aria-current');
  await page.goForward();
  await assertDestination(page);
});

test('cross-page landing stays aligned after late layout changes but lets visitors scroll away', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#nice-list', { waitUntil: 'domcontentloaded' });
  await assertHomepageDestination(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Nice List?', exact: true })).not.toHaveAttribute('aria-current');
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const previous = document.querySelector('#nice-list').previousElementSibling;
    previous.style.minHeight = `${previous.getBoundingClientRect().height + 240}px`;
  });
  await assertHomepageDestination(page);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.locator('#nice-list').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(0);
  await page.evaluate(() => {
    const previous = document.querySelector('#nice-list').previousElementSibling;
    previous.style.minHeight = `${previous.getBoundingClientRect().height + 120}px`;
  });
  await page.waitForTimeout(250);
  expect(await page.locator('#nice-list').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(0);
});

test('Nice List? fits desktop navigation and closes the phone menu when opening the checker', async ({ page }, testInfo) => {
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
    await assertDestination(page);
    if (collapsed) await expect(links).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
