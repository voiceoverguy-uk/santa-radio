import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { confirmMessage, mockStudioGeneration } from './helpers/studio-generation.js';

async function setup(page, paid = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-workshop-access', route => route.fulfill({ json: paid ? { authorized: false } : {
    authorized: true, expiresAt: Date.now() + 3600000,
    voucher: { code: 'fixture-two-creations', unlimited: false },
  } }));
  if (paid) await page.route('**/api/santa-studio-access', route => route.fulfill({
    json: { authorized: true, mode: 'sandbox' },
  }));
  const fixture = await mockStudioGeneration(page, { limited: true });
  await page.route('**/api/santa-workshop-catalogue*', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-names', route => route.fulfill({ json: { records: [
    { id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2', selectionToken: 'fixture',
      previewUrl: '/api/santa-name-preview?token=fixture' },
  ] } }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  return fixture;
}
async function review(page) {
  const search = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await search.fill('Dixie');
  await page.getByRole('option', { name: 'Dixie', exact: true }).click();
  await page.locator('.smw-actions .smw-button-next').click();
  for (const answer of ['9 years old', null, 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest']) {
    if (answer === null) { await page.getByRole('button', { name: 'Skip this section' }).click(); continue; }
    if (answer === 'The Enchanted Forest') await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
    await page.getByRole('option', { name: answer, exact: true }).click();
    await page.locator('.smw-actions .smw-button-next').click();
  }
}
const result = page => page.getByRole('region', { name: 'Your finished Santa message' });
async function gift(page, name) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  await download;
}
for (const width of [1365, 390]) {
  test(`lost paid response can start over using its remaining slot at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = await setup(page, true);
    fixture.dropAfterCommit = true;
    await review(page); await confirmMessage(page);
    await expect(page.locator('.smw-remaining')).toContainText('1 of 2 creations remaining');
    await expect(result(page)).toHaveCount(0);
    await confirmMessage(page, 'Retry message');
    await expect(page.getByRole('alert')).toContainText('This creation already completed');
    await expect(page.locator('.smw-remaining')).toContainText('1 of 2 creations remaining');
    await page.getByRole('button', { name: 'Start Again', exact: true }).click();
    await review(page); await confirmMessage(page);
    await expect(result(page)).toBeVisible();
    await expect(page.locator('.smw-remaining')).toContainText('0 of 2 creations remaining');
    expect(fixture.operationIds).toHaveLength(3);
    expect(fixture.operationIds[0]).toBe(fixture.operationIds[1]);
    expect(fixture.operationIds[2]).not.toBe(fixture.operationIds[0]);
    await expect(page.getByRole('button', { name: /^(Create message|Start Again|Create 1 more\?)$/ })).toHaveCount(0);
  });
  test(`paid return keeps remaining allowance without recovering audio at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = await setup(page, true);
    await review(page); await confirmMessage(page);
    await expect(result(page)).toBeVisible();
    await expect(page.locator('.smw-remaining')).toContainText('1 of 2 creations remaining');
    await page.reload();
    await expect(page.locator('.smw-remaining')).toContainText('1 of 2 creations remaining');
    await expect(result(page)).toHaveCount(0);
    await review(page); await confirmMessage(page);
    await expect(result(page)).toBeVisible();
    await expect(page.locator('.smw-remaining')).toContainText('0 of 2 creations remaining');
    await expect(page.getByRole('button', { name: /^(Create message|Start Again|Create 1 more\?)$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'READY', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download MP3' })).toBeVisible();
    expect(fixture.posts).toHaveLength(2);
    expect(fixture.recoveries || 0).toBe(0);
  });
  for (const requested of ['none', 'partial', 'all']) {
    test(`two creations and ${requested} gift requests at ${width}px`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 900 });
      const fixture = await setup(page);
      await review(page);
      // A written spelling, not the recorded name, belongs in the reminder.
      await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
      await page.getByRole('textbox', { name: /spelling|written name/i }).fill('Dixie Rose');
      await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
      fixture.fail = true;
      await confirmMessage(page);
      await expect(page.getByRole('alert')).toContainText('Fixture recording unavailable');
      expect(fixture.state.remaining).toBe(2);
      fixture.fail = false;
      await confirmMessage(page, 'Retry message');
      await expect(result(page)).toBeVisible();
      await expect(page.locator('.smw-remaining')).toContainText('1 of 2 creations remaining');
      const original = await result(page).locator('audio').getAttribute('src');
      // Enlarging a gift is not a download request.
      await page.getByRole('button', { name: 'Enlarge certificate', exact: true }).click();
      await page.keyboard.press('Escape');
      if (requested !== 'none') await gift(page, 'Download certificate (PDF)');
      if (requested === 'all') {
        await gift(page, 'Download letter (PDF)');
        await gift(page, 'Download Santa picture (PNG)');
      }
      const again = page.getByRole('button', { name: 'Create 1 more?', exact: true });
      await again.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading')).toHaveText(requested === 'all'
        ? 'Save your MP3 before you start again'
        : 'Did you want to download your gifts for Dixie Rose before you start again?');
      await expect(dialog).toContainText('Download and save your MP3');
      await expect(dialog.getByRole('button', { name: 'Back to gifts', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(result(page).locator('audio')).toHaveAttribute('src', original);
      await again.click();
      await page.getByRole('button', { name: 'Back to gifts', exact: true }).click();
      await expect(result(page).locator('audio')).toHaveAttribute('src', original);
      await again.click();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Continue anyway', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Back to gifts', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Continue anyway', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(result(page)).toHaveCount(0);
      await review(page);
      await confirmMessage(page);
      await expect(result(page)).toBeVisible();
      await expect(page.locator('.smw-remaining')).toContainText('0 of 2 creations remaining');
      for (const label of ['Create 1 more?', 'Start Again', 'Create message', 'Retry message']) {
        await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'READY', exact: true }).click();
      await expect(result(page).locator('audio')).toBeVisible();
      for (let n = 0; n < 2; n++) {
        const download = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Download MP3' }).click();
        await download;
        await gift(page, 'Download certificate (PDF)');
        await gift(page, 'Download letter (PDF)');
        await gift(page, 'Download Santa picture (PNG)');
      }
      expect(fixture.posts.length).toBe(3); // one failure, two successes
      await page.reload();
      await expect(result(page)).toHaveCount(0);
      await review(page);
      await expect(page.locator('.smw-remaining')).toContainText('0 of 2 creations remaining');
      await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
      expect(fixture.recoveries || 0).toBe(0);
      expect(fixture.posts.length).toBe(3);
    });
  }
  test(`gift export failure and pending export cannot bypass reset at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = await setup(page);
    await review(page); await confirmMessage(page);
    await expect(result(page)).toBeVisible();
    let release;
    const wait = new Promise(resolve => release = resolve);
    await page.route('**/certificates/nice-list/master.pdf', async route => {
      await wait; await route.fulfill({ status: 503, body: 'fixture export failed' });
    });
    await page.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create 1 more?', exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('button', { name: 'Retry download certificate (pdf)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create 1 more?', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(
      'Did you want to download your gifts for Dixie before you start again?');
    await page.getByRole('button', { name: 'Back to gifts', exact: true }).click();
    expect(fixture.state.remaining).toBe(1);
    await expect(result(page)).toBeVisible();
    await page.reload();
    await review(page);
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator('.smw-remaining')).toContainText('1 of 2 creations remaining');
  });
}
