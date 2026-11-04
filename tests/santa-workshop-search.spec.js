import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { workshopCatalogueFixture, workshopRegionalCatalogueFixture, workshopMixedDestinationFixture } from './fixtures/workshop-catalogue.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { confirmMessage, emptyGeneration, mockStudioGeneration } from './helpers/studio-generation.js';
import { workshopDestinationLabel } from '../src/lib/workshopDestinations.js';
import { createWorkshopCatalogueHandler } from '../server/santa-workshop-catalogue.js';
import { regionalEditorialContext } from '../server/studio-regional-stories.js';
import { workshopRegionalFolders } from '../src/lib/workshopDestinations.js';
import { createHash } from 'node:crypto';
import { studioEditorialContext } from '../server/studio-letter-editorial.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';

test.beforeEach(async ({ page }) => {
  await unlockWorkshop(page);
  await page.route('**/api/santa-studio-message', route => route.request().method() === 'GET'
    ? route.fulfill({ json: emptyGeneration() }) : route.fallback());
});

async function openRegionalStage(page, inventory = workshopRegionalCatalogueFixture) {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  const handler = createWorkshopCatalogueHandler(async () => inventory, () => true);
  await page.route('**/api/santa-workshop-catalogue*', async route => {
    let status, body;
    await handler({ method: 'GET', url: new URL(route.request().url()).pathname + new URL(route.request().url()).search }, {
      setHeader() {}, writeHead(value) { status = value; }, end(value) { body = value; },
    });
    await route.fulfill({ status, contentType: 'application/json', body });
  });
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

async function expectNoDestinationSummary(page) {
  await expect(page.locator('.smw-destination-picker__summary, .smw-destination-picker__selection')).toHaveCount(0);
  await expect(page.getByText('Selected destination', { exact: true })).toHaveCount(0);
}

for (const width of [390, 1440]) {
  test(`regional local stories retain their parent, spelling, reopening and unrelated edits at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const inventory = structuredClone(workshopRegionalCatalogueFixture);
    const selections = [
      ['usa-states', 'United States', 'Florida', 'state'],
      ['england-counties', 'England', 'West Yorkshire', 'county'],
      ['scotland-counties', 'Scotland', 'City of Edinburgh', 'county'],
      ['wales-counties', 'Wales', 'Cardiff', 'county'],
      ['northern-ireland-counties', 'Northern Ireland', 'Antrim', 'county'],
    ];
    for (const [folder, , label] of selections) {
      const file = `${folder}/${label}.wav`;
      inventory.regionalGroups[folder].records = [{
        id: `c-${createHash('sha256').update(file).digest('hex')}`, file, label, kind: 'place', isCountry: false,
        letterContext: regionalEditorialContext(folder, workshopRegionalFolders[folder], label),
      }];
    }
    inventory.categories.activity.push({ ...inventory.categories.activity[0], id: 'reading-fixture', label: 'Reading books',
      letterContext: studioEditorialContext('activity', { label: 'Reading books' }) });
    inventory.counts.activity++;
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/santa-workshop-catalogue?')) requests.push(request.url());
    });
    await openRegionalStage(page, inventory);
    const paragraph = page.locator('.smw-studio-preview .studio-letter__text').first().locator('> p').nth(6);
    for (const [index, [folder, country, label, kind]] of selections.entries()) {
      if (index) {
        await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
        await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
      }
      const search = page.getByRole('searchbox', { name: 'Search locations', exact: true });
      await search.fill(country);
      await page.getByRole('option', { name: country, exact: true }).click();
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await page.locator('.smw-button-next').click();
      await expect(paragraph).toContainText(`${label}, ${country}`);
      const expected = inventory.regionalGroups[folder].records[0].letterContext.passages;
      await expect.poll(async () => {
        const text = await paragraph.textContent();
        return expected.some(passage => text.includes(passage));
      }).toBe(true);
      const before = await paragraph.textContent();
      expect(before).not.toContain('No guessing');
      expect(await page.locator('.smw-studio-preview .studio-letter__text').first().locator('> p').count()).toBe(12);
      await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
      await expect(page.locator('dialog[open] .studio-letter__text > p').nth(6)).toHaveText(before);
      await page.evaluate(() => document.fonts.ready);
      const bounds = await page.locator('dialog[open]').evaluate(dialog => {
        const paper = dialog.querySelector('.studio-letter__paper').getBoundingClientRect();
        const text = dialog.querySelector('.studio-letter__text').getBoundingClientRect();
        return { ratio: paper.width / paper.height, end: (text.bottom - paper.top) / paper.height,
          left: paper.left, right: paper.right, bottom: paper.bottom, height: innerHeight, width: innerWidth };
      });
      expect(bounds.ratio).toBeCloseTo(210 / 297, 3);
      expect(bounds.end).toBeLessThan(.88);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.width + .5);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + .5);
      if (index < 2) await page.locator('dialog[open]').screenshot({
        path: `generated-artifacts/studio-editorial/regional-${folder}-${width}.jpg`,
      });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
      await expect(page.locator('dialog[open] .studio-letter__text > p').nth(6)).toHaveText(before);
      await page.keyboard.press('Escape');
      if (index === 0) {
        await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
        await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('Arabelle');
        await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
        await expect(paragraph).toHaveText(before);
        await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
        await page.getByRole('option', { name: 'Reading books', exact: true }).click();
        await page.getByRole('button', { name: 'Return to review', exact: true }).click();
        await expect(paragraph).toHaveText(before);
      }
    }
    expect(requests).toHaveLength(5);
    for (const url of requests) {
      const query = new URL(url).searchParams;
      expect([...query.keys()].sort()).toEqual(['parentId', 'regionId']);
    }
  });
}

test('regional writing fails explicitly and retries only the selected context without replacing it with country prose', async ({ page }) => {
  await openRegionalStage(page);
  const group = workshopRegionalCatalogueFixture.regionalGroups['usa-states'];
  const georgia = group.records.find(record => record.label === 'Georgia');
  let attempts = 0;
  await page.route('**/api/santa-workshop-catalogue?*', route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 503, json: { error: 'Test unavailable' } } : {
      json: { parentId: group.parentId, regionId: georgia.id, letterContext: georgia.letterContext },
    });
  });
  await page.getByRole('option', { name: 'United States', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a state', exact: true }).click();
  await page.getByRole('option', { name: 'Georgia', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await expect(page.getByText('Santa’s local letter story could not be loaded.', { exact: false })).toBeVisible();
  for (const action of await page.getByRole('button', { name: 'Create message', exact: true }).all()) {
    await expect(action).toBeDisabled();
  }
  await expect(page.locator('.smw-studio-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const paragraph = page.locator('.smw-studio-preview .studio-letter__text').first().locator('> p').nth(6);
  await expect(paragraph).toContainText('Georgia, United States');
  await expect(paragraph).toContainText('Stone Mountain');
  await expect(paragraph).not.toContainText('Statue of Liberty');
  expect(attempts).toBe(2);
});

test('delayed and failed regional writing blocks both create actions until the local story is in the downloadable letter', async ({ page }) => {
  test.setTimeout(90000);
  await openRegionalStage(page);
  const fixture = await mockStudioGeneration(page, { record: { id: 'arabella', name: 'Arabella' } });
  const group = workshopRegionalCatalogueFixture.regionalGroups['usa-states'];
  const georgia = group.records.find(record => record.label === 'Georgia');
  let release;
  let attempt = 0;
  await page.route('**/api/santa-workshop-catalogue?*', async route => {
    attempt++;
    if (attempt === 1) {
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 503, json: { error: 'Delayed failure' } });
    } else await route.fulfill({ json: { parentId: group.parentId, regionId: georgia.id, letterContext: georgia.letterContext } });
  });
  await page.getByRole('option', { name: 'United States', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a state', exact: true }).click();
  await page.getByRole('option', { name: 'Georgia', exact: true }).click();
  await page.locator('.smw-button-next').click();
  const actions = page.getByRole('button', { name: 'Create message', exact: true });
  // The upper action is inside the not-yet-ready letter preview; the lower
  // mounted audio action must be disabled, not left as a way around readiness.
  await expect(actions).toHaveCount(1);
  await expect(page.locator('.smw-review-create-row')).toHaveCount(0);
  for (const action of await actions.all()) {
    await expect(action).toBeDisabled();
    // Even a dispatched click must not get past the component's complete guard.
    await action.dispatchEvent('click');
  }
  await expect(page.getByRole('dialog', { name: 'Are you happy with your selection?' })).toBeHidden();
  expect(fixture.posts).toHaveLength(0);
  await expect.poll(() => typeof release).toBe('function');
  release();
  await expect(page.getByText('Santa’s local letter story could not be loaded.', { exact: false })).toBeVisible();
  for (const action of await actions.all()) await expect(action).toBeDisabled();
  await expect(page.locator('.smw-review-create-row')).toHaveCount(0);
  expect(fixture.posts).toHaveLength(0);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const destination = page.locator('.studio-gifts__sr > p').nth(6);
  await expect(destination).toContainText('Stone Mountain');
  const reviewed = await destination.textContent();
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) await expect(action).toBeEnabled();
  await confirmMessage(page);
  const downloadButton = page.getByRole('button', { name: 'Download letter (PDF)', exact: true });
  await expect(downloadButton).toBeEnabled();
  const waiting = page.waitForEvent('download');
  await downloadButton.click();
  const download = await waiting;
  mkdirSync('generated-artifacts/studio-editorial', { recursive: true });
  const path = 'generated-artifacts/studio-editorial/regional-created-letter.pdf';
  await download.saveAs(path);
  expect((await PDFDocument.load(readFileSync(path))).getPageCount()).toBe(1);
  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ').trim();
  expect(text).toContain(reviewed.replace(/\s+/g, ' ').trim());
  expect(text).not.toContain('Statue of Liberty');
  expect(fixture.posts).toHaveLength(1);
  expect(attempt).toBe(2);
});

for (const width of [320, 390, 1365]) {
  test(`country-only action sits bottom-right and still clears regions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openRegionalStage(page);
    for (const [country, kind] of [
      ['England', 'county'], ['Scotland', 'county'], ['Wales', 'county'],
      ['Northern Ireland', 'county'], ['United States', 'state'],
    ]) {
      await page.getByRole('option', { name: country, exact: true }).click();
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      const regional = page.locator('.smw-destination-picker__regional:visible');
      await regional.getByRole('option').first().click();
      const reset = page.getByRole('button', { name: `Use ${country} only`, exact: true });
      await expect(reset).toBeVisible();
      for (const fontSize of width === 320 ? ['100%', '200%'] : ['100%']) {
        await page.addStyleTag({ content: `html { font-size: ${fontSize}; }` });
        const geometry = await reset.evaluate(node => {
          const action = node.getBoundingClientRect();
          const footer = node.closest('.smw-choice-wheel-footer-row');
          const frame = footer.parentElement.querySelector('.smw-choice-wheel-frame').getBoundingClientRect();
          const status = footer.querySelector('.smw-choice-wheel-status').getBoundingClientRect();
          return { rightOffset: Math.abs(action.right - frame.right),
            top: action.top, statusBottom: status.bottom, left: action.left,
            right: action.right, height: action.height, width: innerWidth };
        });
        expect(geometry.rightOffset).toBeLessThanOrEqual(1);
        if (width <= 760) {
          expect(geometry.top).toBeGreaterThanOrEqual(geometry.statusBottom);
        }
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(geometry.width);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
      }
      if ([390, 1365].includes(width) && country === 'England') await page.locator('.smw-builder').screenshot({
        path: `generated-artifacts/studio-country-only-bottom-right-${width}.png`, animations: 'disabled',
      });
      await reset.click();
      await expect(page.locator('.smw-destination-picker__country')).toBeVisible();
      await expect(page.getByRole('option', { name: country, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('button', { name: `Use ${country} only`, exact: true })).toHaveCount(0);
      await page.addStyleTag({ content: 'html { font-size: 100%; }' });
    }
  });
}

test('mobile header Continue reviews the chosen county and disappears for an invalid destination', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRegionalStage(page);
  const shortcut = page.locator('.smw-header-continue');
  await expect(shortcut).toHaveCount(0);
  await page.getByRole('option', { name: 'England', exact: true }).click();
  await expect(shortcut).toBeVisible();
  await page.getByRole('button', { name: 'Choose a county', exact: true }).click();
  await page.getByRole('option', { name: 'Kent', exact: true }).click();
  await expect(shortcut).toBeVisible();
  await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/studio-header-county-continue.png', animations: 'disabled' });
  await shortcut.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.smw-summary')).toContainText('Kent, England');
  await expect(shortcut).toHaveCount(0);
  await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
  await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
  await expect(shortcut).toHaveCount(0);
  await expect(page.locator('.smw-step-count')).toBeVisible();
});

for (const width of [1365, 320]) {
  test(`active countries button returns from counties and states without clearing selections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRegionalStage(page);
    const countryView = page.locator('.smw-destination-picker__country');
    const regionalView = page.locator('.smw-destination-picker__regional');
    const countries = page.getByRole('button', { name: 'Countries & real places', exact: true });
    for (const [country, kind] of [['England', 'county'], ['United States', 'state']]) {
      await page.getByRole('option', { name: country, exact: true }).click();
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      const option = regionalView.getByRole('option').first();
      const regionName = await option.textContent();
      await option.click();
      if (kind === 'state') {
        await countries.focus();
        await page.keyboard.press('Enter');
      } else {
        await countries.click();
      }
      await expect(countryView).toBeVisible();
      await expect(regionalView).toBeHidden();
      await expect(countryView.getByRole('option', { name: country, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(countries).toHaveAttribute('aria-pressed', 'true');
      await expect(countryView.locator('.smw-choice-wheel-status')).toContainText(country);
      await expect(page.getByRole('button', { name: `Use ${country} only`, exact: true })).toBeVisible();
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      await expect(regionalView.getByRole('option', { name: regionName, exact: true })).toHaveAttribute('aria-selected', 'true');
      await countries.click();
    }
  });
}

test('fantasy destination names omit the redundant suffix in choices, preview and review', async ({ page }) => {
  await openRegionalStage(page, workshopMixedDestinationFixture);
  await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
  const option = page.getByRole('option', { name: 'Wonderland', exact: true });
  await expect(option).toBeVisible();
  await option.click();
  const picker = page.locator('.smw-destination-picker');
  await expect(picker.locator('.smw-wording-selection')).toHaveText('Wonderland');
  await expect(picker).not.toContainText('— Fantasy place');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-summary')).toContainText('Wonderland');
  await expect(page.locator('.smw-summary')).not.toContainText('— Fantasy place');
});

for (const destination of ['The Moon', 'Mars']) {
test(`${destination} omits the space suffix in the wheel, wording and review`, async ({ page }) => {
  const inventory = structuredClone(workshopMixedDestinationFixture);
  const spaceRecord = inventory.categories.place.find(record => record.kind === 'space'
    && record.label.toLowerCase().startsWith(destination.toLowerCase()));
  spaceRecord.label = `${destination} — Space destination`;
  await openRegionalStage(page, inventory);
  await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
  await page.getByRole('option', { name: destination, exact: true }).click();
  const picker = page.locator('.smw-destination-picker');
  await expect(picker.locator('.smw-wording-selection')).toHaveText(destination);
  await expect(picker).not.toContainText('— Space destination');
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-summary')).toContainText(destination);
  await expect(page.locator('.smw-summary')).not.toContainText('— Space destination');
});
}

for (const width of [1365, 320, 390, 430]) {
  test(`destination uses existing preview without an extra box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRegionalStage(page);
    await page.getByRole('option', { name: 'England', exact: true }).click();
    const regionAction = page.getByRole('button', { name: 'Choose a county', exact: true });
    const actionStyle = await regionAction.evaluate(node => {
      const style = getComputedStyle(node);
      const action = node.getBoundingClientRect();
      const parent = node.parentElement.getBoundingClientRect();
      return {
        background: style.backgroundColor, border: style.borderTopColor,
        centreOffset: Math.abs(action.x + action.width / 2 - parent.x - parent.width / 2),
        height: action.height,
      };
    });
    expect(actionStyle.background).toBe('rgba(0, 0, 0, 0)');
    expect(actionStyle.border).toBe('rgba(0, 0, 0, 0)');
    expect(actionStyle.centreOffset).toBeLessThanOrEqual(1);
    expect(actionStyle.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByText('Optional: make the destination more local, or continue with the country alone.', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose a county', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search counties in England', exact: true });
    await search.fill('Kent');
    await page.getByRole('option', { name: 'Kent', exact: true }).click();
    const preview = page.locator('.smw-destination-picker__regional .smw-wording-selection');
    await expect(preview).toHaveText('Kent');
    await expect(page.getByRole('option', { name: 'Kent', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expectNoDestinationSummary(page);
    const reset = page.getByRole('button', { name: 'Use England only', exact: true });
    for (const fontSize of ['100%', '200%']) {
      await page.addStyleTag({ content: `html { font-size: ${fontSize}; }` });
      await expectNoDestinationSummary(page);
      const geometry = await reset.evaluate(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { height: rect.height, left: rect.left, right: rect.right,
          fits: node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1,
          background: style.backgroundColor, border: style.borderTopColor };
      });
      expect(geometry.height).toBeGreaterThanOrEqual(44);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.fits).toBe(true);
      expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
      expect(geometry.border).toBe('rgba(0, 0, 0, 0)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.addStyleTag({ content: 'html { font-size: 100%; }' });
    await page.locator('.smw-builder').screenshot({
      path: `generated-artifacts/studio-mobile-destination-compact-${width}.png`,
      style: '.navbar, .skip-link { visibility: hidden; }',
      animations: 'disabled',
    });
    // No-match searches preserve the choice in the retained preview.
    await search.fill('no matching county');
    await expect(preview).toHaveText('Kent');
    await expect(page.locator('.smw-destination-picker__regional .smw-search-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
    await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText('Kent');
    await expect(reset).toBeVisible();
    await page.getByRole('button', { name: 'Choose a county', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Counties in England', exact: true })).toBeFocused();
    await reset.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Choose a country or real place', exact: true })).toBeFocused();
    await expect(reset).toHaveCount(0);
    await expectNoDestinationSummary(page);
    await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText('England');
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
      await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
      await expect(page.getByRole('option', { name: country, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect.poll(() => page.getByRole('listbox').evaluate(node => node.scrollTop)).toBeCloseTo(parentScroll, 0);
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      const search = page.getByRole('searchbox', { name: `Search ${kind === 'state' ? 'states' : 'counties'} in ${country}`, exact: true });
      await search.fill(region.toUpperCase());
      await expect(page.getByRole('option')).toHaveCount(1);
      await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
      await page.getByRole('listbox').focus();
      await page.keyboard.press('ArrowDown');
      await expectNoDestinationSummary(page);
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
      await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
      await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText(region);
      await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-summary-row').last()).toContainText(`${region}, ${country}`);
      await expect(page.locator('.studio-letter__paper .studio-gifts__sr').first()).toContainText(`${region}, ${country}`);
      await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
      await expectNoDestinationSummary(page);
      await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText(region);
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      await expect(page.getByRole('option', { name: region, exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('option', { name: 'Z Fixture Place', exact: true }).click();
      await expect(page.locator('.smw-destination-picker__regional .smw-wording-selection')).toHaveText('Z Fixture Place');
      await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
      await page.getByRole('button', { name: `Use ${country} only`, exact: true }).click();
      await expectNoDestinationSummary(page);
      await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText(country);
      await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-summary-row').last()).toContainText(country);
      await expect(page.locator('.smw-summary-row').last()).not.toContainText('Z Fixture Place');
      await expect(page.locator('.studio-letter__paper').first()).not.toContainText('Z Fixture Place');
      await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
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
    if (route.request().method() === 'GET') return route.fallback();
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: { error: 'Fixture: no real recording requested.' } });
  });
  await confirmMessage(page);
  await expect.poll(() => submitted?.region).toBe(workshopRegionalCatalogueFixture.regionalGroups['usa-states'].records[0].id);
  expect(submitted.place).toBe(workshopRegionalCatalogueFixture.regionalGroups['usa-states'].parentId);
  await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
  await page.getByRole('button', { name: 'Use United States only', exact: true }).click();
  await page.locator('.smw-button-next').click();
  submitted = null;
  await confirmMessage(page, 'Retry message');
  await expect.poll(() => submitted?.place).toBe(workshopRegionalCatalogueFixture.regionalGroups['usa-states'].parentId);
  expect(submitted).not.toHaveProperty('region');
  await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a state', exact: true }).click();
  await page.getByRole('option', { name: 'Georgia', exact: true }).click();
  await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
  await page.getByRole('option', { name: 'England', exact: true }).click();
  await expect(page.locator('.smw-destination-picker__selection')).toHaveCount(0);
  await page.locator('.smw-button-next').click();
  await confirmMessage(page, 'Retry message');
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
    await expect(page.locator('.smw-actions--review').getByRole('button', { name: 'Create message' })).toBeEnabled();
  });
}

const catalogue = structuredClone(workshopCatalogueFixture);
const choice = (id, label) => ({ id, label, file: `fixture/${id}.wav` });

for (const width of [1365, 320]) {
  for (const scale of [100, 200]) {
    test(`option wheel geometry stays stable across stages, wording and filters at ${width}px / ${scale}% text`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const inventory = structuredClone(workshopRegionalCatalogueFixture);
      const longLabel = 'Remembering every Christmas song and singing all the words for the family at breakfast and dinner';
      for (const category of ['sports', 'funny', 'activity', 'achievement', 'treat']) {
        inventory.categories[category] = [
          choice(`c-${'a'.repeat(64)}`, 'Art'),
          choice(`c-${'b'.repeat(64)}`, longLabel),
        ];
        inventory.counts[category] = 2;
        inventory.excludedAudioCounts[category] = 0;
        inventory.needsReviewCounts[category] = 0;
      }
      for (const group of Object.values(inventory.regionalGroups)) {
        group.records[1].label = longLabel;
      }
      await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: inventory }));
      await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
      await page.route('**/api/santa-names', route => route.fulfill({
        json: { records: [{ id: 'demrie', name: 'Demrie', selectionToken: 'fixture', previewUrl: '/api/santa-name-audio/fixture' }] },
      }));
      await page.goto('/santa-message-workshop');
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.addStyleTag({ content: `html { font-size: ${scale}%; }` });
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dem');
      await page.getByRole('option', { name: 'Demrie', exact: true }).click();
      await page.locator('.smw-button-next').click();
      const age = page.locator('.smw-age-wheel');
      const ageBefore = await age.boundingBox();
      await page.getByRole('listbox').press('Home');
      await page.getByRole('listbox').press('End');
      const ageAfter = await age.boundingBox();
      expect(Math.abs(ageAfter.width - ageBefore.width)).toBeLessThanOrEqual(.5);
      expect(Math.abs(ageAfter.height - ageBefore.height)).toBeLessThanOrEqual(.5);
      await page.locator('.smw-button-next').click();

      let baseline;
      const layout = page.locator('.smw-searchable-layout:visible');
      const frame = layout.locator('.smw-choice-wheel-frame');
      const checkGeometry = async () => {
        const rect = await frame.boundingBox();
        baseline ||= rect;
        expect(Math.abs(rect.width - baseline.width)).toBeLessThanOrEqual(.5);
        expect(Math.abs(rect.height - baseline.height)).toBeLessThanOrEqual(.5);
        const geometry = await layout.evaluate(node => {
          const frame = node.querySelector('.smw-choice-wheel-frame').getBoundingClientRect();
          const wording = node.querySelector('.smw-activity-wording').getBoundingClientRect();
          const search = node.querySelector('.smw-choice-search').getBoundingClientRect();
          const status = node.querySelector('.smw-choice-wheel-status').getBoundingClientRect();
          return { frame, wording, search, status };
        });
        if (width > 900) {
          expect(Math.abs(geometry.frame.top - geometry.wording.top)).toBeLessThanOrEqual(.5);
          expect(geometry.search.top).toBeGreaterThanOrEqual(geometry.wording.bottom);
        } else {
          expect(geometry.search.bottom).toBeLessThanOrEqual(geometry.frame.top + .5);
          expect(geometry.wording.top).toBeGreaterThanOrEqual(geometry.status.bottom - .5);
        }
        expect(geometry.status.top).toBeGreaterThanOrEqual(geometry.frame.bottom);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(await layout.locator('.smw-activity-wording').evaluate(node =>
          node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      };
      const checkSelection = async key => {
        const wheel = page.getByRole('listbox');
        await wheel.press(key);
        const selected = wheel.getByRole('option', { selected: true });
        await expect(selected).toHaveCount(1);
        await expect.poll(() => selected.evaluate(node => {
          const option = node.getBoundingClientRect();
          const viewport = node.parentElement.getBoundingClientRect();
          return Math.abs(option.top + option.height / 2 - viewport.top - viewport.height / 2);
        })).toBeLessThanOrEqual(1);
        expect(await selected.evaluate(node =>
          node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
        await expect(frame).toHaveCSS('outline-style', 'solid');
        await checkGeometry();
      };
      const checkStates = async () => {
        await checkGeometry();
        await checkSelection('Home');
        const shortHeight = (await layout.locator('.smw-activity-wording').boundingBox()).height;
        await checkSelection('End');
        const longHeight = (await layout.locator('.smw-activity-wording').boundingBox()).height;
        expect(longHeight).toBeGreaterThan(shortHeight);
        const selectedLabel = await page.getByRole('option', { selected: true }).textContent();
        const search = page.getByRole('searchbox');
        await search.fill('Remembering');
        await expect(page.getByRole('option')).toHaveCount(1);
        await checkGeometry();
        await search.fill('zzzz-no-matching-choice');
        await expect(layout.locator('.smw-search-empty')).toContainText(`Selected: ${selectedLabel}`);
        await checkGeometry();
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
        await expect(search).toBeFocused();
        await expect(page.getByRole('option', { selected: true })).toHaveText(selectedLabel);
        await checkGeometry();
        await checkSelection('Home');
        await page.getByRole('listbox').press('ArrowDown');
        await expect(page.getByRole('option', { selected: true })).toHaveText(selectedLabel);
      };
      await checkStates(); // Sports Talent
      await page.getByRole('button', { name: 'Something funny', exact: true }).click();
      await checkStates();
      await page.locator('.smw-button-next').click();
      for (const category of ['activity', 'achievement', 'treat']) {
        await expect(layout).toHaveClass(new RegExp(`smw-searchable-${category}`));
        await checkStates();
        await page.locator('.smw-button-next').click();
      }
      // Country, county and state wheels share the same frame; the retained
      // wording preview and country-only action reflect the selected region.
      await checkGeometry();
      for (const [country, kind] of [['England', 'county'], ['United States', 'state']]) {
        await page.getByRole('searchbox').fill(country);
        await expect(page.getByRole('option')).toHaveCount(1);
        await page.getByRole('listbox').press('Home');
        await checkGeometry();
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
        await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
        await checkStates();
        await expect(layout.locator('.smw-wording-selection')).toHaveText(longLabel);
        await expect(page.getByRole('button', { name: `Use ${country} only`, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
        await checkGeometry();
      }
      await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
      await expect(layout.locator('.smw-search-empty')).toBeVisible();
      await checkGeometry();
      await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
      await layout.screenshot({ path: `generated-artifacts/workshop/stable-wheels-${width}-${scale}.png` });
    });
  }
}

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
      [6, 'Search fantasy and space destinations', 'moon', 'The Moon', 2],
    ]) {
      await expect(page.locator('.smw-step-count')).toHaveText(`Step ${index + 1} of 7`);
      if (index === 6) await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
      const input = page.getByRole('searchbox', { name: searchLabel, exact: true });
      if (index === 3) {
        await expect(page.locator('.smw-choice-search label')).toHaveCount(0);
        await expect(input).toHaveAttribute('placeholder', 'Mathletics or Listening');
      }
      if (index === 4) {
        await expect(page.locator('.smw-choice-search label')).toHaveCount(0);
        await expect(input).toHaveAttribute('placeholder', 'Try school or helping');
      }
      const checkChoiceAlignment = async () => {
        const geometry = await page.locator('.smw-searchable-layout').evaluate(layout => {
          const input = layout.querySelector('input').getBoundingClientRect();
          const wheel = layout.querySelector('.smw-choice-wheel-frame').getBoundingClientRect();
          const wording = layout.querySelector('.smw-activity-wording').getBoundingClientRect();
          return { inputBottom: input.bottom, inputTop: input.top, wheelBottom: wheel.bottom,
            wheelTop: wheel.top, wordingTop: wording.top, wordingBottom: wording.bottom };
        });
        if (viewport.width > 900) {
          expect(Math.abs(geometry.wordingTop - geometry.wheelTop)).toBeLessThanOrEqual(1);
          expect(geometry.inputTop - geometry.wordingBottom).toBeGreaterThanOrEqual(17);
        } else {
          expect(geometry.inputBottom).toBeLessThanOrEqual(geometry.wheelTop);
        }
      };
      await checkChoiceAlignment();
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
      await checkChoiceAlignment();
      await input.fill('no such choice');
      await expect(page.getByText('No matching choices. Try another word or clear the search.', { exact: true })).toBeVisible();
      await expect(page.locator('.smw-search-empty')).toContainText(`Selected: ${selected}`);
      await checkChoiceAlignment();
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
        await checkChoiceAlignment();
        await page.locator('.smw-searchable-layout').screenshot({ path: `generated-artifacts/workshop/achievement-search-stable-${viewport.width}.png` });
        if (viewport.width > 900) {
          await page.addStyleTag({ content: 'html { font-size: 200%; }' });
          await checkChoiceAlignment();
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
    await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: 'Search activities', exact: true })).toHaveValue('');
    await expect(page.getByRole('option', { name: 'Tidying away toys', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await storage()).toEqual(before);
    expect(posts).toEqual([]);
  });
}

for (const width of [1365, 320]) {
  test(`fantasy heading is screen-reader-only without adding wheel spacing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRegionalStage(page, workshopMixedDestinationFixture);
    await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
    const heading = page.getByRole('heading', { name: 'Choose a fantasy or space destination', exact: true });
    expect(await heading.evaluate(node => getComputedStyle(node).clipPath)).toBe('inset(50%)');
    const gap = await page.locator('.smw-destination-picker').evaluate(node =>
      node.querySelector('.smw-destination-picker__searchable').getBoundingClientRect().top
      - node.querySelector('.smw-talent-categories').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(20);
    await expect(page.getByRole('listbox')).toBeVisible();
  });

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
    await expectNoDestinationSummary(page);
    await expect(page.locator('.smw-destination-picker__regional .smw-wording-selection')).toHaveText('Kent');
    // Category controls remain keyboard-operable during regional browsing.
    await fantasy.focus();
    await page.keyboard.press('Enter');
    await expect(fantasy).toBeFocused();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
    const fantasyHeading = page.getByRole('heading', { name: 'Choose a fantasy or space destination', exact: true });
    await expect(fantasyHeading).toHaveClass(/smw-destination-picker__heading--accessible-only/);
    expect(await fantasyHeading.evaluate(node => getComputedStyle(node).clipPath)).toBe('inset(50%)');
    await expect(page.getByRole('option')).toHaveText(fantasyRecords.map(record => workshopDestinationLabel(record.label)));
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page.getByRole('searchbox')).not.toHaveAttribute('placeholder', /country/i);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    await expect(preview).toHaveCount(0);
    await expect(page.locator('.smw-destination-picker__selection')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Choose a (state|county)/ })).toHaveCount(0);
    await next.click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 7 of 7');
    const search = page.getByRole('searchbox');
    await search.fill('moon');
    await expect(page.getByRole('option')).toHaveText(['The Moon']);
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
    await expect(page.locator('.smw-step-count')).toHaveText('Step 7 of 7');

    let submitted;
    await page.route('**/api/santa-studio-message', route => {
      if (route.request().method() === 'GET') return route.fallback();
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: 'Fixture: no real recording requested.' } });
    });
    // Exercise every fantasy and real-space record through review, letter and
    // request submission without changing its catalogue recording identity.
    for (const record of fantasyRecords) {
      const label = workshopDestinationLabel(record.label);
      await page.getByRole('option', { name: label, exact: true }).click();
      await expect(preview).toHaveText(label);
      // Clicking the active category is not a switch and must keep the choice.
      await fantasy.click();
      await expect(preview).toHaveText(label);
      await next.click();
      await expect(page.locator('.smw-summary-row').last()).toContainText(label);
      const placeName = record.label.split(' — ')[0];
      await expect(page.locator('.studio-letter__paper').first()).toContainText(placeName);
      submitted = null;
      await confirmMessage(page, await page.locator('.smw-actions--review').getByRole('button', { name: 'Retry message', exact: true }).isVisible() ? 'Retry message' : 'Create message');
      await expect.poll(() => submitted?.place).toBe(record.id);
      expect(submitted).not.toHaveProperty('region');
      await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
      await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(preview).toHaveText(label);
    }
    await page.locator('.smw-button-back:visible').click();
    // Ordinary Back/Continue navigation also exposes the saved fantasy choice.
    await page.locator('.smw-button-back:visible').click();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('option', { selected: true })).toHaveText(workshopDestinationLabel(fantasyRecords.at(-1).label));
    await page.locator('.smw-button-back:visible').click();
    await next.click();
    await expect(fantasy).toHaveAttribute('aria-pressed', 'true');
    await expect(preview).toHaveText(workshopDestinationLabel(fantasyRecords.at(-1).label));
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
    await expect(page.locator('.smw-actions--review').getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
    await expect(page.getByText('Choose a destination to preview your keepsakes.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
    await expect(countries).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const [country, kind] of [
  ['United States', 'state'],
  ['England', 'county'],
  ['Wales', 'county'],
  ['Scotland', 'county'],
  ['Northern Ireland', 'county'],
]) {
  for (const width of [1365, 390, 320]) {
    test(`regional action placement ${country} ${width}: responsive unboxed action and keyboard`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openRegionalStage(page);
      if (width === 320) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      const countryHeading = page.getByRole('heading', { name: 'Choose a country or real place', exact: true });
      expect(await countryHeading.evaluate(node => getComputedStyle(node).clipPath)).toBe('inset(50%)');
      const wheelGap = await page.locator('.smw-destination-picker').evaluate(node => {
        const categories = node.querySelector('.smw-talent-categories').getBoundingClientRect();
        const content = node.querySelector('.smw-destination-picker__country').getBoundingClientRect();
        return content.top - categories.bottom;
      });
      expect(wheelGap).toBeGreaterThanOrEqual(0);
      expect(wheelGap).toBeLessThanOrEqual(20);
      await page.getByRole('option', { name: country, exact: true }).click();
      const action = page.getByRole('button', { name: `Choose a ${kind}`, exact: true });
      await expect(action).toHaveCount(1);
      const geometry = await page.locator('.smw-destination-picker__country').evaluate(node => {
        const status = node.querySelector('.smw-choice-wheel-status').getBoundingClientRect();
        const action = node.querySelector('.smw-destination-picker__region-action').getBoundingClientRect();
        const frame = node.querySelector('.smw-choice-wheel-frame').getBoundingClientRect();
        return { statusBottom: status.bottom, actionTop: action.top, actionBottom: action.bottom,
          frameBottom: frame.bottom, rightOffset: Math.abs(action.right - frame.right),
          centreOffset: Math.abs(action.x + action.width / 2 - frame.x - frame.width / 2),
          actionLeft: action.left, actionRight: action.right };
      });
      expect(geometry.actionTop).toBeGreaterThanOrEqual(geometry.frameBottom);
      if (width > 520) expect(geometry.actionTop - geometry.frameBottom).toBeLessThanOrEqual(8);
      if (width <= 760) expect(geometry.rightOffset).toBeLessThanOrEqual(1);
      else expect(geometry.centreOffset).toBeLessThanOrEqual(1);
      expect(geometry.actionLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.actionRight).toBeLessThanOrEqual(width);
      await expect(page.locator('.smw-destination-picker__region-prompt')).toHaveCount(0);
      await page.locator('.smw-builder').screenshot({
        path: `generated-artifacts/studio-destination-action-${country}-${width}.png`,
        animations: 'disabled',
      });
      await page.getByRole('listbox').focus();
      await page.keyboard.press('Tab');
      await expect(action).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: `${kind === 'state' ? 'States' : 'Counties'} in ${country}`, exact: true })).toBeFocused();
      const regional = page.locator('.smw-destination-picker__regional');
      await expect(regional.getByRole('button', { name: 'Back to countries', exact: true })).toHaveCount(0);
      await expect(regional.locator('.smw-destination-picker__regional-actions')).toHaveCount(0);
      const regionalHeading = regional.getByRole('heading', { level: 3 });
      expect(await regionalHeading.evaluate(node => getComputedStyle(node).clipPath)).toBe('inset(50%)');
      await regional.getByRole('option').first().click();
      const regionalGeometry = await regional.evaluate(node => {
        const wheel = node.querySelector('[role="listbox"]').getBoundingClientRect();
        const status = node.querySelector('.smw-choice-wheel-status').getBoundingClientRect();
        const actions = [...node.querySelectorAll('.smw-destination-picker__regional-actions button')]
          .map(button => button.getBoundingClientRect().toJSON());
        return { wheel: wheel.toJSON(), status: status.toJSON(), actions };
      });
      expect(regionalGeometry.actions).toHaveLength(1);
      await expect(regional.getByRole('button', { name: 'Back to countries', exact: true })).toHaveCount(0);
      await expect(regional.getByRole('button', { name: `Use ${country} only`, exact: true })).toBeVisible();
      for (const action of regionalGeometry.actions) {
        expect(action.top).toBeGreaterThanOrEqual(regionalGeometry.wheel.bottom);
        if (width > 520) expect(action.top - regionalGeometry.wheel.bottom).toBeLessThanOrEqual(8);
        expect(action.left).toBeGreaterThanOrEqual(regionalGeometry.wheel.left - 1);
        expect(action.right).toBeLessThanOrEqual(regionalGeometry.wheel.right + 1);
        expect(action.height).toBeGreaterThanOrEqual(44);
      }
      await page.locator('.smw-builder').screenshot({
        path: `generated-artifacts/studio-regional-actions-${country}-${width}.png`,
        animations: 'disabled',
      });
      await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Choose a country or real place', exact: true })).toBeFocused();
      await expect(page.getByRole('option', { name: country, exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('button', { name: `Choose a ${kind}`, exact: true }).click();
      await regional.getByRole('button', { name: `Use ${country} only`, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Choose a country or real place', exact: true })).toBeFocused();
      await expect(page.locator('.smw-destination-picker__country .smw-wording-selection')).toHaveText(country);
      await expect(page.getByRole('button', { name: `Use ${country} only`, exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
}

test('completed destination stays locked and back navigation preserves the recording', async ({ page }) => {
  const fixture = await mockStudioGeneration(page, { record: { id: `f-${'a'.repeat(64)}`, name: 'Arabella', variant: '' } });
  await page.unroute('**/api/santa-studio-message');
  await openRegionalStage(page, workshopMixedDestinationFixture);
  await page.evaluate(() => {
    window.revokedWorkshopUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.revokedWorkshopUrls.push(url); revoke(url); };
  });
  await page.getByRole('option', { name: 'England', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await confirmMessage(page);
  const download = page.getByRole('link', { name: 'Download MP3', exact: true });
  await expect(download).toBeVisible();
  const oldUrl = await download.getAttribute('href');
  await expect(page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fantasy & space', exact: true })).toHaveCount(0);
  await expect(page.getByText('England — locked', { exact: true })).toBeVisible();
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-actions--review').getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
  await expect(download).toHaveAttribute('href', oldUrl);
  expect(await page.evaluate(() => window.revokedWorkshopUrls)).not.toContain(oldUrl);
  expect(fixture.posts).toHaveLength(1);
});
