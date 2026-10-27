import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

test.beforeEach(async ({ page }) => { await unlockWorkshop(page); });

const catalogue = structuredClone(workshopCatalogueFixture);
const choice = (id, label) => ({ id, label, file: `fixture/${id}.wav` });
Object.assign(catalogue.categories, {
  activity: [choice('tidy', 'Tidying away toys'), choice('share', 'Sharing toys with others'), choice('football', 'Playing football')],
  achievement: [choice('help', 'Helping with toys'), choice('brave', 'Being brave')],
  treat: [choice('chocolate', 'Hot chocolate'), choice('carrots', 'Carrots for reindeer')],
  place: [choice('england', 'England'), choice('moon', 'The Moon — Space destination'), choice('wonderland', 'Wonderland — Fantasy place')],
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
    await page.route('**/api/santa-names?inventory=hosted', route => route.fulfill({
      json: { records: [{ id: 'demrie', name: 'Demrie' }], hostedCount: 1, warning: null },
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
    const storage = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    const before = await storage();
    page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });

    for (const [index, searchLabel, term, selected, allCount] of [
      [3, 'Search activities', 'toys', 'Tidying away toys', 3],
      [4, 'Search achievements', 'toys', 'Helping with toys', 2],
      [5, 'Search treats', 'chocolate', 'Hot chocolate', 2],
      [6, 'Search locations', 'space', 'The Moon — Space destination', 3],
    ]) {
      await expect(page.locator('.smw-step-count')).toHaveText(`Step ${index} of 6`);
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
        await expect(input).toHaveAttribute('placeholder', 'Try a country or fantasy');
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
