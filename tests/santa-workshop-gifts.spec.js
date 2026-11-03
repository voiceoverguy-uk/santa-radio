import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { confirmMessage, mockStudioGeneration } from './helpers/studio-generation.js';

const giftButtons = page => page.locator('.studio-gift-download button');
const letterText = page => page.locator('.smw-studio-preview .studio-gifts__gallery .studio-gifts__sr');
async function review(page) {
  await unlockWorkshop(page);
  const fixture = await mockStudioGeneration(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
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
  for (const answer of ['9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest']) {
    const skip = page.getByRole('button', { name: 'Skip this section', exact: true });
    if (await skip.isVisible()) await skip.click();
    if (answer === 'The Enchanted Forest') await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
    await page.getByRole('option', { name: answer, exact: true }).click();
    await page.locator('.smw-button-next').click();
  }
  return fixture;
}

async function spelling(page, name) {
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
}

async function save(page, label, file) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await pending;
  await download.saveAs(file);
  return download;
}

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
  await expect(page.getByRole('alert')).toContainText('can’t check how many messages');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(letterText(page)).toHaveText(completedText);
  await save(page, 'Download Santa picture (PNG)', 'generated-artifacts/studio-gifts/blocked-creation-picture.png');
  await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/blocked-creation-certificate.pdf');
  await save(page, 'Download letter (PDF)', 'generated-artifacts/studio-gifts/blocked-creation-letter.pdf');
  expect(fixture.posts).toHaveLength(1);
});

for (const successes of [1, 2]) {
  test(`confirmed gifts restore without MP3 playback with ${successes} completed messages`, async ({ page }) => {
    test.setTimeout(90000);
    mkdirSync('generated-artifacts/studio-gifts', { recursive: true });
    const fixture = await review(page);
    await confirmMessage(page);
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    fixture.state = { ...fixture.state, successes, remaining: 2 - successes };
    await page.route('**/api/santa-studio-message?audio=1', route => route.fulfill({
      status: 503, json: { error: 'Saved MP3 unavailable.' },
    }));
    await page.reload();
    await expect(giftButtons(page)).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await expect(page.getByText('Saved MP3 unavailable.', { exact: true })).toBeVisible();
    await expect(page.locator('.studio-certificate__name')).toHaveText('Dixie');
    await expect(letterText(page)).toContainText('Completing a jigsaw puzzle');
    await save(page, 'Download Santa picture (PNG)', `generated-artifacts/studio-gifts/restored-picture-${successes}.png`);
    expect(fixture.posts).toHaveLength(1);
  });
}

