import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { ANALYSIS_MS, CHECKER_LAUNCH_MS, HOMEPAGE_ANALYSIS_MS } from '../src/naughty-or-nice/checkerLogic.js';

test.use({ reducedMotion: 'reduce' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
  });
  await page.route('**/names-data/*.json', route => route.fulfill({ json: ['Zorabelle', 'Erin'] }));
});

async function result(page, naughty) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
  const widget = page.locator('#nice-list');
  await widget.getByRole('combobox').fill('Zorabelle');
  await widget.getByRole('button', { name: 'Check', exact: true }).click();
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS + 100);
  await widget.getByRole('link', { name: 'Lets check with Head Elf', exact: true }).click();
  await page.clock.setSystemTime(new Date('2026-11-05T12:00:00Z'));
  await page.clock.pauseAt(new Date('2026-11-05T12:00:01Z'));
  await page.getByRole('button', { name: 'Sound: on' }).click();
  await page.getByRole('combobox').fill('Zorabelle');
  await page.getByRole('button', { name: 'Is Zorabelle Naughty or Nice?', exact: true }).click();
  await page.clock.runFor(1900);
  for (let question = 0; question < 10; question++) {
    await expect(page.locator('.nn-question-count')).toHaveText(`${question + 1} of 10`);
    await page.getByRole('button', { name: naughty ? 'No' : 'Yes', exact: true }).click();
  }
  await page.locator('.nn-final-check').click();
  await page.clock.runFor(ANALYSIS_MS + 100);
  await expect(page.locator('.nn-result')).toBeVisible();
}

for (const naughty of [false, true]) {
  test(`${naughty ? 'Naughty' : 'Nice'} Head Elf certificate enlarges, traps focus and offers its PDF`, async ({ page }, testInfo) => {
    await result(page, naughty);
    const kind = naughty ? 'Naughty' : 'Nice';
    if (!naughty) {
      await expect(page.locator('.nn-result > p').last()).toHaveText('Well Done Zorabelle Only 50 days to go. Keep sharing, helping and being kind. Little acts of kindness make Christmas brighter!');
      const colours = await page.locator('.nn-result--nice').evaluate(element =>
        [...getComputedStyle(element).backgroundImage.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)]
          .map(match => match.slice(1).map(Number)));
      expect(colours.length).toBeGreaterThanOrEqual(2);
      expect(colours.every(([red, green, blue]) => red >= green && green > blue)).toBe(true);
      await page.locator('.nn-result--nice').screenshot({ path: testInfo.outputPath('nice-result-gold-desktop.png'), animations: 'disabled' });
    }
    const trigger = page.getByRole('button', { name: `Enlarge ${kind} List certificate` });
    const inline = await page.locator('.nn-certificate-gift > .nn-certificate-preview').boundingBox();
    const oldOverflow = await page.evaluate(() => document.body.style.overflow);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: `${kind} List certificate preview` });
    const close = dialog.getByRole('button', { name: 'Close certificate preview' });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await expect(dialog.locator('.studio-certificate__name')).toHaveAttribute('data-fitted', 'true');
    expect((await dialog.locator('.studio-certificate').boundingBox()).width).toBeGreaterThan(inline.width);
    await expect(dialog.getByRole('button', { name: `Download ${kind} certificate PDF` })).toHaveCount(1);
    for (const [width, height, font] of [[1280, 900, ''], [390, 844, ''], [320, 844, ''], [844, 390, ''], [320, 844, '200%']]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(size => { document.documentElement.style.fontSize = size; }, font);
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      const art = await dialog.locator('.studio-certificate').boundingBox();
      expect(art.width / art.height).toBeCloseTo(1684 / 1191, 2);
      expect(art.x).toBeGreaterThanOrEqual(box.x);
      expect(art.x + art.width).toBeLessThanOrEqual(box.x + box.width + 1);
      await expect(close).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1280 || (width === 390 && !font))
        await dialog.screenshot({ path: testInfo.outputPath(`enlarged-${kind}-${width}.png`), animations: 'disabled' });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await close.focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: `Download ${kind} certificate PDF` })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(oldOverflow);
    await trigger.click();
    await close.click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(1, 1);
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    if (!naughty) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.nn-result--nice').screenshot({ path: testInfo.outputPath('nice-result-gold-phone.png'), animations: 'disabled' });
      await page.clock.setSystemTime(new Date('2026-12-24T23:59:30Z'));
      await page.clock.runFor(60000);
      await expect(page.locator('.nn-result > p').last()).toHaveText('Well Done Zorabelle Only 0 days to go. Keep sharing, helping and being kind. Little acts of kindness make Christmas brighter!');
      await expect(page.getByRole('button', { name: 'Download Nice certificate PDF' })).toBeVisible();
    }
  });
}

