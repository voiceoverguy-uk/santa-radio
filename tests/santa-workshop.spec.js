import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

const path = '/santa-message-workshop';
const answers = ['Demrie', '9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest — Fantasy place'];
const hostedRecords = [
  { id: 'demrie', name: 'Demrie' }, { id: 'zara', name: 'Zara' },
  { id: 'dixie', name: 'Dixie', variant: 'dixie.wav' },
  { id: 'dixie3', name: 'Dixie', variant: 'dixie3.wav' },
];

test('mobile first load keeps Studio panels inside the viewport without horizontal panning', async ({ page }) => {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    const overflow = await page.locator('.smw-page').evaluate(root =>
      [root, ...root.querySelectorAll('.smw-shell, .smw-intro, .smw-preview-note, .smw-builder, .smw-stage, .smw-activity-preview-layout')]
        .map(node => ({ element: node.className, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }))
        .filter(rect => rect.left < -1 || rect.right > innerWidth + 1));
    expect(overflow, `Studio panel bounds at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.evaluate(() => window.scrollTo({ left: 150, top: 0, behavior: 'instant' }));
    expect(await page.evaluate(() => scrollX)).toBe(0);
    if (width === 430) await page.screenshot({ path: 'test-results/studio-mobile-first-load.png' });
  }
});

test.beforeEach(async ({ page }) => {
  await unlockWorkshop(page);
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-names?inventory=hosted', route => route.fulfill({
    json: { records: hostedRecords, hostedCount: hostedRecords.length, warning: null },
  }));
});

async function open(page) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  await page.evaluate(() => document.fonts.ready);
}

async function photograph(page, file) {
  await page.evaluate(async () => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: file, fullPage: true });
}

test('Studio hides progress captions only on mobile, retaining the bars and current step', async ({ page }) => {
  await open(page);
  for (const width of [320, 390, 430, 760, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.smw-progress-segment')).toHaveCount(6);
    await expect(page.locator('.smw-progress')).toBeVisible();
    await expect(page.locator('.smw-step-count')).toBeVisible();
    if (width <= 760) await expect(page.locator('.smw-step-labels')).toBeHidden();
    else await expect(page.locator('.smw-step-labels')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.smw-builder').screenshot({ path: 'test-results/workshop-progress-mobile.png' });
});

test('Studio hides the radio dock and footer only on mobile and restores them elsewhere', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('.radio-dock')).toBeHidden();
  await expect(page.locator('.footer')).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.radio-dock')).toBeVisible();
  await expect(page.locator('.footer')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.radio-dock')).toBeHidden();
  await expect(page.locator('.footer')).toBeHidden();
  await page.goto('/');
  await expect(page.locator('.radio-dock')).toBeVisible();
  await expect(page.locator('.footer')).toBeVisible();
});

async function browseToAge(page, label) {
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await wheel.focus();
  await page.keyboard.press('Home');
  const index = await wheel.getByRole('option', { name: label, exact: true }).evaluate(node =>
    Array.from(node.parentElement.querySelectorAll('[role=option]')).indexOf(node));
  for (let position = 0; position < index; position++) await page.keyboard.press('ArrowDown');
  await expect(wheel.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function openAgeStage(page) {
  await open(page);
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dem');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-step-count')).toHaveText('Step 2 of 6');
}

async function complete(page, keyboard = false) {
  for (let index = 0; index < answers.length; index++) {
    await expect(page.locator('.smw-step-count')).toHaveText(`Step ${index + 1} of 6`);
    if (page.viewportSize().width <= 760) {
      await expect(page.locator('.radio-dock')).toBeHidden();
      const bounds = await page.locator('.smw-builder').evaluate(node => {
        const rect = node.getBoundingClientRect();
        window.scrollTo({ left: 100, top: scrollY, behavior: 'instant' });
        return { left: rect.left, right: rect.right, viewport: innerWidth, scroll: scrollX, width: document.documentElement.scrollWidth };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
      expect(bounds.width).toBeLessThanOrEqual(bounds.viewport + 1);
      expect(bounds.scroll).toBe(0);
    }
    await expect(page.locator('.smw-activity-wording')).not.toContainText('A wording preview');
    await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
    if (index > 0) await expect(page.locator('.smw-activity-wording-quote')).not.toContainText('—');
    if (index === 3) await expect(page.locator('.smw-stage-heading h3')).toHaveText('What deserves an extra celebration?');
    if (index === 4) {
      await expect(page.locator('.smw-stage-heading h3')).toHaveText('What might they leave Santa?');
      await expect(page.locator('.smw-stage-heading p')).toHaveCount(0);
    }
    if (index === 5) await expect(page.locator('.smw-stage-heading h3')).toHaveText('Santa would like to know where he’s going?');
    if (!index) {
      await expect(page.getByText('Quiet workshop feedback only; independent of Santa Radio playback.', { exact: true })).toHaveCount(0);
      const search = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
      await expect(page.locator('.smw-stage-heading p')).toHaveCount(0);
      const introCard = page.getByRole('complementary', { name: 'Santa will say…', exact: true });
      await expect(introCard).toContainText('Ho ho ho, hello, Santa here… I’ve a very special message for… ah yes…');
      await expect(introCard).not.toContainText('Preview wording only.');
      await search.fill(answers[0]);
      if (keyboard) {
        await search.press('ArrowDown');
        await search.press('Enter');
      } else await page.getByRole('option', { name: answers[0], exact: true }).click();
      await expect(page.locator('.smw-name-status')).toContainText(answers[0]);
      await page.keyboard.press('Tab');
      await expect(page.locator('.smw-button-next')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
      continue;
    }
    const option = page.getByRole('option', { name: answers[index], exact: true });
    await expect(page.locator('.smw-page [role=option][aria-selected=true]')).toHaveCount(0);
    if (index === 1) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('listbox', { name: 'Their age', exact: true })).toBeFocused();
      await browseToAge(page, answers[index]);
      if (keyboard) {
        await page.keyboard.press('Tab'); // Back
        await page.keyboard.press('Tab'); // Continue
        await expect(page.locator('.smw-button-next')).toBeFocused();
        await page.keyboard.press('Enter');
      } else await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
      continue;
    }
    if (keyboard) {
      // Each wheel is a single tab stop; Space chooses the centred item.
      await page.keyboard.press('Tab');
      // Searchable categories have their filter field before the wheel.
      if (await page.getByRole('searchbox').count()) {
        await expect(page.getByRole('searchbox')).toBeFocused();
        await page.keyboard.press('Tab');
      }
      await expect(page.getByRole('listbox')).toBeFocused();
      await page.keyboard.press('Space');
      await expect(option).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // Back then Continue.
      await expect(page.locator('.smw-button-next')).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await option.click();
      await expect(option).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.smw-page [role=option][aria-selected=true]')).toHaveCount(1);
      await page.locator('.smw-button-next').click();
    }
    await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
  }
  await expect(page.locator('.smw-summary-row')).toHaveCount(6);
}

for (const viewport of [
  { width: 1365, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568, enlarged: true },
]) {
  test(`step two to six wording ${viewport.width}: quote layout, clean wheels and preserved choices`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openAgeStage(page);
    await expect(page.locator('.smw-stage-heading h3')).toHaveText('How old are they?');
    await expect(page.locator('.smw-stage-heading p')).toHaveCount(0);
    await expect(page.getByText('Choose the age to help remind Santa.', { exact: true })).toHaveCount(0);
    if (viewport.enlarged) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    const ageCard = page.getByRole('complementary', { name: 'Santa will say…', exact: true }).filter({ hasText: 'Hello, Santa here' });
    await expect(ageCard).toContainText('Hello, Santa here… I’ve a very special message for… ah yes… Demrie. But have I got the right one? Let me check your age. I believe you are…');
    await expect(ageCard).not.toContainText('Preview wording only.');
    const ageBox = await page.locator('.smw-age-wheel').boundingBox();
    const ageCardBox = await ageCard.boundingBox();
    if (viewport.width > 900) {
      expect(ageCardBox.x).toBeGreaterThanOrEqual(ageBox.x + ageBox.width + 10);
      expect(Math.abs(ageCardBox.y - ageBox.y)).toBeLessThanOrEqual(1);
    }
    else expect(ageCardBox.y).toBeGreaterThanOrEqual(ageBox.y + ageBox.height);
    expect(await ageCard.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByRole('listbox', { name: 'Their age', exact: true }).locator('[aria-selected=true]')).toHaveCount(0);
    if (!viewport.enlarged) await page.screenshot({ path: `test-results/workshop-age-wording-${viewport.width}.png` });
    await page.getByRole('listbox', { name: 'Their age', exact: true }).press('Home');
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 3 of 6');
    const card = page.getByRole('complementary', { name: 'Santa will say:', exact: true });
    await expect(card).toContainText('I’ve heard you’ve been super good, in fact, positively amazing this year… trying especially hard at…');
    const wordLayout = await card.locator('.smw-activity-wording-quote').evaluate(node => {
      const style = getComputedStyle(node);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        const start = text.textContent.indexOf('especially');
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + 'especially'.length);
        return { hyphens: style.hyphens, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak, fragments: range.getClientRects().length };
      }
      return null;
    });
    expect(wordLayout).toEqual({ hyphens: 'none', overflowWrap: 'normal', wordBreak: 'normal', fragments: 1 });
    await expect(card).not.toContainText('Preview wording only.');
    await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
    await expect(page.locator('.smw-choice-wheel-count')).toHaveCount(0);
    const wheel = page.getByRole('listbox', { name: 'Something they do', exact: true });
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(0);
    const panelBox = await card.boundingBox();
    const wheelBox = await page.locator('.smw-choice-wheel-frame').boundingBox();
    if (viewport.width > 900) {
      expect(panelBox.x).toBeGreaterThanOrEqual(wheelBox.x + wheelBox.width + 10);
      expect(Math.abs(panelBox.y - wheelBox.y)).toBeLessThanOrEqual(1);
    }
    else expect(panelBox.y).toBeGreaterThanOrEqual(wheelBox.y + wheelBox.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-validation')).toContainText('Please choose');
    await wheel.press('Home');
    await expect(wheel.locator('[aria-selected=true]')).toContainText('Teamwork');
    if (!viewport.enlarged) {
      await page.screenshot({ path: `test-results/workshop-step-three-${viewport.width}.png` });
    }
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(card).toHaveCount(0);
    await page.locator('.smw-button-next').click();
    await expect(wheel.locator('[aria-selected=true]')).toContainText('Teamwork');
    await expect(card).toBeVisible();
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 4 of 6');
    await expect(card).toHaveCount(0);
    await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
    await expect(page.locator('.smw-choice-wheel-count')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Santa will say…', exact: true })).toBeVisible();
    const celebration = page.getByRole('complementary', { name: 'Santa will say…', exact: true }).filter({ hasText: 'I was also delighted to hear' });
    await expect(page.locator('.smw-stage-heading h3')).toHaveText('What deserves an extra celebration?');
    await expect(celebration).toContainText('I was also delighted to hear how amazing you’ve been at…');
    await expect(celebration).not.toContainText('Preview wording only.');
    const achievement = page.getByRole('listbox', { name: 'An achievement', exact: true });
    await expect(achievement).toHaveAccessibleName('An achievement');
    await expect(achievement.locator('[aria-selected=true]')).toHaveCount(0);
    const achievementBox = await page.locator('.smw-choice-wheel-frame').boundingBox();
    const celebrationBox = await celebration.boundingBox();
    if (viewport.width > 900) {
      expect(celebrationBox.x).toBeGreaterThanOrEqual(achievementBox.x + achievementBox.width + 10);
      expect(Math.abs(celebrationBox.y - achievementBox.y)).toBeLessThanOrEqual(1);
    }
    else expect(celebrationBox.y).toBeGreaterThanOrEqual(achievementBox.y + achievementBox.height);
    expect(await page.locator('.smw-wheel-accessible-text').evaluateAll(nodes => nodes.every(node => {
      const rect = node.getBoundingClientRect();
      return getComputedStyle(node).clipPath === 'inset(50%)' && rect.width <= 1 && rect.height <= 1;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await celebration.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    if (!viewport.enlarged) await page.screenshot({ path: `test-results/workshop-step-four-${viewport.width}.png` });
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-validation')).toContainText('Please choose');
    await achievement.press('Home');
    const chosen = await achievement.locator('[aria-selected=true]').textContent();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('.smw-button-next').click();
    await expect(achievement.locator('[aria-selected=true]')).toContainText(chosen.trim());
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 5 of 6');
    await expect(celebration).toHaveCount(0);
    const treatCard = page.getByRole('complementary', { name: 'Santa will say…', exact: true }).filter({ hasText: 'We do like a little treat' });
    await expect(treatCard).toContainText('We do like a little treat when we arrive on Christmas Eve… and… I know you like to leave me…');
    await expect(treatCard).not.toContainText('Preview wording only.');
    await expect(page.locator('.smw-choice-wheel-count')).toHaveCount(0);
    await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
    await expect(page.getByText('Quiet workshop feedback only; independent of Santa Radio playback.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('listbox', { name: 'A festive treat', exact: true })).toHaveAccessibleName('A festive treat');
    const treatWheel = page.getByRole('listbox', { name: 'A festive treat', exact: true });
    await expect(treatWheel.locator('[aria-selected=true]')).toHaveCount(0);
    const treatBox = await page.locator('.smw-choice-wheel-frame').boundingBox();
    const treatCardBox = await treatCard.boundingBox();
    if (viewport.width > 900) {
      expect(treatCardBox.x).toBeGreaterThanOrEqual(treatBox.x + treatBox.width + 10);
      expect(Math.abs(treatCardBox.y - treatBox.y)).toBeLessThanOrEqual(1);
    }
    else expect(treatCardBox.y).toBeGreaterThanOrEqual(treatBox.y + treatBox.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await treatCard.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await page.locator('.smw-choice-wheel-heading, .smw-choice-wheel-hint').evaluateAll(nodes => nodes.length === 2 && nodes.every(node => {
      const rect = node.getBoundingClientRect();
      return getComputedStyle(node).clipPath === 'inset(50%)' && rect.width <= 1 && rect.height <= 1;
    }))).toBe(true);
    if (!viewport.enlarged) await page.screenshot({ path: `test-results/workshop-step-five-${viewport.width}.png` });
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-validation')).toContainText('Please choose');
    await treatWheel.press('Home');
    const chosenTreat = await treatWheel.locator('[aria-selected=true]').textContent();
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 6 of 6');
    await expect(treatCard).toHaveCount(0);
    await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
    await expect(page.getByText('Quiet workshop feedback only; independent of Santa Radio playback.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('listbox', { name: 'A magical place', exact: true })).toHaveAccessibleName('A magical place');
    await expect(page.locator('.smw-stage-heading h3')).toHaveText('Santa would like to know where he’s going?');
    await expect(page.locator('.smw-stage-heading p')).toHaveCount(0);
    await expect(page.getByText('Choose from real places, space destinations and storybook places.', { exact: true })).toHaveCount(0);
    await expect(page.locator('.smw-stage-note')).toHaveText('The list includes countries and real places. Fantasy places and space destinations are labelled separately.');
    expect(await page.locator('.smw-choice-wheel-heading, .smw-choice-wheel-hint').evaluateAll(nodes => nodes.length === 2 && nodes.every(node => {
      const rect = node.getBoundingClientRect();
      return getComputedStyle(node).clipPath === 'inset(50%)' && rect.width <= 1 && rect.height <= 1;
    }))).toBe(true);
    await expect(page.locator('.smw-choice-wheel-count')).toHaveCount(0);
    const destinationCard = page.getByRole('complementary', { name: 'Santa will say…', exact: true }).filter({ hasText: 'Head Elf' });
    await expect(destinationCard).toContainText('Anyway, as I sit here reading this, Head Elf has just reminded me where we’re coming to… Ah yes…');
    await expect(destinationCard).not.toContainText('Preview wording only.');
    const destinationWheel = page.getByRole('listbox', { name: 'A magical place', exact: true });
    await expect(destinationWheel.locator('[aria-selected=true]')).toHaveCount(0);
    const destinationBox = await page.locator('.smw-choice-wheel-frame').boundingBox();
    const destinationCardBox = await destinationCard.boundingBox();
    if (viewport.width > 900) {
      expect(destinationCardBox.x).toBeGreaterThanOrEqual(destinationBox.x + destinationBox.width + 10);
      expect(Math.abs(destinationCardBox.y - destinationBox.y)).toBeLessThanOrEqual(1);
    }
    else expect(destinationCardBox.y).toBeGreaterThanOrEqual(destinationBox.y + destinationBox.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await destinationCard.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    if (!viewport.enlarged) await page.screenshot({ path: `test-results/workshop-destination-wording-${viewport.width}.png` });
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-validation')).toContainText('Please choose');
    await destinationWheel.press('Home');
    const chosenDestination = await destinationWheel.locator('[aria-selected=true]').textContent();
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-summary')).toContainText(chosenDestination.trim());
    await expect(destinationCard).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(destinationWheel.locator('[aria-selected=true]')).toContainText(chosenDestination.trim());
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(treatWheel.locator('[aria-selected=true]')).toContainText(chosenTreat.trim());
    await expect(treatCard).toBeVisible();
    await expect(page.locator('.smw-builder audio, .smw-builder video')).toHaveCount(0);
  });
}

for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
  for (const entry of ['pointer', 'keyboard']) {
    test(`name entry ${viewport.width} ${entry}: focus keeps typing and choosing stable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await open(page);
      const initialTop = await page.locator('.smw-builder').evaluate(node => node.getBoundingClientRect().top);
      await page.evaluate(() => {
        window.__entryAlignCalls = 0;
        const original = window.scrollTo;
        window.scrollTo = function (...args) {
          window.__entryAlignCalls++;
          return original.apply(this, args);
        };
      });
      const search = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
      const nameCard = page.getByRole('complementary', { name: 'Santa will say…', exact: true });
      await expect(nameCard).toContainText('Ho ho ho, hello, Santa here… I’ve a very special message for… ah yes…');
      await expect(page.locator('.smw-stage-heading p')).toHaveCount(0);
      const searchBox = await search.boundingBox();
      const cardBox = await nameCard.boundingBox();
      if (viewport.width > 900) {
        expect(cardBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width + 10);
        expect(Math.abs(cardBox.y - searchBox.y)).toBeLessThanOrEqual(1);
      } else expect(cardBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height);
      if (entry === 'keyboard') {
        await page.locator('.smw-stage-heading h3').focus();
        await page.keyboard.press('Tab');
      } else await search.click();
      await expect(search).toBeFocused();
      const focusStyle = await search.evaluate(node => {
        const style = getComputedStyle(node);
        return { outline: style.outlineStyle, offset: style.outlineOffset, shadow: style.boxShadow };
      });
      expect(focusStyle.outline).toBe('solid');
      expect(focusStyle.offset).toBe('-4px');
      expect(focusStyle.shadow).toContain('inset');
      if (viewport.width > 900) {
        const focusedSearchBox = await search.boundingBox();
        const focusedCardBox = await nameCard.boundingBox();
        expect(Math.abs(focusedCardBox.y - focusedSearchBox.y)).toBeLessThanOrEqual(1);
      }
      if (viewport.width > 1024) {
        await expect.poll(() => page.evaluate(() => {
        const intended = scrollY + document.querySelector('.smw-builder').getBoundingClientRect().top
          - document.querySelector('.navbar').getBoundingClientRect().bottom - 16;
        // Short mobile stages cannot be aligned past the end of the document.
        const maximum = document.documentElement.scrollHeight - innerHeight;
        return Math.abs(scrollY - Math.min(Math.max(0, intended), maximum));
        })).toBeLessThanOrEqual(1);
        const raisedTop = await page.locator('.smw-builder').evaluate(node => node.getBoundingClientRect().top);
        expect(initialTop - raisedTop).toBeGreaterThan(50);
      } else {
        await expect(search).toBeInViewport();
      }
      const y = await page.evaluate(() => scrollY);
      await search.pressSequentially('Dem');
      await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
      await expect(search).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBe(y);
      if (entry === 'keyboard') {
        await search.press('ArrowDown');
        await search.press('Enter');
      } else await page.getByRole('option', { name: 'Demrie', exact: true }).click();
      await expect(page.locator('.smw-name-status')).toContainText('Demrie');
      expect(await page.evaluate(() => window.__entryAlignCalls)).toBe(viewport.width > 1024 ? 1 : 0);
      expect(await page.evaluate(() => scrollY)).toBe(y);
      await expect(search).toHaveValue('Demrie');
      if (entry === 'pointer') {
        await page.screenshot({ path: `test-results/workshop-name-entry-${viewport.width}.png` });
      }
    });
  }
}

