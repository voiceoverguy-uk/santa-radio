import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

test.beforeEach(async ({ page }) => { await unlockWorkshop(page); });
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const fixture = structuredClone(workshopCatalogueFixture);
fixture.categories.activity = Array.from({ length: 70 }, (_, index) => ({
  id: `activity-${index}`,
  file: `Trying Hard at/fixture-${index}.wav`,
  label: index % 3 ? `Activity ${index + 1}` : `A longer activity ${index + 1}, with a few more words to check wrapping`,
}));
fixture.counts.activity = 70;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Keep page-level stage scrolling still while targeting a touch gesture.
  // This does not disable the wheel's native touch scrolling/inertia.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: fixture }));
  await page.route('**/api/santa-names?inventory=hosted', route => route.fulfill({ json: {
    records: [{ id: 'demrie', name: 'Demrie' }], hostedCount: 1, warning: null,
  } }));
  await page.addInitScript(() => {
    window.__wheelTrace = { active: false, scrollWrites: 0, rowRectReads: 0 };
    const scroll = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (...args) {
      if (window.__wheelTrace.active && this.matches('.smw-age-wheel-scroll,.smw-choice-wheel-scroll')) {
        window.__wheelTrace.scrollWrites++;
      }
      return scroll.apply(this, args);
    };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (...args) {
      if (window.__wheelTrace.active && this.matches('.smw-age-wheel-option,.smw-choice-wheel-option')) {
        window.__wheelTrace.rowRectReads++;
      }
      return rect.apply(this, args);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this.src.includes('/audio/workshop/') ? Promise.resolve() : play.call(this);
    };
  });
});

async function openAge(page) {
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  await page.getByRole('combobox', { name: 'Search recorded names' }).fill('Dem');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('listbox', { name: 'Their age', exact: true })).toBeVisible();
}
async function frames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const category of ['age', 'activity']) {
  test(`${category}: native movement never gets recentered mid-gesture or on its own settled selection`, async ({ page }) => {
    await openAge(page);
    if (category === 'activity') {
      await page.getByRole('listbox').press('End');
      await page.locator('.smw-button-next').click();
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    }
    const wheel = page.getByRole('listbox');
    await frames(page);
    const rules = await wheel.evaluate(node => ({
      snap: getComputedStyle(node).scrollSnapType,
      stop: getComputedStyle(node.querySelector('[role=option]')).scrollSnapStop,
    }));
    // Proximity is the default strictness and Chromium serializes it as "y".
    expect(['y', 'y proximity']).toContain(rules.snap);
    expect(rules.stop).toBe('normal');
    await page.evaluate(() => { window.__wheelTrace.active = true; });
    await wheel.dispatchEvent('touchstart');
    for (let step = 1; step <= 6; step++) {
      await wheel.evaluate((node, step) => { node.scrollTop = 70 * step; }, step);
      await frames(page);
    }
    // Intentionally pause beyond the idle fallback while the finger is held.
    // Neither a timeout nor ResizeObserver may select/recenter under it.
    await page.waitForTimeout(300);
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(0);
    await wheel.dispatchEvent('touchend');
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(1);
    await frames(page);
    const trace = await page.evaluate(() => window.__wheelTrace);
    expect(trace.scrollWrites).toBe(0);
    expect(trace.rowRectReads).toBe(0);
    await page.evaluate(() => { window.__wheelTrace.active = false; });
    const chosen = await wheel.locator('[aria-selected=true]').textContent();
    await page.locator('.smw-button-next').click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('listbox').locator('[aria-selected=true]')).toContainText(chosen.trim());
  });
}

test('all mobile choice wheels use compact heights and closer, tappable options', async ({ page }) => {
  await openAge(page);
  for (let step = 0; step < 5; step++) {
    const wheel = page.getByRole('listbox');
    const dimensions = await wheel.evaluate(node => ({
      height: node.clientHeight,
      rows: [...node.querySelectorAll('[role=option]')].map(row => row.getBoundingClientRect().height),
    }));
    expect(dimensions.height).toBeLessThanOrEqual(200);
    expect(Math.min(...dimensions.rows)).toBeGreaterThanOrEqual(44);
    expect(Math.min(...dimensions.rows)).toBeLessThanOrEqual(46);
    await wheel.press('Home');
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(1);
    await wheel.press('End');
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(1);
    if (step !== 4) await page.locator('.smw-button-next').click();
  }
  await page.locator('.smw-filtered-wheel').screenshot({ path: 'test-results/compact-studio-wheel-mobile.png' });
});

