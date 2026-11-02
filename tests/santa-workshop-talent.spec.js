import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture, workshopTalentPreviewCatalogueFixture } from './fixtures/workshop-catalogue.js';

const helper = 'Now, my Head Elf tells me you have quite a talent! Apparently, there’s something you’re especially good at… In particular...';
const quote = page => page.locator('.smw-activity-wording-quote');
async function expectTalentPreview(page, label = '') {
  await expect(quote(page)).toHaveText(label ? `${helper} ${label}` : helper);
  await expect(quote(page).locator('.smw-wording-selection')).toHaveCount(label ? 1 : 0);
}

async function expectPreviewFits(page) {
  const fits = await quote(page).evaluate(element => {
    const box = element.closest('aside').getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()].every(rect =>
      rect.left >= box.left - 1 && rect.right <= box.right + 1
      && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1)
      && element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1;
  });
  expect(fits, 'All preview text fits inside its box without clipping').toBe(true);
}

const next = page => page.locator('.smw-button-next');
async function openTalent(page, catalogue = workshopCatalogueFixture) {
  await unlockWorkshop(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: catalogue }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-names', route => route.fulfill({ json: { records: [{
    id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2',
    selectionToken: 'test-selection', previewUrl: '/api/santa-name-preview?token=test',
  }] } }));
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dixie');
  await page.getByRole('option', { name: /Dixie/ }).click();
  await next(page).click();
  await page.getByRole('listbox', { name: 'Their age', exact: true }).press('Home');
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'What are they especially good at?', exact: true })).toBeFocused();
  await expect(page.locator('.smw-step-count')).toHaveText('Step 3 of 8');
}
async function finish(page) {
  const expectedSelections = ['Teamwork', 'Completing a jigsaw puzzle', 'a bûche de Noël', 'The Enchanted Forest — Fantasy place'];
  let index = 0;
  for (const label of ['Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest — Fantasy place']) {
    await page.getByRole('option', { name: label, exact: true }).click();
    await expect(quote(page).locator('.smw-wording-selection')).toHaveText(` ${expectedSelections[index++]}`);
    await next(page).click();
  }
  await expect(page.locator('.smw-step-count')).toHaveText('Step 8 of 8 · Review');
  await expect(page.locator('.smw-stage-number')).toHaveText('08');
  await expect(page.locator('.smw-summary-row')).toHaveCount(7);
}