for (const viewport of [
  { width: 1365, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568, enlarged: true },
]) {
  test(`stable panel ${viewport.width}: stage transitions, Back and review editing keep the same box anchor`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Leave normal motion enabled: transitions must not queue smooth scrolling.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    if (viewport.enlarged) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    const builder = page.locator('.smw-builder');
    await expect(page.locator('.smw-intro-copy')).toHaveText("It's all about the little details ...");
    await expect(page.locator('.smw-catalogue-review-note')).toHaveCount(0);
    let baseline;
    const checkAnchor = async () => {
      await expect(page.locator('.smw-intro-copy')).toHaveText("It's all about the little details ...");
      await expect(page.locator('.smw-catalogue-review-note')).toHaveCount(0);
      await expect.poll(async () => {
        return page.evaluate(() => Math.abs(
          document.querySelector('.smw-builder').getBoundingClientRect().top
          - document.querySelector('.navbar').getBoundingClientRect().bottom - 16,
        ));
      }).toBeLessThanOrEqual(1);
      const box = await builder.boundingBox();
      const headerBottom = await page.locator('.navbar').evaluate(node => node.getBoundingClientRect().bottom);
      expect(Math.abs(box.y - headerBottom - 16)).toBeLessThanOrEqual(1);
      if (baseline) {
        expect(Math.abs(box.x - baseline.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.width - baseline.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.y - baseline.y)).toBeLessThanOrEqual(1);
      } else baseline = box;
      await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
    };
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
    await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
    await expect(page.locator('.smw-button-next')).toBeVisible();
    await page.locator('.smw-button-next').click();
    await expect(page.locator('.smw-validation')).toContainText('Please choose');
    await expect(page.locator('.smw-step-count')).toHaveText('Step 1 of 6');
    await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dem');
    await page.getByRole('option', { name: 'Demrie', exact: true }).click();
    for (let stage = 1; stage <= 6; stage++) {
      await page.locator('.smw-button-next').click();
      if (stage <= 5) {
        await expect(page.locator('.smw-step-count')).toHaveText(`Step ${stage + 1} of 6`);
        await checkAnchor();
        await page.getByRole('listbox').press('Home');
      } else {
        await expect(page.locator('.smw-summary')).toBeVisible();
        await expect(page.locator('.smw-summary .smw-change')).toHaveCount(6);
        for (const edit of await page.locator('.smw-summary .smw-change').all()) {
          await expect(edit).toHaveText('');
          await expect(edit.locator('svg')).toBeVisible();
          const box = await edit.boundingBox();
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
        await checkAnchor();
        if (viewport.width === 390) await page.locator('.smw-summary').screenshot({ path: 'test-results/studio-review-edit-icons.png' });
      }
    }
    await page.getByRole('button', { name: 'Change Their name', exact: true }).click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 1 of 6');
    await checkAnchor();
    // In summary editing, Back really returns to the review, not the website.
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.smw-summary')).toContainText('Demrie');
    await checkAnchor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 6 of 6');
    await checkAnchor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 5 of 6');
    await checkAnchor();
    await expect(page.getByRole('listbox').locator('[aria-selected=true]')).toHaveCount(1);
    await expect(page).toHaveURL(/\/santa-message-workshop$/);
  });
}