test('mobile step changes reposition once and keep short steps clear of the bottom scroll limit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openAge(page);
  await page.evaluate(() => {
    window.__transitionScrolls = 0;
    const original = window.scrollTo;
    window.scrollTo = function (...args) { window.__transitionScrolls++; return original.apply(this, args); };
  });
  const check = async () => {
    await frames(page);
    expect(await page.evaluate(() => window.__transitionScrolls)).toBe(1);
    expect(await page.evaluate(() => Math.abs(
      document.querySelector('.smw-builder').getBoundingClientRect().top
      - document.querySelector('.navbar').getBoundingClientRect().bottom - 16,
    ))).toBeLessThanOrEqual(1);
    await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
    await page.evaluate(() => { window.__transitionScrolls = 0; });
  };
  // Returning to the short name step previously left the panel pinned to the
  // document bottom instead of the intended header anchor.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await check();
  await page.locator('.smw-button-next').click();
  await check();
  for (let step = 0; step < 5; step++) {
    await page.getByRole('listbox').press('End');
    await page.locator('.smw-button-next').click();
    await check();
  }
});

test('first mobile name-field focus, keyboard resize and refocus never trigger application scrolling', async ({ page }) => {
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  const input = page.getByRole('combobox', { name: 'Search recorded names' });
  await page.evaluate(() => document.fonts.ready);
  await frames(page);
  await page.evaluate(() => {
    window.__refocusScrolls = 0;
    for (const key of ['scrollTo', 'scrollBy']) {
      const original = window[key];
      window[key] = function (...args) { window.__refocusScrolls++; return original.apply(this, args); };
    }
  });
  await input.click();
  expect(await page.evaluate(() => window.__refocusScrolls)).toBe(0);
  await page.evaluate(() => {
    window.visualViewport?.dispatchEvent(new Event('resize'));
    document.activeElement.blur();
  });
  await input.focus();
  await input.pressSequentially('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__refocusScrolls)).toBe(0);
});

test('all mobile category searches avoid iPhone focus zoom without disabling pinch zoom', async ({ page }) => {
  await openAge(page);
  await page.getByRole('listbox').press('End');
  await page.locator('.smw-button-next').click();
  for (const label of ['Search activities', 'Search achievements', 'Search treats', 'Search locations']) {
    const input = page.getByRole('searchbox', { name: label, exact: true });
    await expect(input).toBeVisible();
    expect(await input.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    await page.evaluate(() => {
      window.__fieldFocusScrolls = 0;
      for (const key of ['scrollTo', 'scrollBy']) {
        const original = window[key];
        window[key] = function (...args) { window.__fieldFocusScrolls++; return original.apply(this, args); };
      }
    });
    await input.click();
    expect(await page.evaluate(() => window.__fieldFocusScrolls)).toBe(0);
    await input.fill('a');
    await input.clear();
    await page.getByRole('listbox').press('End');
    if (label !== 'Search locations') await page.locator('.smw-button-next').click();
  }
  await expect(page.locator('.smw-page')).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && scrollX === 0)).toBe(true);
});

test('a native touch swipe can pass multiple age rows instead of stopping at each one', async ({ page }) => {
  await openAge(page);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await wheel.scrollIntoViewIfNeeded();
  const box = await wheel.boundingBox();
  const pagePosition = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const client = await page.context().newCDPSession(page);
  try {
    const x = box.x + box.width / 2, y = box.y + box.height * .85;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let distance = 15; distance <= 180; distance += 15) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance }] });
      await frames(page);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => wheel.evaluate(node => node.scrollTop)).toBeGreaterThan(96);
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(1);
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(pagePosition);
  } finally { await client.detach(); }
});
