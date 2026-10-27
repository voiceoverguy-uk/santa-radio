import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
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

test('a native touch swipe can pass multiple age rows instead of stopping at each one', async ({ page }) => {
  await openAge(page);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await wheel.scrollIntoViewIfNeeded();
  const box = await wheel.boundingBox();
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
  } finally { await client.detach(); }
});