test('Naughty PDF is local, personalised, retryable and cancelled on restart', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const requests = [];
  const downloads = [];
  page.on('request', request => requests.push(`${request.url()} ${request.postData() || ''}`));
  page.on('download', download => downloads.push(download));
  await result(page, true);
  await expect(page.locator('.nn-result > h2')).toHaveText('Oh no! NAUGHTY LIST');
  await expect(page.locator('.nn-result > p').last()).toHaveText("Zorabelle don't panic! With 50 days to go until Christmas there is still time to work on it and come and try again.");
  const button = page.getByRole('button', { name: 'Download Naughty certificate PDF' });
  let fail = true;
  await page.route('**/certificates/checker/naughty-master.webp', route =>
    fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
  await button.click();
  await expect(page.getByRole('alert')).toHaveText('The PDF could not be created. Please try downloading again.');
  expect(downloads).toHaveLength(0);
  await expect(button).toBeEnabled();
  fail = false;
  await page.evaluate(() => {
    const draw = CanvasRenderingContext2D.prototype.fillText;
    window.certificatePaint = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.certificatePaint.push(text);
      return draw.call(this, text, ...args);
    };
  });
  const downloading = page.waitForEvent('download');
  await button.click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('Head-Elf-Naughty-List-Certificate.pdf');
  const output = testInfo.outputPath('naughty-certificate.pdf');
  await file.saveAs(output);
  const bytes = await readFile(output);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(841.8898, 3);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(595.2756, 3);
  expect(pdf.getTitle()).toBe('Head Elf’s Very Unofficial Naughty List Certificate');
  expect(await page.evaluate(() => window.certificatePaint)).toEqual(['Zorabelle']);
  // The encouragement stays in both on-screen previews, not the saved PDF.
  await expect(page.locator('.nn-certificate-stamp')).toContainText('50 DAYS TO GOTHERE IS STILL TIME');
  await page.getByRole('button', { name: 'Enlarge Naughty List certificate' }).click();
  await expect(page.getByRole('dialog').locator('.nn-certificate-stamp')).toContainText('THERE IS STILL TIME');
  await page.getByRole('button', { name: 'Close certificate preview' }).click();
  expect(requests.some(request => request.includes('Zorabelle'))).toBe(false);
  expect(requests.some(request => request.includes('/nice-list/master.pdf'))).toBe(false);
  await expect(button).toBeEnabled();
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]).includes('/certificates/checker/naughty-master.webp')) {
        window.exportSignal = args[1].signal;
        await new Promise(resolve => { window.releaseCertificateExport = resolve; });
      }
      return response;
    };
  });
  await button.click();
  await expect.poll(() => page.evaluate(() => typeof window.releaseCertificateExport)).toBe('function');
  await page.getByRole('button', { name: 'Start a new name check' }).click();
  expect(await page.evaluate(() => window.exportSignal.aborted)).toBe(true);
  await page.evaluate(() => window.releaseCertificateExport());
  await expect(page.locator('.nn-result')).toHaveCount(0);
  expect(downloads).toHaveLength(1);
});

test('Nice Head Elf PDF downloads locally with the new artwork and name, not the Studio master', async ({ page }, testInfo) => {
  const requests = [];
  page.on('request', request => requests.push(`${request.url()} ${request.postData() || ''}`));
  await result(page, false);
  requests.length = 0;
  await expect(page.locator('.nn-kicker')).toHaveText('HEAD ELF’S VERY UNOFFICIAL VERDICT');
  await expect(page.locator('.nn-certificate-preview img')).toHaveAttribute('src', '/certificates/checker/nice-master.webp');
  await expect(page.getByRole('button', { name: 'Try again from the start' })).toHaveCount(0);
  const arrow = page.getByRole('button', { name: 'Start a new name check' });
  const sound = page.getByRole('button', { name: 'Sound: off' });
  const left = await arrow.boundingBox(), right = await sound.boundingBox();
  expect(left.x + left.width).toBeLessThan(right.x);
  await page.evaluate(() => {
    const paint = CanvasRenderingContext2D.prototype.fillText;
    window.niceCertificatePaint = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.niceCertificatePaint.push(text); return paint.call(this, text, ...args);
    };
  });
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Nice certificate PDF' }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('Head-Elf-Nice-List-Certificate.pdf');
  const output = testInfo.outputPath('nice-head-elf-certificate.pdf');
  await file.saveAs(output);
  const pdf = await PDFDocument.load(await readFile(output));
  expect(pdf.getTitle()).toBe('Head Elf’s Very Unofficial Nice List Certificate');
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(841.8898, 3);
  expect(await page.evaluate(() => window.niceCertificatePaint)).toContain('Zorabelle');
  expect(await page.evaluate(() => window.niceCertificatePaint)).not.toContain('THERE IS STILL TIME');
  expect(requests.some(request => request.includes('Zorabelle'))).toBe(false);
  expect(requests.some(request => /\/certificates\/(?:nice-list\/master.pdf|examples\/blank-master.webp)/.test(request))).toBe(false);
  await arrow.click();
  await expect(page.getByRole('combobox', { name: 'Confirm first name' })).toHaveValue('');
  await expect(page.getByRole('combobox')).toBeFocused();
  await expect(arrow).toHaveCount(0);
});
