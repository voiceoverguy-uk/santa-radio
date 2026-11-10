import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture, workshopRegionalCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { confirmMessage, mockStudioGeneration } from './helpers/studio-generation.js';
import { expectLeftAlignedLetter } from './helpers/studio-letter-alignment.js';
import { expectSampleWatermark } from './helpers/studio-sample-watermark.js';

const giftButtons = page => page.locator('.smw-written-name .studio-gift-download button');
const letterText = page => page.locator('.smw-studio-preview .studio-gifts__preview-stack .studio-gifts__sr');
const pencil = page => page.getByRole('button', { name: 'Edit certificate name', exact: true });
async function assertReadOnly(page, name) {
  await expect(pencil(page)).toHaveCount(0);
  await expect(page.locator('.smw-written-name-editor')).toHaveCount(0);
  await expect(page.locator('.smw-written-name-value')).toHaveText(name);
  await expect(page.locator('.studio-gifts__preview-stack .studio-certificate__name')).toHaveText(name);
  await expect(page.locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText(name);
  await expect(letterText(page)).toContainText(name);
}
async function review(page, { destination = 'The Enchanted Forest', talent = null, region = null } = {}) {
  await unlockWorkshop(page);
  const fixture = await mockStudioGeneration(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  const catalogue = structuredClone(workshopCatalogueFixture);
  const counties = workshopRegionalCatalogueFixture.regionalGroups['england-counties'];
  catalogue.categories.place[0].file = 'countries/england.wav';
  catalogue.regionalGroups = { 'england-counties': { ...counties, parentId: 'england' } };
  await page.route('**/api/santa-workshop-catalogue*', route => {
    const query = new URL(route.request().url()).searchParams;
    if (query.has('regionId')) return route.fulfill({ json: {
      parentId: query.get('parentId'), regionId: query.get('regionId'),
      letterContext: counties.records.find(record => record.id === query.get('regionId')).letterContext,
    } });
    return route.fulfill({ json: catalogue });
  });
  await page.route('**/api/santa-names', route => route.fulfill({
    json: { records: [{ id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2',
      selectionToken: 'test-token', previewUrl: '/api/santa-name-preview?token=test-token' }] },
  }));
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dixie');
  await page.getByRole('option', { name: /Dixie/ }).first().click();
  await page.locator('.smw-button-next').click();
  for (const answer of ['9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', destination]) {
    const skip = page.getByRole('button', { name: 'Skip this section', exact: true });
    if (await skip.isVisible()) {
      if (talent) {
        await page.getByRole('option', { name: talent, exact: true }).click();
        await page.locator('.smw-button-next').click();
      } else await skip.click();
    }
    if (answer === 'The Enchanted Forest') await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
    await page.getByRole('option', { name: answer, exact: true }).click();
    if (answer === destination && region) {
      await page.getByRole('button', { name: 'Choose a county', exact: true }).click();
      await page.getByRole('option', { name: region, exact: true }).click();
    }
    await page.locator('.smw-button-next').click();
  }
  return fixture;
}

test('real selection header unlocks country-only gifts after the full MP3 arrives', async ({ page }) => {
  const fixture = await review(page, { destination: 'England' });
  for (const kind of ['certificate', 'letter', 'picture']) {
    const download = page.locator(`.studio-gifts__card--${kind} .studio-gift-download`);
    await expect(download.getByRole('button')).toBeDisabled();
    await expect(download.getByRole('status'))
      .toHaveText('Available when your MP3 audio file has been downloaded.');
  }
  await confirmMessage(page);
  await expect(page.getByRole('region', { name: 'Your finished Santa message' })).toBeVisible();
  expect(fixture.posts[0]).not.toHaveProperty('region');
  await expect(giftButtons(page)).toHaveCount(3);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(page.locator('.studio-gift-download p')).toHaveText(Array(3)
    .fill('Ready. Repeat downloads do not use your message allowance.'));
});

test('temporary recording allows playback and identical download retries during the visit', async ({ page }) => {
  const fixture = await review(page, { destination: 'England' });
  await confirmMessage(page);
  const audio = page.locator('.smw-message-result audio');
  await expect(audio).toBeVisible();
  const originalUrl = await audio.getAttribute('src');
  await audio.evaluate(async node => {
    await node.play();
    node.pause();
    node.currentTime = 0;
    await node.play();
    node.pause();
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const pendingDownload = page.waitForEvent('download');
    await page.getByRole('link', { name: /Download Audio/ }).click();
    const download = await pendingDownload;
    expect(await download.failure()).toBeNull();
    expect(readFileSync(await download.path())).toEqual(fixture.audio);
    await expect(audio).toHaveAttribute('src', originalUrl);
  }
  expect(fixture.posts).toHaveLength(1);
  expect(fixture.recoveries || 0).toBe(0);
});

for (const ending of ['pagehide', 'access expiry']) {
  test(`temporary recording and gift access clear on ${ending}`, async ({ page }) => {
    await review(page, { destination: 'England' });
    await confirmMessage(page);
    const audio = page.locator('.smw-message-result audio');
    await expect(audio).toBeVisible();
    const originalUrl = await audio.getAttribute('src');
    if (ending === 'pagehide') {
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    } else {
      await page.route('**/api/santa-studio-message*', route => route.fulfill({
        status: 403, json: { error: 'Studio access expired.' },
      }));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    }
    await expect(audio).toHaveCount(0);
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    expect(await page.evaluate(async url => {
      try { await fetch(url); return true; } catch { return false; }
    }, originalUrl)).toBe(false);
  });
}

test('unchanged completed gifts survive pending and failed replacement audio', async ({ page }) => {
  const fixture = await review(page, { destination: 'England' });
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  const previousUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  const reviewed = await letterText(page).textContent();
  let release;
  fixture.hold = new Promise(resolve => { release = resolve; });
  fixture.fail = true;
  await confirmMessage(page);
  await expect(page.getByRole('progressbar', { name: 'Preparing your message', exact: true })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  release();
  await expect(page.getByText('Fixture recording unavailable. Try again.', { exact: true })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(page.locator('.smw-message-result audio')).toHaveAttribute('src', previousUrl);
  await expect(letterText(page)).toHaveText(reviewed);
  await assertReadOnly(page, 'Dixie');
  expect(fixture.posts).toHaveLength(2);
});

test('completed gifts use response choices rather than newer review choices', async ({ page }) => {
  const fixture = await review(page, { destination: 'England' });
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  const previous = structuredClone(fixture.posts[0]);
  await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
  await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  // An older completed selection must never be relabelled as the new review.
  fixture.selection = () => ({ record: fixture.record, choices: previous });
  const previousUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  await confirmMessage(page);
  await expect(page.locator('.smw-message-result audio')).not.toHaveAttribute('src', previousUrl);
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  fixture.selection = choices => ({ record: fixture.record, choices });
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
});

for (const width of [320, 1365]) {
  test(`completed gifts discard an open draft and keep names read-only at ${width}px`, async ({ page }) => {
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 900 });
    await spelling(page, 'Élodie O’Neill');
    let release;
    fixture.hold = new Promise(resolve => { release = resolve; });
    await confirmMessage(page);
    await expect(page.getByRole('progressbar', { name: 'Preparing your message', exact: true })).toBeVisible();
    await pencil(page).click();
    const input = page.getByRole('textbox', { name: 'Name spelling', exact: true });
    await input.fill('Unconfirmed draft');
    await expect(input).toBeFocused();
    release();
    await assertReadOnly(page, 'Élodie O’Neill');
    await expect(page.locator('.smw-written-name-value')).toBeFocused();
    await expect(page.locator('.smw-studio-preview')).not.toContainText('Unconfirmed draft');
    for (const button of await giftButtons(page).all()) {
      await expect(button).toBeEnabled();
      await expect(button).toHaveCSS('background-color', 'rgb(155, 17, 30)');
      await expect(button).toHaveCSS('color', 'rgb(255, 248, 231)');
      await button.hover();
      await expect(button).toHaveCSS('background-color', 'rgb(173, 28, 43)');
    }
    for (const button of await page.locator('.smw-studio-preview .studio-gifts__thumbnail').all()) {
      await expect(button).toHaveCSS('background-color', 'rgb(242, 234, 216)');
    }
    const first = giftButtons(page).first();
    await page.locator('.studio-gifts__thumbnail').first().focus();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await expect(first).toHaveCSS('outline-style', 'solid');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(fixture.posts).toHaveLength(1);

    // A fresh second draft preserves the first local result but cannot use it
    // to unlock new gifts, even if its spelling matches the first again.
    const previousAudio = await page.locator('.smw-message-result audio').getAttribute('src');
    await page.getByRole('button', { name: 'Start Again', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.smw-button-next').click();
    for (let stage = 0; stage < 6; stage++) await page.locator('.smw-button-next').click();
    await expect(pencil(page)).toBeVisible();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await spelling(page, 'Fresh spelling');
    await expect(page.locator('.smw-written-name-value')).toHaveText('Fresh spelling');
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await expect(page.getByRole('link', { name: /Download Audio/ })).toHaveCount(1);
    await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
    expect(fixture.posts).toHaveLength(1);
    await spelling(page, 'Élodie O’Neill');
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await spelling(page, 'Fresh spelling');
    fixture.fail = true;
    await confirmMessage(page);
    await expect(page.getByText('Fixture recording unavailable. Try again.', { exact: true })).toBeVisible();
    await expect(pencil(page)).toBeVisible();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    fixture.fail = false;
    await confirmMessage(page, 'Retry message');
    await assertReadOnly(page, 'Fresh spelling');
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(2);
    await expect(page.locator('.smw-message-result audio').first()).toHaveAttribute('src', previousAudio);
    await expect(page.locator('.smw-message-result audio').nth(1)).not.toHaveAttribute('src', previousAudio);
  });
}

test('failed first MP3 leaves spelling editable until a successful retry', async ({ page }) => {
  const fixture = await review(page);
  fixture.fail = true;
  await confirmMessage(page);
  await expect(page.getByText('Fixture recording unavailable. Try again.', { exact: true })).toBeVisible();
  await expect(pencil(page)).toBeVisible();
  await spelling(page, 'D’Arcy');
  for (const button of await giftButtons(page).all()) {
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS('background-color', 'rgb(247, 239, 217)');
  }
  fixture.fail = false;
  await confirmMessage(page, 'Retry message');
  await assertReadOnly(page, 'D’Arcy');
});

for (const width of [320, 1365]) {
  for (const region of [null, 'Kent']) {
    test(`real selection header delivers all personalised files for ${region || 'country only'} at ${width}px`, async ({ page }) => {
      test.setTimeout(90000);
      mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
      const fixture = await review(page, { destination: 'England', region, talent: region ? 'Tennis' : null });
      await page.setViewportSize({ width, height: 900 });
      // Reordered talent properties are semantically identical to the selection.
      fixture.selection = choices => ({ record: fixture.record, choices: { ...choices,
        talent: region ? { id: choices.talent.id, category: choices.talent.category } : choices.talent } });
      await spelling(page, 'Élodie O’Neill');
      const paragraphs = await letterText(page).locator('p').allTextContents();
      await confirmMessage(page);
      for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
      if (region) expect(fixture.posts[0].region).toBe(
        workshopRegionalCatalogueFixture.regionalGroups['england-counties'].records.find(record => record.label === region).id);
      else expect(fixture.posts[0]).not.toHaveProperty('region');
      const prefix = `generated-artifacts/studio-gifts/contract-${region || 'country'}-${width}`;
      for (const [kind, label] of [['certificate', 'Download certificate (PDF)'], ['letter', 'Download letter (PDF)']]) {
        const filename = `${prefix}-${kind}.pdf`;
        const download = await save(page, label, filename);
        expect(download.suggestedFilename()).toContain('Élodie');
        expect((await PDFDocument.load(readFileSync(filename))).getPageCount()).toBe(1);
        const text = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
        expect(text).toContain('Élodie O’Neill');
        expect(text).not.toMatch(/SAMPLE|NORTH POLE PROPERTY/);
        if (kind === 'letter') for (const paragraph of paragraphs) expect(text).toContain(paragraph.replace(/\s+/gu, ' '));
      }
      await save(page, 'Download Santa picture (PNG)', `${prefix}.png`);
      const png = readFileSync(`${prefix}.png`);
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBe(1536);
      expect(png.readUInt32BE(20)).toBe(1024);
      await save(page, 'Download certificate (PDF)', `${prefix}-repeat.pdf`);
      expect(fixture.posts).toHaveLength(1);
      if (region) {
        await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
        await page.getByRole('button', { name: 'Countries & real places', exact: true }).click();
        await page.getByRole('option', { name: 'England', exact: true }).click();
        // Explicitly remove the selected county without changing the country.
        await page.getByRole('button', { name: 'Use England only', exact: true }).click();
        await page.getByRole('button', { name: 'Return to review', exact: true }).click();
        for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
        await confirmMessage(page);
        for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
        expect(fixture.posts.at(-1)).not.toHaveProperty('region');
      }
    });
  }
}

async function spelling(page, name) {
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
}

for (const width of [320, 820, 1365]) {
  test(`review gifts keep grouped reading order and complete proportions at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 1000 });
    const stack = page.locator('.smw-studio-preview .studio-gifts__preview-stack');
    const cards = stack.locator('.studio-gifts__card');
    const kinds = ['certificate', 'picture', 'letter'];
    const labels = ['Enlarge certificate', 'Enlarge Santa’s Nice List picture', 'Enlarge letter to read'];
    const geometry = () => stack.evaluate(node => {
      const bounds = selector => node.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        certificate: bounds('.studio-gifts__card--certificate'),
        picture: bounds('.studio-gifts__card--picture'),
        letter: bounds('.studio-gifts__card--letter'),
        paper: bounds('.studio-letter__paper'),
        sheet: bounds('.studio-certificate'),
        image: bounds('.studio-santa-picture'),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    const assertGeometry = async (columns) => {
      await expectLeftAlignedLetter(stack.locator('.studio-letter__paper'));
      const box = await geometry();
      expect(box.overflow).toBe(false);
      expect(box.paper.width / box.paper.height).toBeCloseTo(210 / 297, 2);
      expect(box.sheet.width / box.sheet.height).toBeCloseTo(841.89 / 595.28, 2);
      expect(box.image.width / box.image.height).toBeCloseTo(1.5, 2);
      expect(box.picture.top).toBeGreaterThanOrEqual(box.certificate.bottom);
      if (columns) {
        expect(Math.abs(box.certificate.top - box.letter.top)).toBeLessThan(1);
        expect(Math.abs(box.certificate.left - box.picture.left)).toBeLessThan(1);
        expect(box.letter.left).toBeGreaterThan(box.certificate.right);
        expect(box.letter.width / box.certificate.width).toBeGreaterThan(.85);
        expect(box.letter.width / box.certificate.width).toBeLessThan(1.2);
        expect(box.paper.width).toBeGreaterThan(box.letter.width - 12);
      } else {
        expect(box.letter.top).toBeGreaterThanOrEqual(box.picture.bottom);
        for (const kind of kinds) expect(Math.abs(box[kind].left - box.certificate.left)).toBeLessThan(1);
        expect(box.paper.width).toBeGreaterThan(box.letter.width - 12);
      }
      for (const kind of kinds) {
        const card = stack.locator(`.studio-gifts__card--${kind}`);
        const thumbnail = await card.locator('.studio-gifts__thumbnail').boundingBox();
        const download = card.locator('.studio-gift-download');
        const button = download.getByRole('button');
        const control = await button.boundingBox();
        expect(control.y).toBeGreaterThanOrEqual(thumbnail.y + thumbnail.height);
        expect(control.y - thumbnail.y - thumbnail.height).toBeLessThan(14);
        expect(control.height).toBeGreaterThanOrEqual(44);
        await expect(button).toHaveAttribute('aria-describedby', await download.locator('p').getAttribute('id'));
      }
    };
    await expect(cards).toHaveCount(3);
    for (const [index, kind] of kinds.entries()) await expect(cards.nth(index)).toHaveClass(new RegExp(`--${kind}`));
    await assertGeometry(width > 600);
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await stack.screenshot({ path: `generated-artifacts/studio-gifts/rebalanced-locked-${width}.png`,
      animations: 'disabled', style: '.navbar, .radio-dock { visibility: hidden !important; }' });

    // A real Tab follows each complete group, rather than jumping across columns.
    for (const [index, label] of labels.entries()) {
      const opener = stack.getByRole('button', { name: label, exact: true });
      await expectSampleWatermark(opener);
      if (index === 0) await opener.focus();
      else await page.keyboard.press('Tab');
      await expect(opener).toBeFocused();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expectSampleWatermark(dialog);
      const fits = await dialog.evaluate(node => {
        const document = node.querySelector('.studio-letter-dialog__document').getBoundingClientRect();
        const content = node.querySelector('.studio-letter-dialog__content').getBoundingClientRect();
        return document.left >= content.left && document.right <= content.right + 1
          && (node.classList.contains('studio-letter-dialog--letter')
            ? document.top >= content.top - 1 && document.bottom <= content.bottom + 1 : true);
      });
      expect(fits).toBe(true);
      if (kinds[index] === 'letter') await expectLeftAlignedLetter(dialog.locator('.studio-letter__paper'));
      await page.keyboard.press('Escape');
      // Native close restores focus before the asynchronous close event clears
      // React's view and restores it again. Wait for both before the next Tab.
      await expect(page.locator('.studio-letter-dialog')).toHaveAttribute('aria-label', 'Dixie’s gift example');
      await expect(opener).toBeFocused();
    }
    const longName = 'Alexandria-Catherine Elizabeth Montgomery-Worthington';
    await spelling(page, longName);
    await expect(stack.locator('.studio-certificate__name')).toHaveText(longName);
    await expect(stack.locator('.studio-santa-picture__name')).toHaveText(longName);
    await expect(letterText(page)).toContainText(longName);
    await expect(letterText(page)).toContainText('Completing a jigsaw puzzle');
    await assertGeometry(width > 600);
    await confirmMessage(page);
    await expect(page.getByRole('region', { name: 'Your finished Santa message' })).toBeVisible();
    await expect(page.locator('.smw-review-create-action button')).toHaveText('READY');
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await assertGeometry(width > 600);
    await stack.screenshot({ path: `generated-artifacts/studio-gifts/rebalanced-ready-${width}.png`,
      animations: 'disabled', style: '.navbar, .radio-dock { visibility: hidden !important; }' });
    const controls = stack.locator('button');
    await controls.first().focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    for (let index = 0; index < 6; index++) {
      if (index) await page.keyboard.press('Tab');
      await expect(controls.nth(index)).toBeFocused();
      await expect(controls.nth(index)).toHaveCSS('outline-style', 'solid');
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const enlarged = await geometry();
    await assertGeometry(Math.abs(enlarged.certificate.top - enlarged.letter.top) < 1);
    expect(fixture.posts).toHaveLength(1);
  });
}

test('Studio spelling keeps the 80-character boundary and wraps only Santa picture names', async ({ page, context }) => {
  test.setTimeout(90000);
  const fixture = await review(page);
  const edit = page.getByRole('button', { name: 'Edit certificate name', exact: true });
  await edit.click();
  const input = page.getByRole('textbox', { name: 'Name spelling', exact: true });
  const confirm = page.getByRole('button', { name: 'Use this spelling', exact: true });
  await expect(input).toHaveAttribute('maxlength', '80');
  await expect(input).toHaveAttribute('placeholder', 'Name only — no naughty words');
  const maximum = 'A'.repeat(80);
  await input.fill('');
  await input.pressSequentially(`${maximum}B`);
  await expect(input).toHaveValue(maximum);
  await confirm.click();
  await expect(input).toBeHidden();
  await expect(page.locator('.smw-written-name-value')).toHaveText(maximum);

  await edit.click();
  await input.fill('');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(value => navigator.clipboard.writeText(value), `${maximum}B`);
  await input.press('Control+V');
  await expect(input).toHaveValue(maximum);
  await confirm.click();
  await edit.click();
  // A restored or programmatically injected over-limit draft must not confirm.
  await input.evaluate(node => node.removeAttribute('maxlength'));
  await input.fill(`${maximum}B`);
  await input.evaluate(node => node.maxLength = 80);
  await confirm.click();
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.smw-written-name-error')).toHaveText('Please keep the name to 80 characters or fewer.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.smw-written-name-value')).toHaveText(maximum);
  await edit.click();
  await page.getByRole('button', { name: 'Use recorded spelling', exact: true }).click();
  await expect(page.locator('.smw-written-name-value')).toHaveText('Dixie');

  const name = 'Alexandria-Catherine Elizabeth Montgomery-Worthington';
  await spelling(page, name);
  const pictureText = page.locator('.studio-gifts__preview-stack .studio-santa-picture__name text');
  await expect(pictureText.locator('tspan')).toHaveText(['Alexandria-Catherine ', 'Elizabeth Montgomery-Worthington']);
  const coordinates = await pictureText.locator('tspan').evaluateAll(nodes =>
    nodes.map(node => Number(node.getAttribute('y'))));
  expect(coordinates[1]).toBeGreaterThan(coordinates[0]);
  await expect(page.locator('.studio-certificate__name')).toHaveText(name);
  await expect(letterText(page)).toContainText(name);
  await expect(page.locator('.smw-summary-row').first()).toContainText('Dixie');
  // Export uses exactly the same measured lines as the preview (real PNG).
  const exported = await page.evaluate(async name => {
    const { exportStudioPicture } = await import('/src/lib/studioGiftExports.js');
    const original = CanvasRenderingContext2D.prototype.fillText;
    const calls = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      calls.push({ text, x, y });
      return original.call(this, text, x, y, ...rest);
    };
    try {
      const blob = await exportStudioPicture(name, '/images/santa-nice-list.jpg');
      return { type: blob.type, bytes: blob.size, calls };
    } finally { CanvasRenderingContext2D.prototype.fillText = original; }
  }, name);
  expect(exported.type).toBe('image/png');
  expect(exported.bytes).toBeGreaterThan(1000);
  expect(exported.calls.map(call => call.text)).toEqual(['Alexandria-Catherine', 'Elizabeth Montgomery-Worthington']);
  for (const [index, call] of exported.calls.entries()) {
    expect(call.y - 502).toBeCloseTo(coordinates[index], 8);
  }
  expect(fixture.posts).toHaveLength(0);
  await confirmMessage(page);
  await expect(page.locator('.smw-message-result audio')).toBeVisible();
  expect(fixture.posts[0].name).toBe('dixie-variant');
  const audioUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  await expect(page.getByRole('button', { name: 'Edit certificate name', exact: true })).toHaveCount(0);
  await expect(page.locator('.smw-written-name-value')).toHaveText(name);
  await expect(page.locator('.smw-message-result audio')).toHaveAttribute('src', audioUrl);
  expect(fixture.posts).toHaveLength(1);
  await page.setViewportSize({ width: 1365, height: 1000 });
  await page.locator('.studio-gifts__preview-stack .studio-santa-picture').screenshot({
    path: 'generated-artifacts/studio-gifts/wrapped-picture-name.png', animations: 'disabled',
  });
});

async function save(page, label, file) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await pending;
  await download.saveAs(file);
  return download;
}

for (const width of [320, 1365]) {
  test(`review name box is compact, keyboard editable and wraps enlarged text at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 900 });
    const row = page.locator('.smw-review-create-row');
    const pencil = row.getByRole('button', { name: 'Edit certificate name', exact: true });
    const input = row.getByRole('textbox', { name: 'Name spelling', exact: true });
    const upper = row.getByRole('button', { name: 'Create message', exact: true });
    const geometry = () => row.evaluate(node => {
      const rect = selector => {
        const { x, y, width, height, right, bottom } = node.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height, right, bottom };
      };
      return {
        label: rect('dt'), field: rect('dd'), value: rect('.smw-written-name-value'),
        pencil: rect('.smw-written-name-edit'), action: rect('.smw-review-create-action button'),
        area: rect('.smw-review-name-area'),
        overflowing: [...node.querySelectorAll('dt, dd, span, input, button, form')].some(element =>
          (element.tagName !== 'INPUT' && element.scrollWidth > element.clientWidth + 1)
          || element.scrollHeight > element.clientHeight + 1
          || element.getBoundingClientRect().right > innerWidth + 1),
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    const assertLayout = async () => {
      const bounds = await geometry();
      expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.field.y);
      expect(bounds.pencil.width).toBeGreaterThanOrEqual(44);
      expect(bounds.pencil.height).toBeGreaterThanOrEqual(44);
      expect(bounds.pencil.right).toBeLessThanOrEqual(bounds.field.right);
      expect(bounds.pencil.bottom).toBeLessThanOrEqual(bounds.field.bottom);
      expect(bounds.value.bottom).toBeLessThanOrEqual(bounds.field.bottom + 1);
      expect(bounds.overflowing).toBe(false);
      expect(bounds.pageOverflow).toBe(false);
      if (width > 600) {
        expect(Math.abs(bounds.action.y + bounds.action.height / 2
          - bounds.field.y - bounds.field.height / 2)).toBeLessThan(1);
        expect(bounds.action.x).toBeGreaterThan(bounds.field.right);
      } else {
        expect(bounds.action.y).toBeGreaterThanOrEqual(bounds.area.bottom);
      }
      return bounds;
    };
    await expect(page.locator('.smw-written-name-value')).toHaveText('Dixie');
    const short = await assertLayout();
    // The approved shared red-action sizing is 44px on both layouts.
    expect(short.action.height).toBeCloseTo(44, 0);
    // The name field keeps its larger editing target; the action is centred
    // beside it on desktop, not stretched to the field's height.
    expect(short.field.height).toBeGreaterThanOrEqual(short.action.height);
    await row.screenshot({
      path: `generated-artifacts/studio-gifts/compact-name-${width}.png`, animations: 'disabled',
    });

    // Use real keyboard navigation so this also exercises :focus-visible.
    await upper.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(pencil).toBeFocused();
    await expect(pencil).toHaveCSS('outline-style', 'solid');
    await expect(pencil).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Enter');
    await expect(input).toBeFocused();
    await expect(pencil).toHaveAttribute('aria-expanded', 'true');
    await input.fill('Cancelled spelling');
    await input.press('Escape');
    await expect(pencil).toBeFocused();
    await expect(page.locator('.smw-written-name-value')).toHaveText('Dixie');
    await expect(pencil).toHaveAttribute('aria-expanded', 'false');

    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await assertLayout();
    await spelling(page, 'Alexandria-Catherine Elizabeth Montgomery-Worthington');
    const enlarged = await assertLayout();
    expect(enlarged.field.height).toBeGreaterThan(short.field.height);
    await expect(page.locator('.studio-certificate__name')).toHaveText('Alexandria-Catherine Elizabeth Montgomery-Worthington');
    await pencil.click();
    await expect(input).toBeFocused();
    await assertLayout();
    await row.screenshot({
      path: `generated-artifacts/studio-gifts/enlarged-name-editor-${width}.png`, animations: 'disabled',
    });
    await row.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(pencil).toBeFocused();
    await spelling(page, 'É'.repeat(160));
    await assertLayout();
    expect(fixture.posts).toHaveLength(0);
  });

  test(`both review message actions share confirmation, busy, retry and access states at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 900 });
    const upper = page.locator('.smw-review-create-action button');
    const lower = page.locator('.smw-actions--review > .smw-button-next');
    const dialog = page.getByRole('dialog', { name: 'Ready to create your message?', exact: true });
    const checkActions = async (label, disabled, busy = false) => {
      const completed = await page.getByRole('region', { name: 'Your finished Santa message' }).count();
      if (completed) {
        await expect(upper).toHaveText('READY');
        await expect(upper).toBeEnabled();
      }
      for (const button of completed ? [lower] : [upper, lower]) {
        await expect(button).toContainText(label);
        if (disabled) await expect(button).toBeDisabled();
        else await expect(button).toBeEnabled();
        await expect(button).toHaveAttribute('aria-busy', String(busy));
      }
    };
    await checkActions('Create message', false);
    let confirmationText;
    for (const button of [upper, lower]) {
      await button.click();
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      const text = await dialog.textContent();
      if (confirmationText) expect(text).toBe(confirmationText);
      confirmationText = text;
      await dialog.getByRole('button', { name: 'Go back and edit', exact: true }).click();
      await expect(button).toBeFocused();
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
    }
    expect(fixture.posts).toHaveLength(0);

    await spelling(page, 'Alexandria-Catherine Elizabeth Montgomery-Worthington');
    await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Name spelling', exact: true })).toBeVisible();
    const geometry = await page.locator('.smw-review-create-row').evaluate(row => {
      const [name, action] = [...row.children].map(node => node.getBoundingClientRect());
      return { name: { x: name.x, y: name.y, width: name.width, bottom: name.bottom },
        action: { x: action.x, y: action.y, width: action.width },
        overflowing: [...row.querySelectorAll('input, button, dd, dt')].some(node =>
          (node.tagName !== 'INPUT' && node.scrollWidth > node.clientWidth + 1)
            || node.getBoundingClientRect().right > innerWidth + 1),
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(geometry.overflowing).toBe(false);
    expect(geometry.pageOverflow).toBe(false);
    if (width > 600) {
      expect(Math.abs(geometry.name.width - geometry.action.width)).toBeLessThan(1);
      expect(geometry.action.x).toBeGreaterThan(geometry.name.x + geometry.name.width);
    } else {
      expect(geometry.action.y).toBeGreaterThanOrEqual(geometry.name.bottom);
      expect(Math.abs(geometry.name.width - geometry.action.width)).toBeLessThan(1);
    }
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    await page.locator('.smw-review-create-row').screenshot({
      path: `generated-artifacts/studio-gifts/review-create-${width}.png`, animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    let releaseAudio;
    fixture.hold = new Promise(resolve => { releaseAudio = resolve; });
    fixture.fail = true;
    await upper.click();
    await dialog.getByRole('button', { name: 'Create message', exact: true }).click();
    await checkActions('Recording message', true, true);
    await expect.poll(() => fixture.posts.length).toBe(1);
    releaseAudio();
    await expect(page.getByText('Fixture recording unavailable. Try again.', { exact: true })).toBeVisible();
    await checkActions('Retry message', false);
    fixture.fail = false;
    fixture.hold = null;
    await lower.click();
    await dialog.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Your finished Santa message' })).toBeVisible();
    await expect(page.getByText('Gifts for your completed message.', { exact: false })).toHaveCount(0);
    await checkActions('Create message', false);
    expect(fixture.posts).toHaveLength(2);

    let releaseCheck;
    const accessCheck = new Promise(resolve => { releaseCheck = resolve; });
    await page.route('**/api/santa-studio-message', async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      await accessCheck;
      await route.fulfill({ status: 403, json: { error: 'Access expired.' } });
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByText('Checking your Studio access…', { exact: true })).toBeVisible();
    await checkActions('Create message', true);
    releaseCheck();
    await expect(page.getByRole('button', { name: 'Reload Studio', exact: true })).toBeVisible();
    await checkActions('Create message', true);
    // A confirmed expiry clears temporary output, unlike a transient check failure.
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await expect(page.locator('.smw-message-finished')).toHaveCount(0);
  });
}

test('changing the recorded name refreshes every gift on returning to review', async ({ page }) => {
  test.setTimeout(60000);
  const fixture = await review(page);
  await confirmMessage(page);
  await expect(page.getByRole('img', { name: 'Official Nice List certificate example for Dixie', exact: true })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  const audioUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  await page.route('**/api/santa-names', route => route.fulfill({
    json: { records: [{ id: 'pamela', name: 'Pamela', variant: '',
      selectionToken: 'test-token', previewUrl: '/api/santa-name-preview?token=test-token' }] },
  }));
  await page.getByRole('button', { name: 'Change Their recorded name', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Pamela');
  await page.getByRole('option', { name: /Pamela/ }).first().click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await expect(page.locator('.smw-written-name-value')).toHaveText('Pamela');
  await expect(page.getByRole('img', { name: 'Official Nice List certificate example for Pamela', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Santa’s letter example for Pamela', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Santa’s Nice List picture example for Pamela', exact: true })).toBeVisible();
  await expect(letterText(page)).toContainText('Pamela');
  await expect(letterText(page)).not.toContainText('Dixie');
  await expect(page.locator('.smw-message-result audio')).toHaveAttribute('src', audioUrl);
  expect(fixture.posts).toHaveLength(1);
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  fixture.record = { id: 'pamela', name: 'Pamela', variant: '' };
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  expect(fixture.posts.at(-1).name).toBe('pamela');
  const download = await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/changed-name.pdf');
  expect(download.suggestedFilename()).toContain('Pamela');
  const text = execFileSync('pdftotext', ['generated-artifacts/studio-gifts/changed-name.pdf', '-'], { encoding: 'utf8' });
  expect(text).toContain('Pamela');
  expect(text).not.toContain('Dixie');
});

test('completed gifts stay downloadable when allowance checks fail', async ({ page }) => {
  test.setTimeout(90000);
  mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
  const fixture = await review(page);
  await confirmMessage(page);
  await expect(giftButtons(page)).toHaveCount(3);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  const completedText = await letterText(page).textContent();
  await page.route('**/api/santa-studio-message', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, json: { error: 'Temporarily unavailable.' } }) : route.fallback());
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('Your voucher is recognised, but the recording check failed.');
   for (const button of await page.getByRole('button', { name: 'Create message', exact: true }).all()) await expect(button).toBeDisabled();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(letterText(page)).toHaveText(completedText);
  await assertReadOnly(page, 'Dixie');
  await save(page, 'Download Santa picture (PNG)', 'generated-artifacts/studio-gifts/blocked-creation-picture.png');
  await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/blocked-creation-certificate.pdf');
  await save(page, 'Download letter (PDF)', 'generated-artifacts/studio-gifts/blocked-creation-letter.pdf');
  expect(fixture.posts).toHaveLength(1);
});

  test('refresh requires a new successful MP3 before gifts can be downloaded again', async ({ page }) => {
    test.setTimeout(90000);
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    const fixture = await review(page);
    await confirmMessage(page);
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await page.reload();
    await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dixie');
    await page.getByRole('option', { name: /Dixie/ }).first().click();
    await page.locator('.smw-button-next').click();
    for (const answer of ['9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest']) {
      if (answer === 'The Enchanted Forest') await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
      if (await page.getByRole('button', { name: 'Skip this section', exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
      }
      await page.getByRole('option', { name: answer, exact: true }).click();
      await page.locator('.smw-button-next').click();
    }
    await expect(giftButtons(page)).toHaveCount(3);
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await expect(page.getByRole('link', { name: /Download Audio/ })).toHaveCount(0);
    expect(fixture.recoveries || 0).toBe(0);
    await confirmMessage(page);
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await expect(page.locator('.studio-certificate__name')).toHaveText('Dixie');
    await expect(letterText(page)).toContainText('Completing a jigsaw puzzle');
    await save(page, 'Download Santa picture (PNG)', 'generated-artifacts/studio-gifts/new-session-picture.png');
    expect(fixture.posts).toHaveLength(2);
  });

for (const width of [320, 1365]) {
  test(`bad language blocks spelling confirmation, previews and exports at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Name spelling', exact: true });
    const confirm = page.getByRole('button', { name: 'Use this spelling', exact: true });
    await expect(input).toHaveAttribute('placeholder', 'Name only — no naughty words');
    const warning = 'Bad language is not allowed. Remove it before creating your images.';
    for (const offensive of ['Fuck You', 'Anne Fuck Smith', 'F-u-c-k You', 'Fúck']) {
      await input.fill(offensive);
      await expect(confirm).toBeDisabled();
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toHaveText(warning);
      await expect(page.locator('.studio-certificate__name')).toHaveText('Dixie');
      await expect(page.locator('.studio-gifts__preview-stack .studio-santa-picture__name text')).toHaveText('Dixie');
      await expect(letterText(page)).not.toContainText(offensive);
      for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
      await input.press('Enter');
      await expect(input).toBeVisible();
      // The validator must also reject a submit dispatched without the button.
      await input.locator('..').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await expect(confirm).toBeDisabled();
      await expect(page.locator('.studio-certificate__name')).toHaveText('Dixie');
    }
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    await page.locator('.smw-written-name').screenshot({
      path: `generated-artifacts/studio-gifts/bad-language-${width}.png`, animations: 'disabled',
    });
    await input.fill('Élodie O’Neill');
    await expect(confirm).toBeEnabled();
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.studio-certificate__name')).toHaveText('Élodie O’Neill');
    await confirm.click();
    for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
    await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
    await input.fill('Fuck You');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.studio-certificate__name')).toHaveText('Élodie O’Neill');
    await confirmMessage(page);
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Edit certificate name', exact: true })).toHaveCount(0);
    expect(fixture.posts).toHaveLength(1);
  });
}

for (const width of [320, 1365]) {
  test(`review name editor is inside gifts and previews each keystroke at ${width}px`, async ({ page }) => {
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 900 });
    const gifts = page.locator('.smw-studio-preview .studio-gifts');
    const editorButton = gifts.getByRole('button', { name: 'Edit certificate name', exact: true });
    const original = await letterText(page).locator('p').allTextContents();
    const requests = [];
    page.on('request', request => requests.push(request.url() + (request.postData() || '')));
    const assertName = async name => {
      await expect(gifts.locator('.studio-certificate__name')).toHaveText(name);
      await expect(gifts.locator('.studio-gifts__preview-stack .studio-santa-picture__name text')).toHaveText(name);
      await expect(letterText(page).locator('p')).toHaveText(original.map(text => text.replaceAll('Dixie', name)));
      await expect(page.locator('.smw-written-name-record')).toHaveCount(0);
      await expect(page.locator('.smw-summary-row').filter({ has: page.locator('dt', { hasText: 'Their recorded name' }) })).toContainText('Dixie');
    };
    await editorButton.click();
    const input = gifts.getByRole('textbox', { name: 'Name spelling', exact: true });
    await input.fill('');
    await assertName('');
    for (const name of ['G', 'Gy', 'Gyp', 'Gyps', 'Gypsy']) {
      await input.pressSequentially(name.slice(-1));
      await assertName(name);
      await expect(input).toBeFocused();
    }
    await gifts.screenshot({ path: `generated-artifacts/studio-gifts/live-spelling-${width}.png`, animations: 'disabled' });
    await gifts.getByRole('button', { name: 'Cancel', exact: true }).click();
    await assertName('Dixie');
    await expect(editorButton).toBeFocused();
    await editorButton.click();
    await input.fill('');
    await gifts.getByRole('button', { name: 'Use this spelling', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    await input.fill('Élodie O’Neill');
    await assertName('Élodie O’Neill');
    await gifts.getByRole('button', { name: 'Use this spelling', exact: true }).click();
    await assertName('Élodie O’Neill');
    await editorButton.click();
    await input.fill('Arabella & Doggy');
    await assertName('Arabella & Doggy');
    await gifts.getByRole('button', { name: 'Use this spelling', exact: true }).click();
    await expect(input).toBeHidden();
    await assertName('Arabella & Doggy');
    await editorButton.click();
    await input.fill('Another name');
    await input.press('Escape');
    await assertName('Arabella & Doggy');
    await editorButton.click();
    await gifts.getByRole('button', { name: 'Use recorded spelling', exact: true }).click();
    await assertName('Dixie');
    expect(fixture.posts).toHaveLength(0);
    expect(requests.every(request => !request.includes('Gypsy') && !request.includes('Élodie'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('gifts unlock together, export real local files, retry independently and track completed choices', async ({ page }) => {
  test.setTimeout(120000);
  mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
  let resolveAudio;
  const fixture = await review(page);
  fixture.hold = new Promise(resolve => { resolveAudio = resolve; });
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  const name = 'Élodie O’Neill-Sáenz';
  await spelling(page, 'Elodie');
  const outgoing = [];
  page.on('request', request => outgoing.push({ url: request.url(), body: request.postData() || '' }));
  await confirmMessage(page);
  await expect(page.getByText('Preparing your MP3. Gift downloads unlock together', { exact: false })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  await spelling(page, name);
  const reviewedParagraphs = await letterText(page).locator('p').allTextContents();
  await expect.poll(() => !!resolveAudio).toBe(true);
  resolveAudio();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  fixture.state.pending = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  fixture.state.pending = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(letterText(page).locator('p')).toHaveText(reviewedParagraphs);
  const audioCount = fixture.posts.length;
  const audioUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  await expect(page.getByRole('button', { name: 'Edit certificate name', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Name spelling', exact: true })).toHaveCount(0);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(letterText(page).locator('p')).toHaveText(reviewedParagraphs);
  const certificate = await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/certificate.pdf');
  expect(certificate.suggestedFilename()).toContain(name);
  const letter = await save(page, 'Download letter (PDF)', 'generated-artifacts/studio-gifts/letter.pdf');
  expect(letter.suggestedFilename()).toBe(`Santa-Radio-Letter-${name}.pdf`);
  const letterPdf = await PDFDocument.load(readFileSync('generated-artifacts/studio-gifts/letter.pdf'));
  expect(letterPdf.getPageCount()).toBe(1);
  expect(letterPdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
  expect(letterPdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  const letterType = await page.locator('.studio-gifts__preview-stack .studio-letter__text').evaluate(node => ({
    size: parseFloat(getComputedStyle(node).fontSize),
    width: node.closest('.studio-letter__paper').getBoundingClientRect().width,
  }));
  expect(letterType.size / letterType.width).toBeCloseTo(.0225, 4);
  const extracted = execFileSync('pdftotext', ['-layout', 'generated-artifacts/studio-gifts/letter.pdf', '-'], { encoding: 'utf8' })
    .replace(/\s+/gu, ' ');
  for (const paragraph of reviewedParagraphs) expect(extracted).toContain(paragraph.replace(/\s+/gu, ' '));
  expect(extracted).not.toMatch(/SAMPLE|NORTH POLE PROPERTY/);
  const certText = execFileSync('pdftotext', ['generated-artifacts/studio-gifts/certificate.pdf', '-'], { encoding: 'utf8' });
  expect(certText).toContain(name);
  expect(certText).toMatch(/awarded (?:7[5-9]|8\d|9[0-5])% Nice status/);
  // A corrupt asset (even with HTTP 200) must not lock retries or other gifts.
  await page.route('**/images/santa-nice-list.jpg', route => route.fulfill({ contentType: 'image/jpeg', body: 'broken' }));
  await page.getByRole('button', { name: 'Download Santa picture (PNG)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry download santa picture (png)', exact: true })).toBeEnabled();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('button', { name: 'Retry download santa picture (png)', exact: true }))
    .toHaveCSS('background-color', 'rgb(155, 17, 30)');
  await assertReadOnly(page, name);
  await expect(page.getByRole('button', { name: 'Download letter (PDF)', exact: true })).toBeEnabled();
  await page.unroute('**/images/santa-nice-list.jpg');
  let releasePicture;
  const pictureHold = new Promise(resolve => { releasePicture = resolve; });
  await page.route('**/images/santa-nice-list.jpg', async route => {
    await pictureHold;
    await route.continue();
  });
  const pictureDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Retry download santa picture (png)', exact: true }).click();
  const preparingPicture = page.getByRole('button', { name: 'Preparing picture…', exact: true });
  await expect(preparingPicture).toBeDisabled();
  await expect(preparingPicture).toHaveAttribute('aria-busy', 'true');
  await expect(preparingPicture).toHaveCSS('background-color', 'rgb(247, 239, 217)');
  await assertReadOnly(page, name);
  releasePicture();
  await (await pictureDownload).saveAs('generated-artifacts/studio-gifts/picture.png');
  await page.unroute('**/images/santa-nice-list.jpg');
  const png = readFileSync('generated-artifacts/studio-gifts/picture.png');
  expect(png.readUInt32BE(16)).toBe(1536);
  expect(png.readUInt32BE(20)).toBe(1024);
  await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/certificate-repeat.pdf');
  expect(fixture.posts.length).toBe(audioCount);
  expect(outgoing.every(request => !request.url.includes(encodeURIComponent(name)) && !request.body.includes(name))).toBe(true);
  expect(outgoing.filter(request => !request.url.includes('/api/santa-studio-message'))
    .every(request => !request.body.includes('Dear '))).toBe(true);
  await assertReadOnly(page, name);
  await expect(letterText(page).locator('p')).toHaveText(reviewedParagraphs);
  await page.getByRole('button', { name: 'Download letter (PDF)', exact: true }).focus();
  const keyDownload = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await (await keyDownload).saveAs('generated-artifacts/studio-gifts/keyboard-letter.pdf');
  await save(page, 'Download Santa picture (PNG)', 'generated-artifacts/studio-gifts/repeat-picture.png');
  await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/repeat-certificate.pdf');
  const repeatedLetterText = execFileSync('pdftotext', ['-layout', 'generated-artifacts/studio-gifts/keyboard-letter.pdf', '-'], { encoding: 'utf8' })
    .replace(/\s+/gu, ' ');
  for (const paragraph of reviewedParagraphs) expect(repeatedLetterText).toContain(paragraph.replace(/\s+/gu, ' '));
  expect(fixture.posts.length).toBe(audioCount);
  await expect(page.locator('.smw-message-result audio')).toHaveAttribute('src', audioUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'generated-artifacts/studio-gifts/review-mobile.png', fullPage: true });
  // Edited previews update immediately; exports wait for matching MP3 success.
  const completedText = await letterText(page).textContent();
  await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
  await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await expect(page.getByText('Gift previews reflect your updated choices.', { exact: false })).toBeVisible();
  await expect(letterText(page)).not.toHaveText(completedText);
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  fixture.fail = true;
  fixture.hold = new Promise(resolve => { resolveAudio = resolve; });
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  await expect.poll(() => !!resolveAudio).toBe(true);
  resolveAudio();
  await expect(page.getByText('Fixture recording unavailable. Try again.', { exact: true })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  fixture.fail = false;
  fixture.hold = new Promise(resolve => { resolveAudio = resolve; });
  await confirmMessage(page);
  await expect.poll(() => !!resolveAudio).toBe(true);
  resolveAudio();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(letterText(page)).toContainText('Playing a musical instrument');
  await expect(letterText(page)).not.toHaveText(completedText);
  expect(fixture.posts.at(-1).activity).toBe('instrument');
  const posts = fixture.posts.length;
  await page.reload();
  await expect(giftButtons(page)).toHaveCount(0);
  expect(fixture.posts.length).toBe(posts);
});

test('letter asset failure is retryable; picture fitting shares the review geometry for long names', async ({ page }) => {
  test.setTimeout(90000);
  const fixture = await review(page);
  await confirmMessage(page);
  await expect(giftButtons(page).first()).toBeEnabled();
  const exportErrors = [];
  page.on('console', message => {
    if (message.type() === 'error' && message.text().startsWith('Studio ')) exportErrors.push(message.text());
  });
  await page.route('**/certificates/nice-list/CertificateSerif.ttf', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.getByRole('button', { name: 'Download letter (PDF)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry download letter (pdf)', exact: true })).toBeEnabled();
  expect(exportErrors).toContain('Studio letter gift export failed: Error: Gift asset unavailable');
  await expect(page.getByRole('button', { name: 'Download certificate (PDF)', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download Santa picture (PNG)', exact: true })).toBeEnabled();
  await expect(page.locator('.studio-gift-download p').filter({ hasText: 'Could not prepare this gift.' })).toContainText(
    'Retry above; your audio and other gifts are unaffected. No message allowance is used.');
  await page.unroute('**/certificates/nice-list/CertificateSerif.ttf');
  await save(page, 'Retry download letter (pdf)', 'generated-artifacts/studio-gifts/retry-letter.pdf');
  expect((await PDFDocument.load(readFileSync('generated-artifacts/studio-gifts/retry-letter.pdf'))).getPageCount()).toBe(1);
  expect(fixture.posts).toHaveLength(1);
  await expect(page.locator('.studio-gifts__card--letter .studio-gift-download p')).toContainText(
    'Downloaded');
  for (const name of ['Élodie O’Neill-Sáenz', "Jean-Luc D'Ávila", 'Alexandria-Catherine Elizabeth Montgomery-Worthington', 'É'.repeat(160)]) {
    const result = await page.evaluate(async name => {
      const { fitSantaPictureName, santaPictureFrames } = await import('/src/lib/santaPictureLayout.js');
      const { loadRecipientFont, recipientCanvasFont } = await import('/src/lib/giftFonts.js');
      await loadRecipientFont();
      const context = document.createElement('canvas').getContext('2d');
      return Object.keys(santaPictureFrames).map(picture => {
        const fit = fitSantaPictureName(context, name, picture);
        context.font = recipientCanvasFont(fit.size);
        return fit.lines.map(line => {
          const ink = context.measureText(line.text);
          return { left: line.x - ink.actualBoundingBoxLeft, right: line.x + ink.actualBoundingBoxRight,
            top: line.y - ink.actualBoundingBoxAscent, bottom: line.y + ink.actualBoundingBoxDescent,
            frame: santaPictureFrames[picture] };
        });
      }).flat();
    }, name);
    for (const bounds of result) {
      expect(bounds.left).toBeGreaterThanOrEqual(-1);
      expect(bounds.right).toBeLessThanOrEqual(bounds.frame.width + 1);
      expect(bounds.top).toBeGreaterThanOrEqual(-1);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.frame.height + 1);
    }
  }
});

test('stream completion, cancellation and certificate failures cannot unlock unfinished gifts', async ({ page }) => {
  test.setTimeout(90000);
  await review(page);
  await page.route('**/api/santa-studio-message', route => route.request().method() === 'GET' ? route.fallback() : route.abort());
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    window.giftTestOriginalFetch = realFetch;
    window.fetch = (url, options) => {
      if (url !== '/api/santa-studio-message' || options?.method !== 'POST') return realFetch(url, options);
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          window.giftTestStream = controller;
          controller.enqueue(new Uint8Array([73, 68, 51]));
          options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        },
      }), { headers: { 'Content-Type': 'audio/mpeg' } }));
    };
  });
  await confirmMessage(page);
  await expect(page.getByText('Receiving your finished MP3…', { exact: true })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  await page.evaluate(() => window.giftTestStream.error(new Error('The stream failed.')));
  for (const button of await page.getByRole('button', { name: 'Retry message', exact: true }).all()) await expect(button).toBeEnabled();
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  await confirmMessage(page, 'Retry message');
  await expect(page.getByText('Receiving your finished MP3…', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  // Restore ordinary fetch without reloading the private Studio session.
  await page.evaluate(() => { window.fetch = window.giftTestOriginalFetch; delete window.giftTestOriginalFetch; });
  await page.unroute('**/api/santa-studio-message');
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await page.route('**/certificates/nice-list/master.pdf', route => route.fulfill({ contentType: 'application/pdf', body: 'corrupt PDF' }));
  await page.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry download certificate (pdf)', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download letter (PDF)', exact: true })).toBeEnabled();
  await page.unroute('**/certificates/nice-list/master.pdf');
  await save(page, 'Retry download certificate (pdf)', 'generated-artifacts/studio-gifts/retry-certificate.pdf');
});
