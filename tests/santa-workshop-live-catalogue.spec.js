import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

test.beforeEach(async ({ page }) => { await unlockWorkshop(page); });

for (const initialWidth of [390, 1365]) {
test(`live HTTPS categories ${initialWidth}: mobile flow and full-list desktop achievement scrolling without recipient requests or storage`, async ({ page, request }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: initialWidth, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-names?inventory=hosted', route => route.fulfill({ json: {
    records: [{ id: 'demrie', name: 'Demrie' }], hostedCount: 1, warning: null,
  } }));
  // No mock for the catalogue: this request reaches the real uploaded HTTPS index.
  const response = await request.get('/api/santa-workshop-catalogue');
  expect(response.status()).toBe(200);
  const catalogue = await response.json();
  expect(catalogue.source).toBe('hosted');
  expect(catalogue.counts).toEqual({ age: 63, activity: 131, achievement: 38, treat: 96, place: 120 });
  expect(catalogue.needsReviewCounts.place).toBe(2);
  expect(catalogue.categories.place.slice(0, 5).map(item => item.label)).toEqual([
    'England', 'Scotland', 'Ireland', 'Wales', 'United States',
  ]);
  const remaining = catalogue.categories.place.slice(5);
  const realPlaces = remaining.filter(item => item.kind === 'place');
  const imaginaryPlaces = remaining.filter(item => item.kind !== 'place');
  const alphabetical = records => [...records].sort((a, b) =>
    a.label.localeCompare(b.label, 'en-GB', { numeric: true, sensitivity: 'base' }));
  expect(remaining.map(item => item.id)).toEqual([
    ...alphabetical(realPlaces), ...alphabetical(imaginaryPlaces),
  ].map(item => item.id));
  expect(imaginaryPlaces.some(item => item.kind === 'fantasy')).toBe(true);
  expect(imaginaryPlaces.some(item => item.kind === 'space')).toBe(true);
  for (const label of ['Jersey', 'Guernsey', 'Dubai', 'Hong Kong', 'Isle of Man',
    'Gibraltar', 'Greenland', 'Faroe Islands', 'Yorkshire']) {
    expect(realPlaces.some(item => item.label === label)).toBe(true);
    expect(imaginaryPlaces.some(item => item.label === label)).toBe(false);
  }
  const posts = [], inventoryRequests = [];
  page.on('request', req => {
    if (req.method() === 'POST') posts.push(req.url());
    if (req.url().includes('/api/santa-workshop-catalogue')) inventoryRequests.push(req);
  });
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  // Stabilise the radio's explicit preference before testing recipient storage,
  // since the journey also switches between desktop and phone viewports.
  const minimise = page.getByRole('button', { name: 'Minimise radio player', exact: true });
  if (await minimise.isVisible()) await minimise.click();
  const storage = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const initialStorage = await storage();
  await page.getByRole('combobox', { name: 'Search recorded names' }).fill('Dem');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  await page.locator('.smw-button-next').click();
  const selected = ['7 months old', 'Reading', 'Helping your mummy', 'Pfeffernüsse', 'United Arab Emirates'];
  const keys = ['age', 'activity', 'achievement', 'treat', 'place'];
  for (const [index, label] of selected.entries()) {
    const wheel = page.getByRole('listbox');
    await expect(wheel.getByRole('option')).toHaveCount(catalogue.counts[keys[index]]);
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(0);
    if (index === 4) {
      await expect(page.locator('.smw-stage-heading h3')).toHaveText('Santa would like to know where he’s going?');
      expect(await wheel.getByRole('option').allTextContents()).toEqual(catalogue.categories.place.map(item => item.label));
    }
    if (index === 2) {
      const checkViewport = async () => {
        const geometry = await wheel.evaluate(scroll => {
          const frame = scroll.closest('.smw-choice-wheel-frame');
          const rect = frame.getBoundingClientRect();
          const input = document.querySelector('.smw-choice-search input').getBoundingClientRect();
          return {
            height: scroll.clientHeight, frameHeight: frame.clientHeight,
            aligned: Math.abs(input.bottom - rect.bottom) <= 1,
            visibleChoices: [...scroll.querySelectorAll('[role=option]')].filter(option => {
              const item = option.getBoundingClientRect();
              return item.bottom > rect.top + 1 && item.top < rect.bottom - 1;
            }).length,
          };
        });
        expect(Math.abs(geometry.height - geometry.frameHeight)).toBeLessThanOrEqual(1);
        expect(geometry.visibleChoices).toBeGreaterThan(0);
        expect(geometry.aligned).toBe(true);
      };
      // Check first-entry desktop geometry before any resize can repair it.
      if (initialWidth > 900) await checkViewport();
      await page.setViewportSize({ width: 1365, height: 900 });
      await checkViewport();
      await page.locator('.smw-searchable-layout').screenshot({ path: 'generated-artifacts/workshop/live-achievements-desktop.png' });
      await wheel.press('End');
      await expect(wheel.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
      await checkViewport();
      await wheel.press('Home');
      await expect(wheel.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
      await checkViewport();
      const search = page.getByRole('searchbox', { name: 'Search achievements', exact: true });
      await search.fill('brave');
      await expect(wheel.getByRole('option', { name: 'Being brave', exact: true })).toBeVisible();
      await checkViewport();
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(wheel.getByRole('option')).toHaveCount(catalogue.counts.achievement);
      await checkViewport();
      await page.setViewportSize({ width: 1024, height: 720 });
      await checkViewport();
      await page.setViewportSize({ width: 1365, height: 900 });
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      await checkViewport();
      await page.addStyleTag({ content: 'html { font-size: 100%; }' });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    const option = wheel.getByRole('option', { name: label, exact: true });
    await option.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');
    if (index === 3) {
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      expect(await wheel.getByRole('option').evaluateAll(nodes => nodes.every(node =>
        node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1))).toBe(true);
      await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/live-treats-mobile-large-text.png' });
    }
    await page.locator('.smw-button-next').click();
  }
  for (const label of selected) await expect(page.locator('.smw-summary')).toContainText(label);
  await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
  await expect(page.getByRole('option', { name: 'United Arab Emirates', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('option', { name: 'Camelot — Fantasy place', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review' }).click();
  await expect(page.locator('.smw-summary')).toContainText('Camelot — Fantasy place');
  for (const label of selected.slice(0, -1)) await expect(page.locator('.smw-summary')).toContainText(label);
  await expect(page.locator('.smw-audio-disclaimer')).toContainText('No recording has been made');
  expect(await storage()).toEqual(initialStorage);
  expect(posts).toEqual([]);
  // StrictMode replays mount effects in development, cancelling the first GET.
  expect(inventoryRequests.filter(req => !req.failure())).toHaveLength(1);
  for (const req of inventoryRequests) {
    expect(new URL(req.url()).search).toBe('');
    expect(req.postData()).toBeNull();
  }
  // Capture review layouts from the page top after interaction, without a
  // partially scrolled sticky header being composited into an element crop.
  await page.setViewportSize({ width: 390, height: 2200 });
  await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  const settle = () => page.evaluate(async () => {
    document.activeElement?.blur();
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await settle();
  await page.screenshot({ path: 'generated-artifacts/workshop/live-review-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1800 });
  await settle();
  await page.screenshot({ path: 'generated-artifacts/workshop/live-review-desktop.png' });
});
}
