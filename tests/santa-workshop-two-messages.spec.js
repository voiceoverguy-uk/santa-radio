import { expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { execFileSync } from 'node:child_process';
import { test } from './helpers/provider-test.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { confirmMessage, mockStudioGeneration } from './helpers/studio-generation.js';

const records = [
  { id: 'dixie-variant', name: 'Dixie' },
  { id: 'arabella-fixture', name: 'Arabella' },
];
const players = page => page.locator('.smw-message-finished audio');
const gifts = page => page.locator('.smw-written-name .studio-gift-download button');
const letter = page => page.locator('.smw-written-name .studio-gifts__preview-stack .studio-gifts__sr');

async function setup(page, limited = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-workshop-access', route => route.fulfill({ json: {
    authorized: true, expiresAt: Date.now() + 3600000,
    voucher: { code: 'isolated-visit-fixture', unlimited: !limited },
  } }));
  const fixture = await mockStudioGeneration(page, { limited });
  fixture.selection = choices => ({ record: records.find(record => record.id === choices.name), choices });
  await page.route('**/api/santa-workshop-catalogue*', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-names', route => route.fulfill({ json: {
    records: records.filter(record => record.name === route.request().postDataJSON().query).map(record => ({ ...record, selectionToken: 'fixture',
      previewUrl: '/api/santa-name-preview?token=fixture' })),
  } }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  return fixture;
}

async function compose(page, second = false) {
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill(second ? 'Arabella' : 'Dixie');
  await page.getByRole('option', { name: second ? 'Arabella' : 'Dixie', exact: true }).click();
  await page.locator('.smw-actions .smw-button-next').click();
  for (const answer of ['9 years old', null, second ? 'Playing a musical instrument' : 'Teamwork',
    'Completing a jigsaw puzzle', 'Bûche de Noël', 'England']) {
    if (answer === null) { await page.getByRole('button', { name: 'Skip this section' }).click(); continue; }
    await page.getByRole('option', { name: answer, exact: true }).click();
    await page.locator('.smw-actions .smw-button-next').click();
  }
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill(second ? 'Arabella May' : 'Dixie Rose');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
}

async function downloadGift(page, kind) {
  const pending = page.waitForEvent('download');
  await page.locator(`.smw-written-name .studio-gifts__card--${kind} .studio-gift-download button`).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  return download;
}

