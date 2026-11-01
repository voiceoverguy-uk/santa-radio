import { test, expect } from './fixtures/apps-test.js';
import { mkdirSync } from 'node:fs';

const labels = ['Radio', 'Tracker', 'MugShots', 'Artists', 'Games', 'Welcome'];
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const origin = new URL(test.info().project.use.baseURL).origin;
    return new URL(route.request().url()).origin === origin ? route.continue() : route.abort();
  });
});
async function open(page, reduced = true) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto('/apps');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const preview = page.locator('#santaradio .app-screenshots');
  await expect.poll(() => preview.locator('img').evaluateAll(images =>
    images.every(img => img.complete && img.naturalWidth === 603))).toBe(true);
  return preview;
}
async function screen(preview, label) {
  await expect(preview.locator('.app-screenshot-slide.is-active')).toHaveCount(1);
  await expect(preview.locator('.app-screenshot-slide').nth(labels.indexOf(label))).toHaveClass(/is-active/);
  await expect(preview.getByRole('button', { name: `Select ${label} screen preview`, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test('real screenshot tab hotspots select each screen; Welcome continues back to Radio', async ({ page }) => {
  const preview = await open(page);
  for (const label of ['Tracker', 'MugShots', 'Artists', 'Games', 'Radio']) {
    await preview.getByRole('button', { name: `Preview ${label} screen`, exact: true }).click();
    await screen(preview, label);
  }
  await preview.getByRole('button', { name: 'Select Welcome screen preview', exact: true }).click();
  await screen(preview, 'Welcome');
  await expect(preview.locator('.santa-radio-screen-hotspots')).toHaveCount(0);
  await preview.getByRole('button', { name: 'Continue to Santa Radio preview', exact: true }).click();
  await screen(preview, 'Radio');
  // Extra controls are scoped to this app only.
  await expect(page.locator('.app-section:not(#santaradio) .santa-radio-preview-controls')).toHaveCount(0);
});

test('keyboard selection holds the chosen screen until explicit resume, with visible focus', async ({ page }) => {
  const preview = await open(page, false);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const button = preview.getByRole('button', { name: 'Preview Games screen', exact: true });
  await button.focus();
  await page.keyboard.press('Space');
  await screen(preview, 'Games');
  expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.fastForward(15000);
  await screen(preview, 'Games');
  await preview.getByRole('button', { name: 'Resume automatic screen previews' }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.fastForward(5000);
  await screen(preview, 'Welcome');
});

test('hotspots stay aligned, contained and usable on desktop and narrow mobile', async ({ page }) => {
  const preview = await open(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await preview.scrollIntoViewIfNeeded();
    const geometry = await preview.evaluate(el => {
      const stack = el.querySelector('.app-screenshots-stack').getBoundingClientRect();
      const tabs = [...el.querySelectorAll('.santa-radio-hotspot')].map(node => node.getBoundingClientRect().toJSON());
      return { stack: stack.toJSON(), tabs };
    });
    expect(geometry.tabs).toHaveLength(5);
    for (const [index, tab] of geometry.tabs.entries()) {
      expect(tab.left).toBeCloseTo(geometry.stack.left + geometry.stack.width * index / 5, 0);
      expect(tab.top).toBeGreaterThan(geometry.stack.top + geometry.stack.height * .88);
      expect(tab.bottom).toBeLessThanOrEqual(geometry.stack.bottom + 1);
      expect(tab.width).toBeGreaterThanOrEqual(44);
      expect(tab.height).toBeGreaterThanOrEqual(44);
    }
    await preview.getByRole('button', { name: 'Preview Games screen', exact: true }).click();
    await screen(preview, 'Games');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await preview.getByRole('button', { name: 'Preview Radio screen', exact: true }).click();
    if ([1440, 390].includes(width)) {
      mkdirSync('generated-artifacts/apps-radio-preview', { recursive: true });
      await page.screenshot({ path: `generated-artifacts/apps-radio-preview/${width}.jpg` });
    }
  }
});

test('manual selection keeps the current image while a target is pending and recovers through PNG', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/santa-radio-ios-games*.webp*', route =>
    route.request().resourceType() === 'image' ? route.abort() : route.continue());
  await page.route('**/santa-radio-ios-games*.png*', async route => {
    if (route.request().resourceType() === 'image') await held;
    await route.continue();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const preview = page.locator('#santaradio .app-screenshots');
  await expect.poll(() => preview.locator('img').first().evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await preview.getByRole('button', { name: 'Select Games screen preview', exact: true }).click();
  await expect(preview.getByRole('button', { name: 'Select Games screen preview', exact: true })).toHaveAttribute('aria-busy', 'true');
  await expect(preview.locator('.santa-radio-preview-status')).toContainText('Loading Games preview');
  await screen(preview, 'Radio');
  release();
  await screen(preview, 'Games');
  await expect(preview.locator('.app-screenshot-slide.is-active')).toHaveAttribute('src', /games.*\.png/);
});