test('full journey, missing choices, back and category editing retain answers without service or storage writes', async ({ page }) => {
  const forbidden = [];
  page.on('request', request => {
    if (/\/api\/(?:santa-|name-requests)|sibforms|google-analytics|facebook\.com\/tr/.test(request.url()) &&
        !(request.method() === 'GET' && request.url().endsWith('/api/santa-workshop-access')) &&
        !request.url().endsWith('/api/santa-names?inventory=hosted') &&
        !request.url().endsWith('/api/santa-workshop-catalogue')) forbidden.push(request.url());
  });
  await open(page);
  const storage = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const before = await storage();
  await page.locator('.smw-button-next').click();
  await expect(page.getByRole('alert')).toContainText('Please choose their name');
  await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await complete(page);
  await expect(page.locator('.smw-summary dt')).toHaveText([
    'Their name', 'Age', 'Working hard at', 'Extra celebration',
    'A festive treat for Santa', 'Santa will be flying in to',
  ]);
  for (const label of ['Working hard at', 'Extra celebration', 'A festive treat for Santa', 'Santa will be flying in to']) {
    await expect(page.getByRole('button', { name: `Change ${label}`, exact: true })).toHaveCount(1);
  }
  for (const answer of answers) await expect(page.locator('.smw-summary')).toContainText(answer);
  await page.getByRole('button', { name: 'Change Age', exact: true }).click();
  await expect(page.getByRole('option', { name: '9 years old', exact: true })).toHaveAttribute('aria-selected', 'true');
  await browseToAge(page, '13 years old');
  await page.getByRole('button', { name: 'Return to review' }).click();
  await expect(page.locator('.smw-summary')).toContainText('13 years old');
  await page.getByRole('button', { name: 'Change Their name', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Zar');
  await page.getByRole('option', { name: 'Zara', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await page.getByRole('button', { name: 'Change Age', exact: true }).click();
  const updatedGreeting = page.getByRole('complementary', { name: 'Santa will say…', exact: true });
  await expect(updatedGreeting).toContainText('ah yes… Zara.');
  await expect(updatedGreeting).not.toContainText('Demrie');
  await expect(page.getByRole('option', { name: '13 years old', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  // Restore the name before checking all the other original selections below.
  await page.getByRole('button', { name: 'Change Their name', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dem');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  for (const answer of answers.filter((_, index) => index !== 1)) await expect(page.locator('.smw-summary')).toContainText(answer);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('option', { name: answers[5], exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Review my choices' }).click();
  await expect(page.locator('.smw-audio-disclaimer')).toHaveCount(0);
  await expect(page.locator('.smw-written-name-preview-note')).toHaveCount(0);
  await expect(page.locator('.smw-page audio, .smw-page [download], .smw-page input[type=email]')).toHaveCount(0);
  expect(await storage()).toEqual(before);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  expect(forbidden).toEqual([]);
  await page.reload();
  await expect(page.locator('.smw-page input:checked')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toHaveValue('');
});

test('keyboard alone completes autocomplete, wheels and review', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await complete(page, true);
});

test('names remain usable while catalogue loads; arrival never silently selects or moves focus', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/santa-workshop-catalogue', async route => {
    await gate;
    await route.fulfill({ json: workshopCatalogueFixture });
  });
  await openAgeStage(page);
  await expect(page.locator('.smw-catalogue-loading')).toBeVisible();
  await expect(page.locator('.smw-button-next')).toBeDisabled();
  await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
  release();
  await expect(page.getByRole('listbox', { name: 'Their age', exact: true })).toBeVisible();
  await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
  await expect(page.locator('.smw-page [role=option][aria-selected=true]')).toHaveCount(0);
});

test('failed and malformed catalogues show explicit retry, never offline examples or a partial list', async ({ page }) => {
  let attempts = 0, state = 'unavailable';
  await page.route('**/api/santa-workshop-catalogue', route => {
    attempts++;
    return route.fulfill(state === 'unavailable'
      ? { status: 503, json: { error: 'Unavailable' } }
      : state === 'malformed' ? { json: { ...workshopCatalogueFixture, categories: { age: workshopCatalogueFixture.categories.age } } }
        : { json: workshopCatalogueFixture });
  });
  await openAgeStage(page);
  await expect(page.locator('.smw-catalogue-error')).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator('.smw-button-next')).toBeDisabled();
  state = 'malformed';
  await page.getByRole('button', { name: 'Retry hosted choices' }).click();
  await expect(page.locator('.smw-catalogue-error')).toContainText('incomplete');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  state = 'ready';
  await page.getByRole('button', { name: 'Retry hosted choices' }).click();
  await expect(page.getByRole('listbox', { name: 'Their age', exact: true })).toBeVisible();
  await expect(page.locator('.smw-stage-heading h3')).toBeFocused();
  await expect(page.locator('.smw-page [role=option][aria-selected=true]')).toHaveCount(0);
  await browseToAge(page, '1 month old');
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-step-count')).toHaveText('Step 3 of 6');
  // React development StrictMode can start and abort an initial mount request.
  expect(attempts).toBeGreaterThanOrEqual(3);
});

test('sound-alike hint and final spelling change update output previews only, without persisting or sending details', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/api/santa-') || request.method() === 'POST') requests.push(request.url());
  });
  await open(page);
  const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const search = page.getByRole('combobox', { name: 'Search recorded names' });
  await search.fill('Wendth');
  await expect(page.locator('.smw-name-empty')).toContainText('could a name spelt differently sound the same');
  await expect(page.locator('.smw-name-empty')).toContainText('This won’t change the name Santa says');
  await complete(page);
  const section = page.getByRole('region', { name: 'Written name for your keepsakes' });
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Demrie.mp3');
  await expect(section).not.toContainText('.mp3');
  await expect(section).not.toContainText('MP3 filename preview');
  const change = section.getByRole('button', { name: 'Edit certificate name', exact: true });
  await expect(section.getByRole('button', { name: 'Change spelling', exact: true })).toHaveCount(0);
  await expect(section.locator('.smw-written-name-explainer, .smw-written-name-help')).toHaveCount(0);
  await expect(section.locator('.smw-written-name-preview')).toHaveCount(1);
  const valueBox = await section.locator('.smw-written-name-value').boundingBox();
  const changeBox = await change.boundingBox();
  expect(changeBox.x).toBeGreaterThanOrEqual(valueBox.x + valueBox.width + 8);
  expect(Math.abs((changeBox.y + changeBox.height / 2) - (valueBox.y + valueBox.height / 2))).toBeLessThanOrEqual(1);
  expect(changeBox.width).toBeGreaterThanOrEqual(44);
  expect(changeBox.height).toBeGreaterThanOrEqual(44);
  await expect(change.locator('svg')).toBeVisible();
  await expect(change).toHaveText('');
  await change.click();
  const input = section.getByRole('textbox', { name: 'Name spelling', exact: true });
  await expect(input).toBeFocused();
  await input.fill('../unsafe');
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(section.getByRole('alert')).toContainText('Use letters');
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Demrie.mp3');
  await input.fill('Demree');
  await expect(section.getByRole('alert')).toHaveCount(0);
  await input.press('Enter');
  await expect(change).toBeFocused();
  await expect(section.locator('.smw-written-name-value')).toHaveText('Demree');
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Demree.mp3');
  await expect(section).not.toContainText('.mp3');
  await expect(page.locator('.smw-summary-row').first()).toContainText('Demrie');
  await expect(section.locator('.smw-written-name-record strong')).toHaveText('Demrie');
  await page.getByRole('button', { name: 'Change Extra celebration' }).click();
  await page.getByRole('option', { name: 'Planting and caring for a garden', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review' }).click();
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Demree.mp3');
  await change.click();
  await input.fill('Cancelled');
  await input.press('Escape');
  await expect(change).toBeFocused();
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Demree.mp3');
  await section.screenshot({ path: 'generated-artifacts/workshop/name-spelling-desktop.png' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await section.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await change.click();
  await section.getByRole('button', { name: 'Use recorded spelling' }).click();
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Demrie.mp3');
  await expect(change).toBeFocused();
  await change.click();
  await input.fill('Demree');
  await input.press('Enter');
  // Choosing a different recording cannot inherit the old child's written name.
  await page.getByRole('button', { name: 'Change Their name', exact: true }).click();
  await search.fill('Za');
  await page.getByRole('option', { name: 'Zara', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review' }).click();
  await expect(section).toHaveAttribute('data-download-name', 'santa-message-for-Zara.mp3');
  await expect(section).not.toContainText('Demree');
  const after = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  // The existing radio independently stores its responsive minimised state.
  // Resizing must not be mistaken for a write of a child's written name.
  delete before.session['radio-minimized'];
  delete after.session['radio-minimized'];
  expect(after).toEqual(before);
  expect(requests.every(url => url.endsWith('/api/santa-workshop-access') || url.endsWith('/api/santa-names?inventory=hosted') ||
    url.endsWith('/api/santa-workshop-catalogue'))).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('.smw-page audio, .smw-page [download]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Search recorded names' })).toHaveValue('');
});

test('sending a spelling suggestion is separate, minimal and retry-safe', async ({ page }) => {
  const sent = [];
  await page.route('**/api/name-requests', route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill(sent.length === 1
      ? { status: 503, json: { error: 'The list could not confirm this request.' } }
      : { json: { saved: true, duplicate: false, name: sent.at(-1).name } });
  });
  await open(page);
  await complete(page);
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling' }).fill('Demree');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
  expect(sent).toHaveLength(0);
  const suggestion = page.getByRole('region', { name: 'Optional: suggest this spelling' });
  await expect(suggestion).toContainText('we save this written spelling and selected recording');
  await suggestion.getByRole('button', { name: 'Send this spelling to Santa’s list' }).click();
  await expect(suggestion.getByRole('alert')).toContainText('could not confirm');
  await suggestion.getByRole('button', { name: 'Retry sending this spelling' }).click();
  await expect(suggestion.getByRole('status')).toContainText('Sent for Santa’s team to review');
  await expect(suggestion.getByRole('button')).toBeDisabled();
  expect(sent).toHaveLength(2);
  expect(sent[0]).toEqual(sent[1]);
  expect(Object.keys(sent[0]).sort()).toEqual(['name', 'recordingId', 'requestId']);
  expect(sent[0]).toMatchObject({ name: 'Demree', recordingId: 'demrie' });
  expect(sent[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  await suggestion.screenshot({ path: 'generated-artifacts/workshop/spelling-suggestion-desktop.png' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await suggestion.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(await suggestion.getByRole('button').evaluate(node => node.clientHeight >= 56)).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
});

test('suggestion needs a matching saved acknowledgment and a new spelling starts a different request', async ({ page }) => {
  const sent = [];
  await page.route('**/api/name-requests', route => {
    const body = route.request().postDataJSON();
    sent.push(body);
    return route.fulfill({ json: sent.length === 1
      ? { saved: true, name: 'AnotherName' }
      : { saved: true, duplicate: true, name: body.name } });
  });
  await open(page);
  await complete(page);
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling' }).fill('Demree');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
  const suggestion = page.getByRole('region', { name: 'Optional: suggest this spelling' });
  await suggestion.getByRole('button').click();
  await expect(suggestion.getByRole('alert')).toContainText('did not confirm');
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling' }).fill('Demri');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
  await expect(suggestion.getByRole('button')).toHaveText('Send this spelling to Santa’s list');
  await suggestion.getByRole('button').click();
  await expect(suggestion.getByRole('status')).toContainText('already on Santa’s list');
  expect(sent[1].requestId).not.toBe(sent[0].requestId);
  expect(sent[1].name).toBe('Demri');
});

test('long-text categories use wider wheels with validation, scrolling and retained choices', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgeStage(page);
  const ageWidth = await page.locator('.smw-age-wheel').evaluate(node => node.getBoundingClientRect().width);
  await browseToAge(page, '9 years old');
  await page.locator('.smw-button-next').click();
  const selections = ['Playing a musical instrument', 'Planting and caring for a garden', 'Turrón', 'Camelot — Fantasy place'];
  for (const [index, selection] of selections.entries()) {
    const wheel = page.getByRole('listbox');
    await expect(wheel.locator('[aria-selected=true]')).toHaveCount(0);
    await page.locator('.smw-button-next').click();
    await expect(wheel).toHaveAttribute('aria-invalid', 'true');
    expect(await wheel.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(ageWidth + 100);
    await wheel.focus();
    await page.keyboard.press('End');
    await expect(wheel.getByRole('option', { name: selection, exact: true })).toHaveAttribute('aria-selected', 'true');
    if (index === 1) {
      await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/wide-achievement-desktop.png' });
    }
    await page.locator('.smw-button-next').click();
  }
  for (const selection of selections) await expect(page.locator('.smw-summary')).toContainText(selection);
  await page.getByRole('button', { name: 'Change Extra celebration' }).click();
  await expect(page.getByRole('option', { name: selections[1], exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('listbox').scrollIntoViewIfNeeded();
  await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/wide-achievement-mobile.png' });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const wheel = page.getByRole('listbox');
  expect(await wheel.getByRole('option').evaluateAll(nodes => nodes.every(node =>
    node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  await wheel.focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: answers[3], exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Return to review' }).click();
  await expect(page.locator('.smw-summary')).toContainText(answers[3]);
  for (const selection of selections.filter((_, index) => index !== 1)) {
    await expect(page.locator('.smw-summary')).toContainText(selection);
  }
});

test('compact vertical wheel offers all 63 hosted month/year ages without preselection and retains the last age', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openAgeStage(page);
  await expect(page.locator('.smw-stage-heading h3')).toHaveText('How old are they?');
  await expect(page.locator('.smw-stage-heading p')).toHaveCount(0);
  await expect(page.getByText('Choose the age to help remind Santa.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.smw-age-carousel-range')).toHaveCount(0);
  await expect(page.getByText('The wheel includes only age files present in Santa’s hosted inventory.', { exact: true })).toHaveCount(0);
  expect(await page.locator('.smw-age-carousel-heading, .smw-age-carousel-instruction').evaluateAll(nodes => nodes.length === 2 && nodes.every(node => {
    const rect = node.getBoundingClientRect();
    return getComputedStyle(node).clipPath === 'inset(50%)' && rect.width <= 1 && rect.height <= 1;
  }))).toBe(true);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await expect(wheel.getByRole('option')).toHaveCount(63);
  await expect(wheel.locator('[aria-selected=true]')).toHaveCount(0);
  await page.locator('.smw-button-next').click();
  await expect(page.locator('#smw-validation')).toContainText('Please choose age');
  expect(await wheel.evaluate(node => node.clientHeight < node.scrollHeight / 5)).toBe(true);
  await wheel.focus();
  await page.keyboard.press('End');
  await expect(wheel.getByRole('option', { name: '50 years old', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('.smw-button-next').click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(wheel.getByRole('option', { name: '50 years old', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.smw-age-wheel-status')).toHaveText('Selected: 50 years old');
  await photograph(page, 'generated-artifacts/workshop/age-wheel-desktop.png');
});

test('age keyboard crosses page boundaries and reaches the first and last recorded ages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgeStage(page);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  const first = wheel.getByRole('option', { name: '0 months old', exact: true });
  await wheel.focus();
  await page.keyboard.press('End');
  const last = wheel.getByRole('option', { name: '50 years old', exact: true });
  await expect(last).toHaveAttribute('aria-selected', 'true');
  await expect(wheel).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(wheel.getByRole('option', { name: '49 years old', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(wheel).toBeFocused();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('PageDown');
  await expect(wheel.getByRole('option', { name: '5 months old', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('phone wheel scrolls vertically, selects a centred age and supports enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgeStage(page);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await expect(wheel.locator('[aria-selected=true]')).toHaveCount(0);
  await wheel.dispatchEvent('touchstart');
  await wheel.evaluate(node => { node.scrollTop = node.querySelector('[role=option]').clientHeight * 12; });
  await wheel.dispatchEvent('touchend');
  await expect(page.locator('.smw-age-wheel-status')).toHaveText('Selected: 12 months old');
  await photograph(page, 'generated-artifacts/workshop/age-wheel-mobile.png');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator('.smw-age-wheel-status')).toHaveText('Selected: 12 months old');
  const fits = await wheel.getByRole('option').evaluateAll(nodes =>
    nodes.every(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1));
  expect(fits).toBe(true);
});

test('real mouse-wheel input selects an age without scrolling the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgeStage(page);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await wheel.scrollIntoViewIfNeeded();
  await wheel.hover();
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 192);
  await expect(page.locator('.smw-age-wheel-status')).toHaveText('Selected: 4 months old');
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await expect(wheel.getByRole('option', { name: '4 months old', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('native touch gesture moves the vertical wheel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAgeStage(page);
  const wheel = page.getByRole('listbox', { name: 'Their age', exact: true });
  await wheel.scrollIntoViewIfNeeded();
  const box = await wheel.boundingBox();
  const client = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height * .7;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let distance = 10; distance <= 100; distance += 10) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(wheel.locator('[aria-selected=true]')).toHaveCount(1);
  expect(await wheel.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await client.detach();
});

test('cream name autocomplete supports keyboard selection, escape and clearing', async ({ page }) => {
  await open(page);
  const search = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await search.fill('dix');
  await expect(search).toHaveCSS('background-color', 'rgb(244, 237, 220)');
  await search.press('ArrowUp'); // Last matching recording, not an accidental default.
  await search.press('Enter');
  await expect(page.locator('.smw-name-status')).toContainText('Dixie — dixie3.wav');
  await search.fill('di');
  await expect(page.locator('.smw-name-status')).toHaveCount(0);
  await search.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/name-autocomplete.png' });
  await search.press('Enter');
  await expect(page.locator('.smw-name-status')).toContainText('Dixie — dixie.wav');
});

test('hosted names search locally, distinguish variants and retain the chosen recording when editing', async ({ page }) => {
  const inventoryRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/santa-names')) inventoryRequests.push(request.url());
  });
  await open(page);
  await expect(page.getByText('Type the beginning of a recorded name to see available matches.', { exact: true })).toHaveCount(0);
  const search = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await expect(page.locator('.smw-name-count')).toHaveText('4 hosted recordings available');
  await expect(page.getByRole('option')).toHaveCount(0);
  await search.fill('dix');
  await expect(page.getByRole('option')).toHaveCount(2);
  const variant = page.getByRole('option', { name: 'Dixie dixie3.wav', exact: true });
  await variant.click();
  await expect(search).toHaveValue('Dixie');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.smw-button-next').click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.smw-name-status')).toContainText('Dixie — dixie3.wav');
  await search.focus();
  await expect(variant).toHaveAttribute('aria-selected', 'true');
  await search.fill('NotAHostedName');
  await expect(page.locator('.smw-name-empty > p').first()).toHaveText('Santa has not recorded “NotAHostedName” yet. Try another spelling or refine your search.');
  await page.locator('.smw-button-next').click();
  await expect(page.locator('#smw-validation')).toContainText('Please choose their name');
  await search.fill('za');
  await page.getByRole('option', { name: 'Zara', exact: true }).click();
  await expect(page.locator('.smw-name-status')).toContainText('Zara');
  expect(inventoryRequests.length).toBeGreaterThan(0);
  expect(inventoryRequests.every(url => url.endsWith('/api/santa-names?inventory=hosted'))).toBe(true);
});

test('unavailable hosted list shows an explicit retry without offering a fixed example', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/santa-names?inventory=hosted', route => {
    return route.fulfill(unavailable ? { status: 503, json: { error: 'Unavailable' } } : {
      json: { records: hostedRecords, hostedCount: hostedRecords.length, warning: null },
    });
  });
  await open(page);
  await expect(page.locator('.smw-name-picker [role=alert]')).toContainText('could not be loaded');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.locator('.smw-name-count')).toHaveText('Hosted name total unavailable.');
  unavailable = false;
  await page.getByRole('button', { name: 'Retry hosted list', exact: true }).click();
  await expect(page.locator('.smw-name-count')).toHaveText('4 hosted recordings available');
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dem');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
  await expect(page.locator('.smw-name-status')).toContainText('Demrie');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`phone ${viewport.width}: all stages, editing, text growth and dock clearance`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await complete(page);
    await page.getByRole('button', { name: 'Change Working hard at' }).click();
    await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
    await page.getByRole('button', { name: 'Return to review' }).click();
    await expect(page.locator('.radio-dock')).toBeHidden();
    expect(await page.evaluate(() => {
      window.scrollTo({ left: 100, top: scrollY, behavior: 'instant' });
      return scrollX === 0 && document.documentElement.scrollWidth <= innerWidth + 1;
    })).toBe(true);
    await expect(page.locator('.smw-summary')).toContainText('Playing a musical instrument');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const controls = await page.locator('.smw-page button').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { height: rect.height, minimum: node.matches('.smw-name-preview-button') ? 44 : 56, fits: node.scrollWidth <= node.clientWidth + 1 };
    }));
    expect(controls.every(control => control.height >= control.minimum && control.fits)).toBe(true);
    // With the mobile player hidden, keyboard focus must keep the action in view.
    await page.getByRole('button', { name: 'Back', exact: true }).focus();
    const clearance = await page.evaluate(() => ({
      bottom: document.activeElement.getBoundingClientRect().bottom,
      dockTop: innerHeight,
    }));
    expect(clearance.bottom).toBeLessThanOrEqual(clearance.dockTop);
  });
}

test('desktop and phone review screenshots, explainer arrangement and unchanged navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await open(page);
  await expect(page.locator('.smw-explainer')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Studio test notice' }).locator('strong')).toHaveText("It's the little details that matter...");
  await expect(page.getByRole('complementary', { name: 'Studio test notice' }).locator('p')).toHaveText('You’re in the friends-only Message Maker Studio test. Please try all of the sections and give us some feedback.');
  await expect(page.locator('.smw-footer-note')).toBeVisible();
  await photograph(page, 'generated-artifacts/workshop/desktop-clean.png');
  const cards = await page.locator('.smw-explainer-card').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
  expect(new Set(cards).size).toBe(1);
  await expect(page.locator('nav a[href="/santa-message-workshop"], footer a[href="/santa-message-workshop"]')).toHaveCount(0);
  await complete(page);
  await page.locator('.smw-builder').screenshot({ path: 'generated-artifacts/workshop/desktop-review.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await photograph(page, 'generated-artifacts/workshop/mobile-review.png');
  await page.reload();
  await photograph(page, 'generated-artifacts/workshop/mobile-clean.png');
  await expect(page.locator('.smw-explainer')).toBeHidden();
  await expect(page.locator('.smw-footer-note')).toBeHidden();
  await expect(page.locator('.smw-builder')).toBeVisible();
  await expect(page.locator('.footer')).toBeHidden();
  const bottomGap = await page.evaluate(() =>
    document.querySelector('.smw-page').getBoundingClientRect().bottom
    - document.querySelector('.smw-builder').getBoundingClientRect().bottom);
  expect(bottomGap).toBeLessThanOrEqual(34);
});