async function exportFirstWhileDrafting(page, expectedLetter) {
  const retained = page.locator('.smw-retained-gifts');
  const summary = retained.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(retained).toHaveAttribute('open', '');
  await expect(retained.locator('.studio-gifts__preview-stack .studio-certificate__name')).toHaveText('Dixie Rose');
  await expect(retained.locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText('Dixie Rose');
  await expect(retained.locator('.studio-gifts__preview-stack .studio-gifts__sr p')).toHaveText(expectedLetter);
  for (const kind of ['certificate', 'letter', 'picture']) {
    const pending = page.waitForEvent('download');
    await retained.locator(`.studio-gifts__card--${kind} .studio-gift-download button`).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toContain('Dixie');
    if (kind !== 'picture') {
      const text = execFileSync('pdftotext', ['-layout', await download.path(), '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
      expect(text).toContain('Dixie Rose');
      expect(text).not.toContain('Arabella May');
      if (kind === 'letter') for (const paragraph of expectedLetter) expect(text).toContain(paragraph.replace(/\s+/gu, ' ').trim());
    }
  }
  for (const button of await gifts(page).all()) await expect(button).toBeDisabled();
  await summary.click();
}

for (const width of [320, 1365]) {
  test(`two visit-local messages keep independent audio and gifts at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = await setup(page);
    await compose(page);
    const firstLetter = await letter(page).locator('p').allTextContents();
    await confirmMessage(page);
    await expect(players(page)).toHaveCount(1);
    const firstUrl = await players(page).first().getAttribute('src');
    await downloadGift(page, 'certificate');
    await players(page).first().evaluate(async node => { window.firstStudioPlayer = node; await node.play(); });
    await page.getByRole('button', { name: 'Start Again', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.firstStudioPlayer.paused)).toBe(true);
    await compose(page, true);
    await expect(players(page)).toHaveCount(1);
    await expect(players(page).first()).toHaveAttribute('src', firstUrl);
    await expect(page.locator('.smw-message-finished h4')).toContainText('Dixie Rose');
    for (const button of await gifts(page).all()) await expect(button).toBeDisabled();
    const secondLetter = await letter(page).locator('p').allTextContents();
    expect(secondLetter).not.toEqual(firstLetter);
    expect(secondLetter.join(' ')).toContain('Arabella May');
    await exportFirstWhileDrafting(page, firstLetter);
    // Navigating details does not destroy either draft or the first completion.
    await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
    await page.getByRole('button', { name: 'Return to review', exact: true }).click();
    await expect(players(page).first()).toHaveAttribute('src', firstUrl);
    let release;
    fixture.hold = new Promise(resolve => { release = resolve; });
    await confirmMessage(page);
    await expect(page.getByRole('button', { name: 'Cancel preparation' })).toBeVisible();
    await expect(players(page).first()).toHaveAttribute('src', firstUrl);
    await page.getByRole('button', { name: 'Cancel preparation' }).click();
    fixture.fail = true;
    release();
    fixture.hold = null;
    await confirmMessage(page);
    await expect(page.getByRole('alert')).toContainText('Fixture recording unavailable');
    await expect(players(page).first()).toHaveAttribute('src', firstUrl);
    const pendingFirst = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download Audio', exact: true }).click();
    expect((await pendingFirst).suggestedFilename()).toContain('Dixie Rose');
    for (const button of await gifts(page).all()) await expect(button).toBeDisabled();
    await exportFirstWhileDrafting(page, firstLetter);
    fixture.fail = false;
    await confirmMessage(page, 'Retry message');
    await expect(players(page)).toHaveCount(2);
    await expect(page.locator('.smw-message-finished h4')).toHaveText([
      'First Santa message for Dixie Rose', 'Second Santa message for Arabella May',
    ]);
    const urls = await players(page).evaluateAll(nodes => nodes.map(node => node.src));
    expect(urls[0]).toBe(firstUrl);
    expect(urls[1]).not.toBe(urls[0]);
    await expect(page.locator('.smw-remaining')).toContainText('0 of 2');
    const first = page.getByRole('button', { name: '1st message gifts for Dixie Rose', exact: true });
    const second = page.getByRole('button', { name: '2nd message gifts for Arabella May', exact: true });
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.studio-gifts__card--certificate .studio-gift-download p')).toContainText('Ready.');
    // Switching and reset cannot discard an in-flight local export.
    let releaseExport;
    const exportHold = new Promise(resolve => { releaseExport = resolve; });
    await page.route('**/images/santa-radio-letterhead.webp', async route => {
      await exportHold;
      await route.fulfill({ status: 503, body: 'Isolated export failure' });
    });
    await expect(letter(page).locator('p')).toHaveText(secondLetter);
    for (const button of await gifts(page).all()) await expect(button).toBeEnabled();
    await page.locator('.studio-gifts__card--letter .studio-gift-download button').click();
    await expect(first).toBeDisabled();
    await expect(second).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start Again', exact: true })).toBeDisabled();
    releaseExport();
    await expect(page.getByRole('button', { name: 'Retry download letter (pdf)', exact: true })).toBeVisible();
    await page.unroute('**/images/santa-radio-letterhead.webp');
    // Each MP3 downloads its own original bytes and confirmed written name.
    for (const [index, name] of ['Dixie Rose', 'Arabella May'].entries()) {
      const pending = page.waitForEvent('download');
      await page.locator('.smw-message-finished').nth(index).getByRole('link').click();
      const download = await pending;
      expect(download.suggestedFilename()).toContain(name);
      expect(readFileSync(await download.path())).toEqual(fixture.audio);
    }
    await players(page).first().evaluate(node => node.play());
    await players(page).nth(1).evaluate(node => node.play());
    expect(await players(page).first().evaluate(node => node.paused)).toBe(true);
    await players(page).nth(1).evaluate(node => node.pause());
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(letter(page).locator('p')).toHaveText(firstLetter);
    await expect(page.locator('.studio-gifts__card--certificate .studio-gift-download p')).toContainText('Download requested');
    await expect(page.locator('.studio-gifts__card--letter .studio-gift-download p')).toContainText('Download requested');
    for (const [selector, name, expectedLetter] of [[first, 'Dixie Rose', firstLetter], [second, 'Arabella May', secondLetter]]) {
      await selector.focus();
      await page.keyboard.press('Space');
      for (const kind of ['certificate', 'letter', 'picture']) {
        const download = await downloadGift(page, kind);
        expect(download.suggestedFilename()).toContain(name.split(' ')[0]);
        if (kind !== 'picture') {
          const text = execFileSync('pdftotext', ['-layout', await download.path(), '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
          expect(text).toContain(name);
          if (kind === 'letter') for (const paragraph of expectedLetter) expect(text).toContain(paragraph.replace(/\s+/gu, ' ').trim());
        } else expect(readFileSync(await download.path()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `generated-artifacts/studio-two-messages-${width}.png`, fullPage: true });
    const posts = fixture.posts.length;
    // Service-check errors preserve both results and all gift access.
    await page.route('**/api/santa-studio-message', route => route.request().method() === 'GET'
      ? route.fulfill({ status: 503, json: { error: 'Fixture check unavailable' } }) : route.fallback());
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('alert')).toContainText('recording check failed');
    await first.click();
    for (const button of await gifts(page).all()) await expect(button).toBeEnabled();
    await expect(players(page)).toHaveCount(2);
    expect(fixture.posts).toHaveLength(posts);
    // A genuine expiry, unlike a service outage, releases every retained URL.
    await page.route('**/api/santa-studio-message', route => route.fulfill({ status: 410, json: {} }));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(players(page)).toHaveCount(0);
    await expect(first).toHaveCount(0);
    for (const url of urls) expect(await page.evaluate(async url => {
      try { await fetch(url); return true; } catch { return false; }
    }, url)).toBe(false);
  });
}

test('unlimited visitor must confirm discarding both results; exit never restores them', async ({ page }) => {
  test.setTimeout(120000);
  const fixture = await setup(page, false);
  await compose(page); await confirmMessage(page);
  await expect(players(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Start Again', exact: true }).click();
  await compose(page, true); await confirmMessage(page);
  await expect(players(page)).toHaveCount(2);
  const urls = await players(page).evaluateAll(nodes => nodes.map(node => node.src));
  await page.getByRole('button', { name: 'Start Again', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('all retained recordings and their gifts');
  await expect(page.getByRole('dialog')).toContainText('Dixie Rose and Arabella May');
  await page.keyboard.press('Escape');
  await expect(players(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Start Again', exact: true }).click();
  const back = page.getByRole('button', { name: 'Back to downloads', exact: true });
  const discard = page.getByRole('button', { name: 'Discard recording and start again', exact: true });
  await expect(back).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(discard).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  await back.click();
  await expect(players(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Start Again', exact: true }).click();
  await discard.click();
  await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toBeVisible();
  for (const url of urls) expect(await page.evaluate(async url => {
    try { await fetch(url); return true; } catch { return false; }
  }, url)).toBe(false);
  await compose(page); await confirmMessage(page);
  await expect(players(page)).toHaveCount(1);
  const url = await players(page).getAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(players(page)).toHaveCount(0);
  for (const button of await gifts(page).all()) await expect(button).toBeDisabled();
  expect(await page.evaluate(async url => {
    try { await fetch(url); return true; } catch { return false; }
  }, url)).toBe(false);
  await page.reload();
  await expect(players(page)).toHaveCount(0);
  expect(fixture.recoveries || 0).toBe(0);
});

for (const ending of ['pagehide', 'navigation']) {
  test(`both completed messages are released on ${ending}`, async ({ page }) => {
    test.setTimeout(60000);
    await setup(page);
    await compose(page); await confirmMessage(page);
    await expect(players(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Start Again', exact: true }).click();
    await compose(page, true); await confirmMessage(page);
    await expect(players(page)).toHaveCount(2);
    const urls = await players(page).evaluateAll(nodes => nodes.map(node => node.src));
    if (ending === 'pagehide') {
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    } else {
      await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
      await page.goBack();
    }
    await expect(players(page)).toHaveCount(0);
    await expect(page.locator('.smw-gift-selector')).toHaveCount(0);
    for (const url of urls) expect(await page.evaluate(async url => {
      try { await fetch(url); return true; } catch { return false; }
    }, url)).toBe(false);
  });
}

test('a first-message gift export survives the second MP3 finishing', async ({ page }) => {
  test.setTimeout(60000);
  const fixture = await setup(page);
  await compose(page); await confirmMessage(page);
  await expect(players(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Start Again', exact: true }).click();
  await compose(page, true);
  let releaseAudio, releaseGift;
  fixture.hold = new Promise(resolve => { releaseAudio = resolve; });
  const giftHold = new Promise(resolve => { releaseGift = resolve; });
  await page.route('**/certificates/nice-list/master.pdf', async route => {
    await giftHold;
    await route.fallback();
  });
  await confirmMessage(page);
  const retained = page.locator('.smw-retained-gifts');
  await retained.locator('summary').click();
  const pendingDownload = page.waitForEvent('download');
  await retained.getByRole('button', { name: 'Download certificate (PDF)', exact: true }).click();
  await expect(retained.getByRole('button', { name: 'Preparing certificate…', exact: true })).toBeVisible();
  releaseAudio();
  await expect(players(page)).toHaveCount(2);
  await expect(retained).toBeVisible();
  await expect(page.getByRole('button', { name: '1st message gifts for Dixie Rose', exact: true })).toBeDisabled();
  releaseGift();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toContain('Dixie');
  expect(await download.failure()).toBeNull();
  await expect(retained).toHaveCount(0);
  const first = page.getByRole('button', { name: '1st message gifts for Dixie Rose', exact: true });
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.locator('.studio-gifts__card--certificate .studio-gift-download p')).toContainText('Download requested');
  expect(fixture.posts).toHaveLength(2);
});

async function inspectBundle(download, name, paragraphs, audio, prefix) {
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe(`Santa-Radio-Audio-And-Gifts-${name}.zip`);
  const files = unzipSync(readFileSync(await download.path()));
  expect(Object.keys(files).sort()).toEqual([
    `Santa-message-for-${name}.mp3`,
    `Santa-Radio-Nice-List-Certificate-${name}.pdf`,
    `Santa-Radio-Letter-${name}.pdf`,
    `Santa-Radio-Santa-Picture-${name}.png`,
  ].sort());
  expect(Buffer.from(files[`Santa-message-for-${name}.mp3`])).toEqual(audio);
  mkdirSync('generated-artifacts/studio-bundles', { recursive: true });
  for (const kind of ['Nice-List-Certificate', 'Letter']) {
    const bytes = files[`Santa-Radio-${kind}-${name}.pdf`];
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    const path = `generated-artifacts/studio-bundles/${prefix}-${kind}.pdf`;
    writeFileSync(path, bytes);
    const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
    expect(text).toContain(name);
    expect(text).not.toMatch(/SAMPLE|NORTH POLE PROPERTY/);
    if (kind === 'Letter') for (const paragraph of paragraphs) expect(text).toContain(paragraph.replace(/\s+/gu, ' '));
  }
  const png = Buffer.from(files[`Santa-Radio-Santa-Picture-${name}.png`]);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1536, 1024]);
  writeFileSync(`generated-artifacts/studio-bundles/${prefix}-picture.png`, png);
  return png;
}

for (const width of [320, 1365]) {
  test(`Studio recording ZIP binds all four files to each completion at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = await setup(page);
    await compose(page);
    // Preserve a non-ASCII confirmed spelling, including in ZIP entry names.
    await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('Élodie O’Neill');
    await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
    const firstLetter = await letter(page).locator('p').allTextContents();
    await confirmMessage(page);
    await expect(players(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Start Again', exact: true }).click();
    await compose(page, true);
    const secondLetter = await letter(page).locator('p').allTextContents();
    // First bundle works while the second recipient's gifts are still locked.
    const firstResult = page.locator('.smw-message-finished').first();
    let pending = page.waitForEvent('download');
    await firstResult.getByRole('button', { name: 'Download All', exact: true }).click();
    await inspectBundle(await pending, 'Élodie O’Neill', firstLetter, fixture.audio, `draft-${width}`);
    for (const button of await gifts(page).all()) await expect(button).toBeDisabled();
    await confirmMessage(page);
    await expect(players(page)).toHaveCount(2);
    await expect(page.locator('.smw-remaining')).toContainText('0 of 2');
    const remaining = fixture.state.remaining;
    let release, started;
    const hold = new Promise(resolve => { release = resolve; });
    const exporting = new Promise(resolve => { started = resolve; });
    await page.route('**/images/santa-radio-letterhead.webp', async route => { started(); await hold; await route.fallback(); });
    const all = firstResult.getByRole('button', { name: 'Download All', exact: true });
    await all.focus();
    await page.keyboard.press('Enter');
    await expect(firstResult.getByRole('button', { name: 'Preparing ZIP…' })).toBeDisabled();
    await exporting;
    // Repeated requests must not start another export or another creation.
    await firstResult.locator('.smw-bundle-download button').evaluate(node => { node.click(); node.click(); });
    await expect(page.getByRole('button', { name: 'Start Again', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '1st message gifts for Élodie O’Neill', exact: true }).click();
    await page.getByRole('button', { name: '2nd message gifts for Arabella May', exact: true }).click();
    // Direct MP3 access does not wait for gift rendering.
    pending = page.waitForEvent('download');
    await firstResult.getByRole('link', { name: 'Download Audio', exact: true }).click();
    expect(readFileSync(await (await pending).path())).toEqual(fixture.audio);
    pending = page.waitForEvent('download');
    release();
    const firstPng = await inspectBundle(await pending, 'Élodie O’Neill', firstLetter, fixture.audio, `first-${width}`);
    await page.unroute('**/images/santa-radio-letterhead.webp');
    const secondResult = page.locator('.smw-message-finished').nth(1);
    pending = page.waitForEvent('download');
    await secondResult.getByRole('button', { name: 'Download All', exact: true }).focus();
    await page.keyboard.press('Space');
    const secondPng = await inspectBundle(await pending, 'Arabella May', secondLetter, fixture.audio, `second-${width}`);
    expect(firstPng.equals(secondPng)).toBe(false);
    await expect(firstResult.locator('.smw-bundle-download [role=status]')).toContainText('does not confirm it was saved');
    await expect(page.locator('.studio-gift-download p')).toHaveText(Array(3)
      .fill('Download requested. Check your browser’s downloads; keep your own copy.'));
    expect(fixture.posts).toHaveLength(2);
    expect(fixture.state.remaining).toBe(remaining);
    expect(fixture.recoveries || 0).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await secondResult.screenshot({ path: `generated-artifacts/studio-bundles/controls-${width}.png` });
  });
}

test('Studio recording ZIP failure retries independently; expiry cancels in-flight work and URLs', async ({ page }) => {
  test.setTimeout(90000);
  const fixture = await setup(page, false);
  await compose(page); await confirmMessage(page);
  const result = page.locator('.smw-message-finished');
  await expect(result).toBeVisible();
  const paragraphs = await letter(page).locator('p').allTextContents();
  await page.route('**/images/santa-radio-letterhead.webp', route => route.fulfill({ status: 503, body: 'Failed fixture' }));
  await result.getByRole('button', { name: 'Download All', exact: true }).click();
  await expect(result.getByRole('alert')).toContainText('No creation allowance is used');
  await expect(result.getByRole('link')).toHaveClass(/--pending/);
  for (const button of await gifts(page).all()) await expect(button).toBeEnabled();
  await page.unroute('**/images/santa-radio-letterhead.webp');
  // Track only actual ZIP download URLs; their lifetime ends with the visit.
  await page.evaluate(() => {
    window.bundleUrls = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = create(blob);
      if (blob.type === 'application/zip') window.bundleUrls.push(url);
      return url;
    };
  });
  const pending = page.waitForEvent('download');
  await result.getByRole('button', { name: 'Retry Download All', exact: true }).click();
  await inspectBundle(await pending, 'Dixie Rose', paragraphs, fixture.audio, 'retry');
  await expect(result.getByRole('link')).not.toHaveClass(/--pending/);
  for (const ending of ['pagehide', 'expiry']) {
    if (ending === 'expiry') {
      await page.reload(); await compose(page); await confirmMessage(page);
      await expect(result).toBeVisible();
    }
    let release, started;
    const hold = new Promise(resolve => { release = resolve; });
    const exporting = new Promise(resolve => { started = resolve; });
    await page.route('**/images/santa-radio-letterhead.webp', async route => { started(); await hold; await route.fallback(); });
    await result.getByRole('button', { name: 'Download All', exact: true }).click();
    await expect(result.getByRole('button', { name: 'Preparing ZIP…' })).toBeDisabled();
    await exporting;
    const lateDownloads = [];
    const collect = download => lateDownloads.push(download);
    page.on('download', collect);
    if (ending === 'pagehide') await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    else {
      await page.route('**/api/santa-studio-message*', route => route.fulfill({ status: 410, json: {} }));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    }
    await expect(result).toHaveCount(0);
    const response = page.waitForResponse('**/images/santa-radio-letterhead.webp');
    release();
    await response;
    // Let the cancelled renderer finish; it must not request any file.
    await page.waitForTimeout(1000);
    expect(lateDownloads).toHaveLength(0);
    page.off('download', collect);
    await page.unroute('**/images/santa-radio-letterhead.webp');
    expect(await page.evaluate(async () => {
      for (const url of window.bundleUrls || []) { try { await fetch(url); return false; } catch {} }
      return true;
    })).toBe(true);
  }
  expect(fixture.posts).toHaveLength(2);
});
