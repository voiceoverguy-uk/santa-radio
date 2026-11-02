import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { workshopCatalogueFixture, workshopRegionalCatalogueFixture, workshopMixedDestinationFixture } from './fixtures/workshop-catalogue.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

test.beforeEach(async ({ page }) => { await unlockWorkshop(page); });

async function openRegionalStage(page, inventory = workshopRegionalCatalogueFixture) {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: inventory }));
  await page.route('**/api/santa-names', route => route.fulfill({
    json: { records: [{ id: `f-${'a'.repeat(64)}`, name: 'Arabella', variant: '', selectionToken: 'fixture', previewUrl: '/api/santa-name-audio/fixture' }] },
  }));
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Arabella');
  await page.getByRole('option', { name: 'Arabella', exact: true }).click();
  await page.locator('.smw-button-next').click();
  for (const label of ['8 years old', 'Art', 'Being brave', 'Map']) {
    if (label === 'Art') await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await page.locator('.smw-button-next').click();
  }
}

for (const width of [320, 390, 430]) {
  test(`mobile selected destination stays compact below search and choices at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRegionalStage(page);
    await page.getByRole('option', { name: 'England', exact: true }).click();
    await page.getByRole('button', { name: 'Choose a county', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search counties in England', exact: true });
    await search.fill('Kent');
    await page.getByRole('option', { name: 'Kent', exact: true }).click();
    const summary = page.locator('.smw-destination-picker__selection');
    await expect(summary).toContainText('Kent, England');
    const geometry = await summary.evaluate(node => {
      const active = document.querySelector('.smw-destination-picker__regional:not([hidden])');
      const search = active.querySelector('input').getBoundingClientRect();
      const wheel = active.querySelector('.smw-choice-wheel-frame').getBoundingClientRect();
      const summary = node.getBoundingClientRect();
      return {
        summaryTop: summary.top, summaryHeight: summary.height,
        searchBottom: search.bottom, wheelBottom: wheel.bottom,
        actions: [...node.querySelectorAll('button')].map(button => {
          const rect = button.getBoundingClientRect();
          return { height: rect.height, left: rect.left, right: rect.right };
        }),
      };
    });
    expect(geometry.summaryTop).toBeGreaterThanOrEqual(geometry.searchBottom);
    expect(geometry.summaryTop).toBeGreaterThanOrEqual(geometry.wheelBottom);
    expect(geometry.summaryHeight).toBeLessThan(190);
    for (const action of geometry.actions) {
      expect(action.height).toBeGreaterThanOrEqual(44);
      expect(action.left).toBeGreaterThanOrEqual(0);
      expect(action.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.smw-builder').screenshot({
      path: `generated-artifacts/studio-mobile-destination-compact-${width}.png`,
      style: '.navbar, .skip-link { visibility: hidden; }',
      animations: 'disabled',
    });
    // Searching must not clear the selected destination or move its summary
    // back ahead of the search when no county matches.
    await search.fill('no matching county');
    await expect(summary).toContainText('Kent, England');
    await expect(page.locator('.smw-destination-picker__regional .smw-search-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Back to countries', exact: true }).click();
    await expect(summary).toContainText('Kent, England');
    await page.getByRole('button', { name: 'Change county', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Counties in England', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Use England only', exact: true }).click();
    await expect(summary).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'England', exact: true })).toHaveAttribute('aria-selected', 'true');
  });
}

for (const width of [1365, 320]) {
  test(`optional regional destination flow ${width}: five parents, search, back, review, edit and country-only`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 320 ? 650 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRegionalStage(page);
    await expect(page.getByRole('option')).toHaveText(['England', 'Scotland', 'Northern Ireland', 'Wales', 'United States', 'Ireland']);
    for (const [country, region, kind] of [
      ['England', 'Kent', 'county'], ['Scotland', 'Fife', 'county'],
      ['Northern Ireland', 'Antrim', 'county'], ['Wales', 'Powys', 'county'], ['United States', 'Georgia', 'state'],
    ]) {
      await page.getByRole('option', { name: country, exact: true }).click();
      await expect(page.locator('.smw-destination-picker__selection')).toHaveCount(0);
      const parentScroll = await page.getByRole('listbox').evaluate(node => node.scrollTop);
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      const heading = page.getByRole('heading', { name: `${kind === 'state' ? 'States' : 'Counties'} in ${country}`, exact: true });
      await expect(heading).toBeFocused();
      expect(await heading.evaluate(node => {
        const rect = node.getBoundingClientRect();
        const header = document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0;
        return rect.top >= header && rect.top < innerHeight;
      })).toBe(true);
      await expect(page.getByRole('listbox')).toHaveCount(1);
      await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
      await expect(page.getByRole('searchbox')).toHaveValue('');
      await page.getByRole('button', { name: 'Back to countries', exact: true }).click();
      await expect(page.getByRole('option', { name: country, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect.poll(() => page.getByRole('listbox').evaluate(node => node.scrollTop)).toBeCloseTo(parentScroll, 0);
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      const search = page.getByRole('searchbox', { name: `Search ${kind === 'state' ? 'states' : 'counties'} in ${country}`, exact: true });
      await search.fill(region.toUpperCase());
      await expect(page.getByRole('option')).toHaveCount(1);
      await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
      await page.getByRole('listbox').focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('.smw-destination-picker__selection')).toContainText(`${region}, ${country}`);
      await expect(page.locator('.smw-destination-picker__regional .smw-wording-selection')).toHaveText(region);
      if (country === 'England') {
        await page.locator('.smw-builder').screenshot({ path: `generated-artifacts/studio-regional-${width}.png`,
          style: '.navbar, .skip-link { visibility: hidden; }' });
        if (width === 320) {
          await page.addStyleTag({ content: 'html { font-size: 200%; }' });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await expect(page.getByRole('button', { name: 'Use England only', exact: true })).toBeVisible();
          await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/studio-regional-320-enlarged.png',
            style: '.navbar, .skip-link { visibility: hidden; }' });
          await page.addStyleTag({ content: 'html { font-size: 100%; }' });
        }
      }
      await search.fill('does not match');
      await expect(page.locator('.smw-destination-picker__regional .smw-search-empty')).toContainText(`Selected: ${region}`);
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(page.getByRole('option')).toHaveText([region, 'Z Fixture Place']);
      await expect(page.getByRole('option', { name: region, exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('button', { name: 'Back to countries', exact: true }).click();
      await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText(region);
      await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-summary-row').last()).toContainText(`${region}, ${country}`);
      await expect(page.locator('.studio-letter__paper .studio-gifts__sr').first()).toContainText(`${region}, ${country}`);
      await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
      await expect(page.locator('.smw-destination-picker__selection')).toContainText(`${region}, ${country}`);
      await page.getByRole('button', { name: `Change ${kind}`, exact: true }).click();
      await expect(page.getByRole('option', { name: region, exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('button', { name: `Use ${country} only`, exact: true }).click();
      await expect(page.locator('.smw-destination-picker__selection')).toHaveCount(0);
      await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText(country);
    }
    // Ireland remains an independent country, with no regional step.
    await page.getByRole('searchbox', { name: 'Search locations', exact: true }).fill('Ireland');
    await page.getByRole('option', { name: 'Ireland', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choose a county', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
  });
}

test('regional request carries both trusted IDs and changing country clears the region', async ({ page }) => {
  await openRegionalStage(page);
  await page.getByRole('option', { name: 'United States', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a state', exact: true }).click();
  await page.getByRole('option', { name: 'Georgia', exact: true }).click();
  await page.locator('.smw-button-next').click();
  const letterText = await page.locator('.studio-letter__paper').first().textContent();
  expect(letterText).toContain('Georgia, United States');
  expect(letterText).not.toContain('Statue of Liberty');
  expect(letterText).not.toContain('Tbilisi');
  let submitted;
  await page.route('**/api/santa-studio-message', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: { error: 'Fixture: no real recording requested.' } });
  });
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect.poll(() => submitted?.region).toBe(workshopRegionalCatalogueFixture.regionalGroups['usa-states'].records[0].id);
  expect(submitted.place).toBe(workshopRegionalCatalogueFixture.regionalGroups['usa-states'].parentId);
  await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
  await page.getByRole('option', { name: 'England', exact: true }).click();
  await expect(page.locator('.smw-destination-picker__selection')).toHaveCount(0);
  await page.locator('.smw-button-next').click();
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect.poll(() => submitted?.place).toBe(workshopRegionalCatalogueFixture.regionalGroups['england-counties'].parentId);
  expect(submitted).not.toHaveProperty('region');
});

for (const missing of [true, false]) {
  test(`unavailable optional inventory never blocks the country maker (${missing ? 'old index' : 'empty folders'})`, async ({ page }) => {
    const inventory = structuredClone(workshopRegionalCatalogueFixture);
    if (missing) delete inventory.regionalGroups;
    else for (const group of Object.values(inventory.regionalGroups)) group.records = [];
    await openRegionalStage(page, inventory);
    await page.getByRole('option', { name: 'England', exact: true }).click();
    await expect(page.getByText('State and county choices are not available just yet. You can still choose this country.')).toBeVisible();
    await expect(page.getByRole('listbox')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Choose a county', exact: true })).toHaveCount(0);
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-summary-row').last()).toContainText('England');
    await expect(page.getByRole('button', { name: 'Create message' })).toBeEnabled();
  });
}

const catalogue = structuredClone(workshopCatalogueFixture);
const choice = (id, label) => ({ id, label, file: `fixture/${id}.wav` });
Object.assign(catalogue.categories, {
  activity: [choice('tidy', 'Tidying away toys'), choice('share', 'Sharing toys with others'), choice('football', 'Playing football')],
  achievement: [choice('help', 'Helping with toys'), choice('brave', 'Being brave')],
  treat: [choice('chocolate', 'Hot chocolate'), choice('carrots', 'Carrots for reindeer')],
  place: [choice('england', 'England'), { ...choice('moon', 'The Moon — Space destination'), kind: 'space' },
    { ...choice('wonderland', 'Wonderland — Fantasy place'), kind: 'fantasy' }],
});
for (const key of ['activity', 'achievement', 'treat', 'place']) catalogue.counts[key] = catalogue.categories[key].length;

for (const viewport of [{ width: 1365, height: 900 }, { width: 320, height: 568 }]) {
  test(`live keyword search ${viewport.width}: four stages only, preserved choices, no per-keystroke requests`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let catalogueRequests = 0;
    const posts = [];
    await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
    await page.route('**/api/santa-workshop-catalogue', route => {
      catalogueRequests++;
      return route.fulfill({ json: catalogue });
    });
    await page.route('**/api/santa-names', route => route.fulfill({
      json: { records: [{ id: 'demrie', name: 'Demrie', selectionToken: 'fixture', previewUrl: '/api/santa-name-audio/fixture' }], warning: null },
    }));
    await page.goto('/santa-message-workshop');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    if (viewport.width === 320) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await expect(page.getByRole('search')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dem');
    await page.getByRole('option', { name: 'Demrie', exact: true }).click();
    await page.locator('.smw-button-next').click();
    await expect(page.getByRole('search')).toHaveCount(0);
    await page.getByRole('listbox', { name: 'Their age', exact: true }).press('Home');
    await page.locator('.smw-button-next').click();
    await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
    const storage = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    const before = await storage();
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });

    for (const [index, searchLabel, term, selected, allCount] of [
      [3, 'Search activities', 'toys', 'Tidying away toys', 3],
      [4, 'Search achievements', 'toys', 'Helping with toys', 2],
      [5, 'Search treats', 'chocolate', 'Hot chocolate', 2],
      [6, 'Search fantasy and space destinations', 'space', 'The Moon — Space destination', 2],
    ]) {
      await expect(page.locator('.smw-step-count')).toHaveText(`Step ${index + 1} of 8`);
      if (index === 6) await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
      const input = page.getByRole('searchbox', { name: searchLabel, exact: true });
      if (index === 3) {
        await expect(page.locator('.smw-choice-search label')).toHaveCount(0);
        await expect(input).toHaveAttribute('placeholder', 'Try football or toys');
      }
      if (index === 4) {
        await expect(page.locator('.smw-choice-search label')).toHaveCount(0);
        await expect(input).toHaveAttribute('placeholder', 'Try school or helping');
      }
      const checkAchievementAlignment = async () => {
        if (index !== 4) return;
        const geometry = await page.locator('.smw-searchable-layout').evaluate(layout => {
          const input = layout.querySelector('input').getBoundingClientRect();
          const wheel = layout.querySelector('.smw-choice-wheel-frame, .smw-search-empty').getBoundingClientRect();
          const wording = layout.querySelector('.smw-activity-wording').getBoundingClientRect();
          return { inputBottom: input.bottom, inputTop: input.top, wheelBottom: wheel.bottom,
            wheelTop: wheel.top, wordingTop: wording.top, wordingBottom: wording.bottom };
        });
        if (viewport.width > 900) {
          expect(Math.abs(geometry.inputBottom - geometry.wheelBottom)).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.wordingTop - geometry.wheelTop)).toBeLessThanOrEqual(1);
          expect(geometry.inputTop - geometry.wordingBottom).toBeGreaterThanOrEqual(17);
        } else {
          expect(geometry.inputBottom).toBeLessThanOrEqual(geometry.wheelTop);
        }
      };
      await checkAchievementAlignment();
      if (index === 5) {
        await expect(page.locator('.smw-choice-search label')).toHaveCount(0);
        await expect(input).toHaveAttribute('placeholder', 'Try chocolate or biscuits');
      }
      if (index === 6) {
        await expect(page.locator('.smw-choice-search label')).toHaveCount(0);
        await expect(input).toHaveAttribute('placeholder', 'Try a fantasy place or space destination');
      }
      const countBeforeTyping = catalogueRequests;
      await input.fill(term.toUpperCase());
      await expect(page.getByRole('option')).toHaveCount(index === 3 ? 2 : 1);
      await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
      await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-validation')).not.toBeEmpty();
      await page.getByRole('option', { name: selected, exact: true }).click();
      await expect(page.locator('.smw-choice-wheel-status')).toHaveText(`Selected: ${selected}`);
      await checkAchievementAlignment();
      await input.fill('no such choice');
      await expect(page.getByText('No matching choices. Try another word or clear the search.', { exact: true })).toBeVisible();
      await expect(page.locator('.smw-search-empty')).toContainText(`Selected: ${selected}`);
      await checkAchievementAlignment();
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(input).toBeFocused();
      await expect(page.getByRole('option')).toHaveCount(allCount);
      await expect(page.getByRole('option', { name: selected, exact: true })).toHaveAttribute('aria-selected', 'true');
      if (index === 3) {
        await input.fill('football');
        await expect(page.getByRole('option')).toHaveCount(1);
        await expect(page.getByRole('option', { name: 'Playing football', exact: true })).toHaveAttribute('aria-selected', 'false');
        await expect(page.locator('.smw-choice-wheel-status')).toHaveText(`Selected: ${selected}`);
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
      }
      expect(catalogueRequests).toBe(countBeforeTyping);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (index === 5) {
        await expect(page.getByRole('complementary', { name: 'Santa will say…', exact: true })).toContainText('We do like a little treat when we arrive on Christmas Eve… and… I know you like to leave me…');
        await expect(page.getByRole('complementary', { name: 'Santa will say…', exact: true })).not.toContainText('carrot');
      }
      if (index === 3) await page.locator('.smw-searchable-layout').screenshot({ path: `generated-artifacts/workshop/search-${viewport.width}.png` });
      if (index === 4) {
        await checkAchievementAlignment();
        await page.locator('.smw-searchable-layout').screenshot({ path: `generated-artifacts/workshop/achievement-search-aligned-${viewport.width}.png` });
        if (viewport.width > 900) {
          await page.addStyleTag({ content: 'html { font-size: 200%; }' });
          await checkAchievementAlignment();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          await page.addStyleTag({ content: 'html { font-size: 100%; }' });
        }
      }
      await page.locator('.smw-button-next').click();
    }
    await expect(page.getByRole('search')).toHaveCount(0);
    await expect(page.locator('.smw-summary')).toContainText('Tidying away toys');
    await expect(page.locator('.smw-summary')).toContainText('Helping with toys');
    await expect(page.locator('.smw-summary')).toContainText('Hot chocolate');
    await expect(page.locator('.smw-summary')).toContainText('The Moon');
    await page.getByRole('button', { name: 'Change Working hard at', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: 'Search activities', exact: true })).toHaveValue('');
    await expect(page.getByRole('option', { name: 'Tidying away toys', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await storage()).toEqual(before);
    expect(posts).toEqual([]);
  });
}

for (const width of [1365, 320]) {
  test(`destination categories ${width}: explicit choices, resets, visible review editing and trusted requests`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 320 ? 750 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const inventory = workshopMixedDestinationFixture;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openRegionalStage(page, inventory);
    const countries = page.getByRole('button', { name: 'Countries & real places', exact: true });
    const fantasy = page.getByRole('button', { name: 'Fantasy & space', exact: true });
    const next = page.locator('.smw-button-next');
    const preview = page.locator('.smw-destination-picker__country .smw-wording-selection');
    const countryLabels = inventory.categories.place.filter(record => record.kind === 'place').map(record => record.label);
    const fantasyRecords = inventory.categories.place.filter(record => record.kind !== 'place');
    await expect(countries).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('option')).toHaveText(countryLabels);
    expect(countryLabels).toContain('Antarctica');
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await next.click();
    await expect(page.locator('.smw-validation')).not.toBeEmpty();
    await page.getByRole('option', { name: 'England', exact: true }).click();
    await page.getByRole('button', { name: 'Choose a county', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Counties in England', exact: true })).toBeFocused();
    await page.getByRole('listbox').press('Home');
    await expect(page.locator('.smw-destination-picker__selection')).toContainText('Kent, England');
    // Category controls remain keyboard-operable during regional browsing.
    await fantasy.focus();
    await page.keyboard.press('Enter');
    await expect(fantasy).toBeFocused();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Choose a fantasy or space destination', exact: true })).toBeVisible();
    await expect(page.getByRole('option')).toHaveText(fantasyRecords.map(record => record.label));
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page.getByRole('searchbox')).not.toHaveAttribute('placeholder', /country/i);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await expect(preview).toHaveCount(0);
    await expect(page.locator('.smw-destination-picker__selection')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Choose a (state|county)/ })).toHaveCount(0);
    await next.click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 7 of 8');
    const search = page.getByRole('searchbox');
    await search.fill('moon');
    await expect(page.getByRole('option')).toHaveText(['The Moon — Space destination']);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await countries.click();
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page.getByRole('option')).toHaveText(countryLabels);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Choose a county', exact: true })).toHaveCount(0);
    await page.getByRole('searchbox').fill('Antarctica');
    await fantasy.click();
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await next.click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 7 of 8');

    let submitted;
    await page.route('**/api/santa-studio-message', route => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: 'Fixture: no real recording requested.' } });
    });
    // Exercise every fantasy and real-space record through review, letter and
    // request submission without changing its catalogue recording identity.
    for (const record of fantasyRecords) {
      await page.getByRole('option', { name: record.label, exact: true }).click();
      await expect(preview).toHaveText(record.label);
      // Clicking the active category is not a switch and must keep the choice.
      await fantasy.click();
      await expect(preview).toHaveText(record.label);
      await next.click();
      await expect(page.locator('.smw-summary-row').last()).toContainText(record.label);
      const placeName = record.label.split(' — ')[0];
      await expect(page.locator('.studio-letter__paper').first()).toContainText(placeName);
      submitted = null;
      await page.getByRole('button', { name: 'Create message', exact: true }).click();
      await expect.poll(() => submitted?.place).toBe(record.id);
      expect(submitted).not.toHaveProperty('region');
      await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
      await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('option', { name: record.label, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(preview).toHaveText(record.label);
    }
    await page.locator('.smw-button-back').click();
    // Ordinary Back/Continue navigation also exposes the saved fantasy choice.
    await page.locator('.smw-button-back').click();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('option', { selected: true })).toHaveText(fantasyRecords.at(-1).label);
    await page.locator('.smw-button-back').click();
    await next.click();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
    await expect(preview).toHaveText(fantasyRecords.at(-1).label);
    await next.click();
    await page.getByRole('button', { name: 'Change A festive treat for Santa', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');
    await next.click();
    await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.smw-builder').screenshot({ path: `generated-artifacts/studio-destination-categories-${width}.png`,
      style: '.navbar, .skip-link { visibility: hidden; }' });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const button of [countries, fantasy]) {
      expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1
        && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    }
    expect(await page.getByRole('option').evaluateAll(nodes => nodes.every(node =>
      node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1))).toBe(true);
    expect(await page.locator('.smw-activity-wording').evaluate(node =>
      node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    await page.locator('.smw-builder').screenshot({ path: `generated-artifacts/studio-destination-categories-${width}-enlarged.png`,
      style: '.navbar, .skip-link { visibility: hidden; }' });

    await countries.click();
    await expect(preview).toHaveCount(0);
    await page.locator('.smw-button-back').click();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
    await expect(page.getByText('Choose a destination to preview your keepsakes.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
    await expect(countries).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const [country, kind] of [['United States', 'state'], ['England', 'county']]) {
  for (const width of [1365, 320]) {
    test(`regional action placement ${country} ${width}: selected label, action, explanation and keyboard`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openRegionalStage(page);
      if (width === 320) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      await page.getByRole('option', { name: country, exact: true }).click();
      const action = page.getByRole('button', { name: `Choose a ${kind}`, exact: true });
      await expect(action).toHaveCount(1);
      const geometry = await page.locator('.smw-destination-picker__country').evaluate(node => {
        const status = node.querySelector('.smw-choice-wheel-status').getBoundingClientRect();
        const action = node.querySelector('.smw-destination-picker__region-action').getBoundingClientRect();
        const explanation = node.querySelector('.smw-destination-picker__region-prompt').getBoundingClientRect();
        return { statusBottom: status.bottom, actionTop: action.top, actionBottom: action.bottom,
          explanationTop: explanation.top, actionLeft: action.left, actionRight: action.right };
      });
      expect(geometry.actionTop).toBeGreaterThanOrEqual(geometry.statusBottom);
      expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.explanationTop);
      expect(geometry.actionLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.actionRight).toBeLessThanOrEqual(width);
      await expect(page.locator('.smw-destination-picker__region-prompt button')).toHaveCount(0);
      await page.getByRole('listbox').focus();
      await page.keyboard.press('Tab');
      await expect(action).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: `${kind === 'state' ? 'States' : 'Counties'} in ${country}`, exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Back to countries', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Choose a country or real place', exact: true })).toBeFocused();
      await expect(page.getByRole('option', { name: country, exact: true })).toHaveAttribute('aria-selected', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
}

test('changing destination category discards generated audio rather than restoring it', async ({ page }) => {
  await openRegionalStage(page, workshopMixedDestinationFixture);
  await page.route('**/api/santa-studio-message', route => route.fulfill({
    contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
  }));
  await page.evaluate(() => {
    window.revokedWorkshopUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.revokedWorkshopUrls.push(url); revoke(url); };
  });
  await page.getByRole('option', { name: 'England', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  const download = page.getByRole('link', { name: 'Download MP3', exact: true });
  await expect(download).toBeVisible();
  const oldUrl = await download.getAttribute('href');
  await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
  await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
  await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'The Moon — Space destination', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await expect(download).toHaveCount(0);
  expect(await page.evaluate(() => window.revokedWorkshopUrls)).toContain(oldUrl);
});