for (const width of [320, 1440]) {
  test(`talent ${width}: one selection, search/category reset, review edits, skip and stale audio`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 320 ? 750 : 1000 });
    const requests = [];
    await page.route('**/api/santa-studio-message', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('generated-artifacts/studio-test-message.mp3') });
    });
    await openTalent(page, workshopTalentPreviewCatalogueFixture);
    const sports = page.getByRole('button', { name: 'Sports & activities', exact: true });
    const funny = page.getByRole('button', { name: 'Something funny', exact: true });
    await expect(sports).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[role=option][aria-selected=true]')).toHaveCount(0);
    await expect(next(page)).toBeDisabled();
    await expectTalentPreview(page);
    const search = page.getByRole('searchbox');
    await expect(search).toHaveAttribute('placeholder', 'Try Padel, Tennis or Golf');
    await search.fill('ten');
    await expect(page.getByRole('option')).toHaveCount(1);
    // Actual keyboard interaction with the established wheel, not synthetic focus.
    await page.getByRole('listbox').press('Home');
    await expect(page.getByRole('option', { name: 'Tennis', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expectTalentPreview(page, 'Tennis');
    await expectPreviewFits(page);
    await search.fill('no matching sport');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expectTalentPreview(page, 'Tennis');
    await funny.click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('option')).toHaveCount(4);
    await expect(next(page)).toBeDisabled();
    await expectTalentPreview(page);
    await expect(page.getByRole('option', { name: 'Tennis', exact: true })).toHaveCount(0);
    await expect(search).not.toHaveAttribute('placeholder', /Padel|Tennis|Golf/);
    await search.fill('remote');
    await page.getByRole('option', { name: 'Stealing the remote control', exact: true }).click();
    await expectTalentPreview(page, 'Stealing the remote control');
    await search.fill('');
    await page.getByRole('option', { name: 'Watching tv all day', exact: true }).click();
    await expectTalentPreview(page, 'Watching tv all day');
    const longLabel = workshopTalentPreviewCatalogueFixture.categories.funny.at(-1).label;
    await page.getByRole('option', { name: longLabel, exact: true }).click();
    await expectTalentPreview(page, longLabel);
    await expectPreviewFits(page);
    await page.locator('.smw-activity-wording').screenshot({ path: `generated-artifacts/talent/long-preview-${width}.png` });
    // An actual switch must discard both filter and line, even on switch-back.
    await sports.click();
    await expectTalentPreview(page);
    await expect(search).toHaveValue('');
    await expect(next(page)).toBeDisabled();
    await expect(page.locator('[role=option][aria-selected=true]')).toHaveCount(0);
    await funny.click();
    await expect(next(page)).toBeDisabled();
    await expectTalentPreview(page);
    await page.getByRole('option', { name: 'Stealing the remote control', exact: true }).click();
    await expectTalentPreview(page, 'Stealing the remote control');
    const bounds = await page.locator('.smw-talent-categories').boundingBox();
    const wheel = await page.locator('.smw-choice-wheel-frame').boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(wheel.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('.smw-builder').screenshot({ path: `generated-artifacts/talent/step-${width}.png` });
    await next(page).click();
    await finish(page);
    const summary = page.locator('.smw-summary-row').nth(2);
    await expect(summary).toContainText('Talent');
    await expect(summary).toContainText('Something funny — Stealing the remote control');
    const detailsBefore = await page.locator('.smw-summary-row').allTextContents();
    const letterBefore = await page.locator('.studio-gifts__gallery .studio-letter__text > p').allTextContents();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
    expect(requests[0].talent).toEqual({ category: 'funny', id: `c-${'c'.repeat(64)}` });
    expect(requests[0].name).toBe('dixie-variant');
    await page.getByRole('button', { name: 'Change Talent', exact: true }).click();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
    await expect(funny).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('option', { name: 'Stealing the remote control', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expectTalentPreview(page, 'Stealing the remote control');
    await sports.click();
    await expectTalentPreview(page);
    await expect(next(page)).toBeDisabled();
    await page.getByRole('option', { name: 'Cricket', exact: true }).click();
    await expectTalentPreview(page, 'Cricket');
    await next(page).click();
    await expect(summary).toContainText('Sports & activities — Cricket');
    const detailsAfter = await page.locator('.smw-summary-row').allTextContents();
    for (const i of [0, 1, 3, 4, 5, 6]) expect(detailsAfter[i]).toBe(detailsBefore[i]);
    expect(await page.locator('.studio-gifts__gallery .studio-letter__text > p').allTextContents()).toEqual(letterBefore);
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
    expect(requests[1].talent).toEqual({ category: 'sports', id: `c-${'d'.repeat(64)}` });
    await page.getByRole('button', { name: 'Change Talent', exact: true }).click();
    await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
    await expect(summary).toContainText('Skipped');
    await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
    await page.getByRole('button', { name: 'Change Talent', exact: true }).click();
    await expectTalentPreview(page);
    await expect(page.locator('[role=option][aria-selected=true]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
    expect(requests[2].talent).toEqual({ skip: true });
    expect(requests[2].name).toBe('dixie-variant');
  });
}

test('original or empty hosted groups offer deliberate skip, never fixture choices', async ({ page }) => {
  const original = structuredClone(workshopCatalogueFixture);
  delete original.categories.sports; delete original.categories.funny;
  delete original.counts.sports; delete original.counts.funny;
  await openTalent(page, original);
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.getByText('There are no selectable talent choices in this hosted category right now.')).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await expectTalentPreview(page);
  await page.getByRole('button', { name: 'Something funny', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(0);
  await expectTalentPreview(page);
  await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
  await finish(page);
  await expect(page.locator('.smw-summary-row').nth(2)).toContainText('Skipped');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
});

test('switching from a selected talent to an unavailable category clears its preview', async ({ page }) => {
  const catalogue = structuredClone(workshopCatalogueFixture);
  catalogue.categories.funny = [];
  catalogue.counts.funny = 0;
  await openTalent(page, catalogue);
  await page.getByRole('option', { name: 'Tennis', exact: true }).click();
  await expectTalentPreview(page, 'Tennis');
  await page.getByRole('button', { name: 'Something funny', exact: true }).click();
  await expectTalentPreview(page);
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sports & activities', exact: true }).click();
  await expectTalentPreview(page);
  await expect(next(page)).toBeDisabled();
});