for (const width of [320, 1365]) {
  test(`bad language blocks spelling confirmation, previews and exports at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const fixture = await review(page);
    await page.setViewportSize({ width, height: 900 });
    await confirmMessage(page);
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Name spelling', exact: true });
    const confirm = page.getByRole('button', { name: 'Use this spelling', exact: true });
    await expect(input).toHaveAttribute('placeholder', 'Name only — no swear words');
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
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
    await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
    await input.fill('Fuck You');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.studio-certificate__name')).toHaveText('Élodie O’Neill');
    for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
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
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('Unconfirmed');
  for (const button of await giftButtons(page).all()) await expect(button).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
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
  const extracted = execFileSync('pdftotext', ['-layout', 'generated-artifacts/studio-gifts/letter.pdf', '-'], { encoding: 'utf8' })
    .replace(/\s+/gu, ' ');
  for (const paragraph of reviewedParagraphs) expect(extracted).toContain(paragraph.replace(/\s+/gu, ' '));
  expect(extracted).not.toContain('NORTH POLE PROPERTY');
  const certText = execFileSync('pdftotext', ['generated-artifacts/studio-gifts/certificate.pdf', '-'], { encoding: 'utf8' });
  expect(certText).toContain(name);
  expect(certText).toMatch(/awarded (?:7[5-9]|8\d|9[0-5])% Nice status/);
  // A corrupt asset (even with HTTP 200) must not lock retries or other gifts.
  await page.route('**/images/santa-nice-list.jpg', route => route.fulfill({ contentType: 'image/jpeg', body: 'broken' }));
  await page.getByRole('button', { name: 'Download Santa picture (PNG)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry download santa picture (png)', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download letter (PDF)', exact: true })).toBeEnabled();
  await page.unroute('**/images/santa-nice-list.jpg');
  await save(page, 'Retry download santa picture (png)', 'generated-artifacts/studio-gifts/picture.png');
  const png = readFileSync('generated-artifacts/studio-gifts/picture.png');
  expect(png.readUInt32BE(16)).toBe(1536);
  expect(png.readUInt32BE(20)).toBe(1024);
  await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/certificate-repeat.pdf');
  expect(fixture.posts.length).toBe(audioCount);
  expect(outgoing.every(request => !request.url.includes(encodeURIComponent(name)) && !request.body.includes(name))).toBe(true);
  expect(outgoing.filter(request => !request.url.includes('/api/santa-studio-message'))
    .every(request => !request.body.includes('Dear '))).toBe(true);
  const longName = 'Alexandria-Catherine Elizabeth Montgomery-Worthington';
  await spelling(page, longName);
  await expect(letterText(page).locator('p')).toHaveText(reviewedParagraphs.map(text => text.replaceAll(name, longName)));
  await page.getByRole('button', { name: 'Download letter (PDF)', exact: true }).focus();
  const keyDownload = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await (await keyDownload).saveAs('generated-artifacts/studio-gifts/long-letter.pdf');
  await save(page, 'Download Santa picture (PNG)', 'generated-artifacts/studio-gifts/long-picture.png');
  await save(page, 'Download certificate (PDF)', 'generated-artifacts/studio-gifts/long-certificate.pdf');
  const longLetterText = execFileSync('pdftotext', ['-layout', 'generated-artifacts/studio-gifts/long-letter.pdf', '-'], { encoding: 'utf8' })
    .replace(/\s+/gu, ' ');
  for (const paragraph of reviewedParagraphs) expect(longLetterText).toContain(paragraph.replaceAll(name, longName).replace(/\s+/gu, ' '));
  expect(fixture.posts.length).toBe(audioCount);
  await expect(page.locator('.smw-message-result audio')).toHaveAttribute('src', audioUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'generated-artifacts/studio-gifts/review-mobile.png', fullPage: true });
  // An edited review retains the last successful gift content, but cannot
  // download the edited selection before a replacement MP3 succeeds.
  const completedText = await letterText(page).textContent();
  await page.getByRole('button', { name: 'Edit and regenerate once', exact: true }).click();
  await page.getByRole('button', { name: 'Change Working hard at', exact: true }).click();
  await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
  await page.locator('.smw-button-next').click();
  await expect(page.getByText('Showing the last completed gift set', { exact: false })).toBeVisible();
  await expect(letterText(page)).toHaveText(completedText);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  fixture.fail = true;
  fixture.hold = new Promise(resolve => { resolveAudio = resolve; });
  await confirmMessage(page);
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect.poll(() => !!resolveAudio).toBe(true);
  resolveAudio();
  await expect(page.getByText('Fixture recording unavailable. Try again.', { exact: true })).toBeVisible();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  fixture.fail = false;
  fixture.hold = new Promise(resolve => { resolveAudio = resolve; });
  await confirmMessage(page);
  await expect.poll(() => !!resolveAudio).toBe(true);
  resolveAudio();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  await expect(letterText(page)).toContainText('Playing a musical instrument');
  await expect(letterText(page)).not.toHaveText(completedText);
  expect(fixture.state.successes).toBe(2);
  const posts = fixture.posts.length;
  await page.reload();
  for (const button of await giftButtons(page).all()) await expect(button).toBeEnabled();
  expect(fixture.posts.length).toBe(posts);
  await expect(letterText(page)).toContainText('Playing a musical instrument');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
});

test('letter asset failure is retryable; picture fitting shares the review geometry for long names', async ({ page }) => {
  test.setTimeout(90000);
  await review(page);
  await confirmMessage(page);
  await expect(giftButtons(page).first()).toBeEnabled();
  await page.route('**/certificates/nice-list/CertificateSerif.ttf', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.getByRole('button', { name: 'Download letter (PDF)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry download letter (pdf)', exact: true })).toBeEnabled();
  await page.unroute('**/certificates/nice-list/CertificateSerif.ttf');
  await save(page, 'Retry download letter (pdf)', 'generated-artifacts/studio-gifts/retry-letter.pdf');
  for (const name of ['Élodie O’Neill-Sáenz', "Jean-Luc D'Ávila", 'Alexandria-Catherine Elizabeth Montgomery-Worthington', 'É'.repeat(160)]) {
    const result = await page.evaluate(async name => {
      const { fitSantaPictureName, santaPictureFrames } = await import('/src/lib/santaPictureLayout.js');
      await document.fonts.load('1000px "Great Vibes"', name);
      const context = document.createElement('canvas').getContext('2d');
      return Object.keys(santaPictureFrames).map(picture => {
        const fit = fitSantaPictureName(context, name, picture);
        context.font = `${fit.size}px "Great Vibes"`;
        const ink = context.measureText(name);
        return { left: fit.x - ink.actualBoundingBoxLeft, right: fit.x + ink.actualBoundingBoxRight,
          top: fit.y - ink.actualBoundingBoxAscent, bottom: fit.y + ink.actualBoundingBoxDescent,
          frame: santaPictureFrames[picture] };
      });
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
  await expect(page.getByRole('button', { name: 'Retry message', exact: true })).toBeEnabled();
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
