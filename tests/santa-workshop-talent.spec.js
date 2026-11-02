import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const helper = 'Now, my Head Elf tells me you have quite a talent! Apparently, there’s something you’re especially good at…';
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
  for (const label of ['Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest — Fantasy place']) {
    await page.getByRole('option', { name: label, exact: true }).click();
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
    await openTalent(page);
    const sports = page.getByRole('button', { name: 'Sports & activities', exact: true });
    const funny = page.getByRole('button', { name: 'Something funny', exact: true });
    await expect(sports).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[role=option][aria-selected=true]')).toHaveCount(0);
    await expect(next(page)).toBeDisabled();
    await expect(page.locator('.smw-activity-wording-quote')).toHaveText(helper);
    const search = page.getByRole('searchbox');
    await expect(search).toHaveAttribute('placeholder', 'Try Padel, Tennis or Golf');
    await search.fill('ten');
    await expect(page.getByRole('option')).toHaveCount(1);
    // Actual keyboard interaction with the established wheel, not synthetic focus.
    await page.getByRole('listbox').press('Home');
    await expect(page.getByRole('option', { name: 'Tennis', exact: true })).toHaveAttribute('aria-selected', 'true');
    await funny.click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(next(page)).toBeDisabled();
    await expect(page.locator('.smw-activity-wording-quote')).toHaveText(helper);
    await expect(page.getByRole('option', { name: 'Tennis', exact: true })).toHaveCount(0);
    await expect(search).not.toHaveAttribute('placeholder', /Padel|Tennis|Golf/);
    await search.fill('remote');
    await page.getByRole('option', { name: 'Stealing the remote control', exact: true }).click();
    // An actual switch must discard both filter and line, even on switch-back.
    await sports.click();
    await expect(search).toHaveValue('');
    await expect(next(page)).toBeDisabled();
    await expect(page.locator('[role=option][aria-selected=true]')).toHaveCount(0);
    await funny.click();
    await expect(next(page)).toBeDisabled();
    await page.getByRole('option', { name: 'Stealing the remote control', exact: true }).click();
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
    await sports.click();
    await expect(next(page)).toBeDisabled();
    await page.getByRole('option', { name: 'Cricket', exact: true }).click();
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
  await page.getByRole('button', { name: 'Something funny', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
  await finish(page);
  await expect(page.locator('.smw-summary-row').nth(2)).toContainText('Skipped');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
});
