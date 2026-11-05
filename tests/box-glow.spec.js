import { test, expect } from '@playwright/test';
import { expectHaloClearance, captureHalo } from './helpers/panel-halo.js';

const surfaces = [
  ['/', ['.radio-dock', '.santa-message-box', '.tv-frame', '.mug-card']],
  ['/christmas-music', ['.song-card']],
  ['/mugshots/all', ['.mugshot-card']],
  ['/links', ['.partner-card']],
  ['/privacy-policy', ['.privacy-content']],
  ['/santa-tracker', ['.tracker-card', '.tracker-story-card']],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
  });
});

for (const [path, selectors] of surfaces) {
  test(`boxed panels glow on hover without resizing on ${path}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    for (const selector of selectors) {
      const surface = page.locator(selector).first();
      await expect(surface).toBeVisible();
      await page.mouse.move(0, 0);
      const before = await surface.boundingBox();
      const restingShadow = await surface.evaluate(el => getComputedStyle(el).boxShadow);
      await surface.hover();
      await expect(surface).toHaveCSS('border-top-color', 'rgb(230, 206, 134)');
      await expect.poll(() => surface.evaluate(el => getComputedStyle(el).boxShadow)).toContain('16px 3px');
      const after = await surface.boundingBox();
      expect(after.width).toBeCloseTo(before.width, 1);
      expect(after.height).toBeCloseTo(before.height, 1);
      if (path === '/apps') await surface.screenshot({ path: '/tmp/app-box-gold-glow.png' });
      await page.mouse.move(0, 0);
      await expect(surface).toHaveCSS('box-shadow', restingShadow);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(surface).toHaveCSS('transition-duration', '0s');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
  });
}

const studioSelector = '#santa-studio-promotion';
const redEdge = 'rgb(200, 91, 80)';
const redShadow = 'rgba(200, 91, 80, 0.25) 0px 0px 0px 1px, rgba(200, 91, 80, 0.47) 0px 0px 16px 3px, rgba(6, 28, 23, 0.125) 0px 10px 28px 0px';

test('whole Studio panel gains a red halo without moving, clipping or changing its contents', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  // Exercise the real control without creating a checkout or contacting Stripe.
  await page.route('**/api/santa-studio-checkout', route => route.fulfill(
    route.request().method() === 'GET'
      ? { json: { available: true, sandbox: true } }
      : { status: 503, json: { error: 'Checkout test: no purchase created.' } },
  ));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const studio = page.locator(studioSelector);
  await studio.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(studio).toHaveCSS('border-top-color', 'rgba(212, 175, 55, 0.44)');
  await expect(studio).toHaveCSS('transition-duration', '0.18s, 0.18s');
  await expect(studio).toHaveCSS('cursor', 'auto');
  expect(await studio.getAttribute('tabindex')).toBeNull();
  expect(await studio.getAttribute('role')).toBeNull();
  const before = await studio.boundingBox();
  const restingShadow = await studio.evaluate(el => getComputedStyle(el).boxShadow);
  const restingBackground = await studio.evaluate(el => getComputedStyle(el).background);
  const contents = await studio.locator('.santa-studio-promotion__details').textContent();

  // Both empty panel padding and nested gift content trigger the whole surface.
  for (const position of [{ x: 8, y: 8 }, { x: before.width - 8, y: before.height - 8 }]) {
    await studio.hover({ position });
    await expect(studio).toHaveCSS('border-top-color', redEdge);
    await expect(studio).toHaveCSS('box-shadow', redShadow);
    expect(await studio.boundingBox()).toEqual(before);
  }
  const gift = studio.locator('.studio-gifts__thumbnail').first();
  await gift.hover();
  await expect(studio).toHaveCSS('box-shadow', redShadow);
  expect(await studio.boundingBox()).toEqual(before);
  // Animated gift lettering updates its own inline styles independently of hover.
  expect(await studio.locator('.santa-studio-promotion__details').textContent()).toBe(contents);
  expect(await studio.evaluate(el => getComputedStyle(el).background)).toBe(restingBackground);

  // The panel's own overflow hides its contents, not its outer shadow.
  // Check every ancestor that could actually crop the 19px halo.
  expect(await studio.evaluate(el => {
    const box = el.getBoundingClientRect();
    const clipped = [];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if ((/(hidden|clip|scroll|auto)/.test(style.overflowX) &&
          (box.left - 19 < bounds.left || box.right + 19 > bounds.right)) ||
          (/(hidden|clip|scroll|auto)/.test(style.overflowY) &&
          (box.top - 19 < bounds.top || box.bottom + 19 > bounds.bottom))) {
        clipped.push(parent.tagName + '.' + parent.className);
      }
    }
    return clipped;
  })).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('studio-red-halo.png') });
  await page.mouse.move(0, 0);
  await expect(studio).toHaveCSS('box-shadow', restingShadow);
  await expect(studio).toHaveCSS('border-top-color', 'rgba(212, 175, 55, 0.44)');
  await gift.click();
  const preview = page.getByRole('dialog').filter({ visible: true });
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  await expect(preview).toHaveCount(0);
  await studio.locator('.santa-studio-promotion__purchase').click();
  await expect(studio.getByRole('alert')).toHaveText('Checkout test: no purchase created.');
});

test('Studio red hover is immediate with reduced motion and restores on exit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const studio = page.locator(studioSelector);
  const restingShadow = await studio.evaluate(el => getComputedStyle(el).boxShadow);
  await studio.hover({ position: { x: 8, y: 8 } });
  await expect(studio).toHaveCSS('transition-duration', '0s');
  await expect(studio).toHaveCSS('box-shadow', redShadow);
  await page.mouse.move(0, 0);
  await expect(studio).toHaveCSS('box-shadow', restingShadow);
});

for (const width of [320, 390, 768, 1091, 1440]) {
  test(`Studio halo and unchanged free-panel reference fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width < 768 ? 2800 : 1200 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const reference = page.locator('.santa-message-box').first();
    await reference.hover({ position: { x: 8, y: 8 } });
    await expect(reference).toHaveCSS('box-shadow',
      'rgba(230, 206, 134, 0.19) 0px 0px 0px 1px, rgba(230, 206, 134, 0.27) 0px 0px 16px 3px');
    await captureHalo(page, reference, `free-reference-${width}.png`, testInfo);
    const studio = page.locator(studioSelector);
    await studio.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const before = await studio.boundingBox();
    const restingShadow = await studio.evaluate(el => getComputedStyle(el).boxShadow);
    await studio.hover({ position: { x: 8, y: 8 } });
    await expect(studio).toHaveCSS('box-shadow', redShadow);
    expect(await studio.boundingBox()).toEqual(before);
    await expectHaloClearance(studio);
    await captureHalo(page, studio, `studio-brighter-${width}.png`, testInfo);
    await page.mouse.move(0, 0);
    await expect(studio).toHaveCSS('box-shadow', restingShadow);
    const gift = studio.locator('.studio-gifts__thumbnail').first();
    await gift.click();
    const preview = page.getByRole('dialog').filter({ visible: true });
    await expect(preview).toBeVisible();
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
    await gift.focus();
    await page.keyboard.press('Tab');
    const focused = studio.locator(':focus-visible');
    await expect(focused).toHaveCount(1);
    await expect(focused).not.toHaveCSS('outline-style', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('touch-only Studio panel never gains a sticky red halo', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: Boolean(process.env.REPLIT_DEV_DOMAIN),
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      sessionStorage.setItem('santa-message-offer-shown', 'shown');
      localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
        version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
      }));
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
    const studio = page.locator(studioSelector);
    const restingShadow = await studio.evaluate(el => getComputedStyle(el).boxShadow);
    await studio.tap({ position: { x: 8, y: 8 } });
    await expect(studio).toHaveCSS('box-shadow', restingShadow);
    await expect(studio).toHaveCSS('border-top-color', 'rgba(212, 175, 55, 0.44)');
  } finally {
    await context.close();
  }
});

test('interactive song cards keep keyboard focus and gain the gold glow', async ({ page }) => {
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.song-card').first();
  await card.focus();
  await expect(card).toBeFocused();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).boxShadow)).toContain('16px 3px');
});

test('unboxed app feature descriptions stay passive on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(`${test.info().project.use.baseURL}/apps`, { waitUntil: 'domcontentloaded' });
    const feature = page.locator('.feature-item').first();
    await expect(feature).toBeVisible();
    await feature.tap();
    await expect(feature).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(feature).toHaveCSS('border-top-style', 'none');
    await expect(feature).toHaveCSS('box-shadow', 'none');
    expect(await feature.getAttribute('tabindex')).toBeNull();
    expect(await feature.getAttribute('role')).toBeNull();
    await expect(feature).not.toHaveCSS('cursor', 'pointer');
  } finally {
    await context.close();
  }
});
