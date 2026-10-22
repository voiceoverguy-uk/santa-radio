import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { openMessageDesk } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY } from '../src/lib/santaMessageAllowance.js';

const audio = readFileSync('server/santa-audio/sleighbells.mp3');
const names = ['Olivia', 'Alexandria-Catherine Elizabeth Montgomery-Worthington', "Élodie O’Neill-Sáenz", 'Erin'];
const records = names.map((name, index) => ({
  id: `opaque-recording-${index}`, name, downloadName: `audio-${index}.mp3`,
}));
const certificateButton = result => result.getByRole('button', { name: 'Download your Nice List certificate', exact: true });
const usage = page => page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);

async function setup(page) {
  let generations = 0;
  await page.addInitScript(() => {
    window.testNow = 1801915200000;
    Date.now = () => window.testNow;
    window.sharedGreetingCount = 0;
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: async data => {
      window.sharedGreetingCount++;
      window.sharedTypes = data.files?.map(file => file.type);
    } });
    window.createdBlobUrls = [];
    window.revokedBlobUrls = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = create(blob);
      window.createdBlobUrls.push({ url, type: blob.type });
      return url;
    };
    URL.revokeObjectURL = url => { window.revokedBlobUrls.push(url); revoke(url); };
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/api/santa-names?*', route => {
    const query = new URL(route.request().url()).searchParams.get('q').toLocaleLowerCase();
    return route.fulfill({ json: {
      records: records.filter(record => record.name.toLocaleLowerCase().startsWith(query)),
      hostedCount: records.length, warning: null,
    } });
  });
  await page.route('**/api/santa-message', route => {
    generations++;
    return route.fulfill({ contentType: 'audio/mpeg', body: audio });
  });
  await openMessageDesk(page, { mockNames: false });
  return () => generations;
}

async function create(page, index) {
  await page.getByLabel('First Name').fill(names[index].slice(0, 4).toLocaleLowerCase());
  await page.getByRole('option', { name: names[index], exact: true }).click();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  const result = page.getByLabel(`Santa’s greeting for ${names[index]}`, { exact: true });
  await expect(result).toBeVisible();
  return result;
}

async function downloadCertificate(page, result, file) {
  const pending = page.waitForEvent('download');
  await certificateButton(result).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('Santa-Radio-Nice-List-Certificate.pdf');
  expect(download.url()).toMatch(/^blob:/);
  if (file) {
    await mkdir('generated-artifacts/nice-list', { recursive: true });
    await download.saveAs(`generated-artifacts/nice-list/${file}.pdf`);
  }
  const bytes = await readFile(await download.path());
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(297 * 72 / 25.4, 2);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(210 * 72 / 25.4, 2);
  expect(pdf.getTitle()).toBe('Official Nice List Certificate — Santa Radio');
  return bytes;
}

for (const [index, file] of ['normal', 'long', 'unicode'].entries()) {
  test(`downloads actual ${file} PDF with canonical display spelling and no recipient requests`, async ({ page }) => {
    const generations = await setup(page);
    const result = await create(page, index);
    // A later form change must not alter the certificate.
    await page.getByLabel('First Name').fill('other selection');
    await expect(page.getByText('No matching recording yet. Try another name.', { exact: true })).toBeVisible();
    const before = await usage(page);
    const requests = [];
    page.on('request', request => { if (!request.url().startsWith('blob:')) requests.push({ url: request.url(), body: request.postData() }); });
    await downloadCertificate(page, result, file);
    expect(generations()).toBe(1);
    expect(await usage(page)).toBe(before);
    expect(requests.filter(request => request.url.includes('/api/santa-'))).toEqual([]);
    for (const request of requests) {
      expect(decodeURIComponent(request.url)).not.toContain(names[index]);
      expect(request.body || '').not.toContain(names[index]);
    }
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain(names[index]);
  });
}

for (const mobile of [false, true]) {
  test(`two identities survive SPA return and cooldown with ${mobile ? 'touch' : 'keyboard'} controls`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 },
      hasTouch: mobile, ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const generations = await setup(page);
    await create(page, 0);
    await create(page, 2);
    const before = await usage(page);
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Visit Santa’s message desk' })).toBeVisible();
    for (const [index, file] of [[0, 'two-first'], [2, 'two-second']]) {
      const result = page.getByLabel(`Santa’s greeting for ${names[index]}`, { exact: true });
      const button = certificateButton(result);
      await expect(button).toBeEnabled();
      await button.scrollIntoViewIfNeeded();
      const pending = page.waitForEvent('download');
      if (mobile) await button.tap();
      else {
        await result.getByRole('link', { name: 'Download your audio' }).focus();
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        await page.keyboard.press('Enter');
      }
      await mkdir('generated-artifacts/nice-list', { recursive: true });
      await (await pending).saveAs(`generated-artifacts/nice-list/${file}.pdf`);
      await result.getByRole('button', { name: 'Share this greeting', exact: true }).click();
      expect(await page.evaluate(() => window.sharedTypes)).toEqual(['audio/mpeg']);
    }
    expect(generations()).toBe(2);
    expect(await usage(page)).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const latest = page.locator('.message-result').last();
    await latest.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.screenshot({ path: `generated-artifacts/nice-list/controls-${mobile ? 'mobile' : 'desktop'}.png` });
    await context.close();
  });
}

test('asset failure and retry never regenerate audio or alter allowance, playback, download or sharing', async ({ page }) => {
  const generations = await setup(page);
  let failures = 0;
  await page.route('**/certificates/nice-list/CertificateSerif.ttf', route => {
    if (++failures === 1) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.continue();
  });
  const result = await create(page, 0);
  const before = await usage(page);
  await certificateButton(result).click();
  await expect(result.getByRole('alert')).toContainText('Your certificate couldn’t be prepared');
  await result.locator('audio').evaluate(element => element.play());
  await expect.poll(() => result.locator('audio').evaluate(element => element.currentTime)).toBeGreaterThan(0);
  const pending = page.waitForEvent('download');
  await result.getByRole('link', { name: 'Download your audio' }).click();
  expect(await readFile(await (await pending).path())).toEqual(audio);
  await result.getByRole('button', { name: 'Share this greeting', exact: true }).click();
  expect(await page.evaluate(() => window.sharedGreetingCount)).toBe(1);
  const retry = page.waitForEvent('download');
  await result.getByRole('button', { name: 'Retry your Nice List certificate' }).click();
  await retry;
  await expect(result.getByRole('alert')).toHaveCount(0);
  await expect(certificateButton(result)).toBeEnabled();
  expect(failures).toBe(2);
  expect(generations()).toBe(1);
  expect(await usage(page)).toBe(before);
});

test('repeated activation is single-flight; navigation discards pending completion and releases URLs', async ({ page }) => {
  const generations = await setup(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/certificates/nice-list/master.pdf', async route => {
    await gate;
    await route.continue();
  });
  const result = await create(page, 0);
  await certificateButton(result).evaluate(element => { element.click(); element.click(); element.click(); });
  await expect(result.getByRole('button', { name: 'Preparing your Nice List certificate…' })).toBeDisabled();
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Visit Santa’s message desk' })).toBeVisible();
  release();
  const returned = page.getByLabel(`Santa’s greeting for ${names[0]}`, { exact: true });
  await downloadCertificate(page, returned);
  expect(downloads).toBe(1);
  const urls = await page.evaluate(() => window.createdBlobUrls.filter(item => item.type === 'application/pdf').map(item => item.url));
  expect(urls).toHaveLength(1);
  await page.getByRole('link', { name: 'Visit Santa’s message desk' }).click();
  await expect.poll(() => page.evaluate(() => window.revokedBlobUrls)).toEqual(expect.arrayContaining(urls));
  expect(generations()).toBe(1);
});

test('corrupt successful asset response is discarded so retry can recover', async ({ page }) => {
  const generations = await setup(page);
  let requests = 0;
  await page.route('**/certificates/nice-list/master.pdf', route => {
    if (++requests === 1) return route.fulfill({ contentType: 'application/pdf', body: 'not a PDF' });
    return route.continue();
  });
  const result = await create(page, 0);
  await certificateButton(result).click();
  await expect(result.getByRole('alert')).toBeVisible();
  const pending = page.waitForEvent('download');
  await result.getByRole('button', { name: 'Retry your Nice List certificate' }).click();
  await pending;
  expect(requests).toBe(2);
  expect(generations()).toBe(1);
});

test('third greeting evicts only the oldest result and revokes its audio and certificate URLs', async ({ page }) => {
  await setup(page);
  const first = await create(page, 0);
  await downloadCertificate(page, first);
  const firstUrls = await page.evaluate(() => window.createdBlobUrls.map(item => item.url));
  await create(page, 3);
  await page.evaluate(() => { window.testNow += 11 * 60000; });
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await create(page, 2);
  await expect(first).toHaveCount(0);
  await expect(page.locator('.message-result')).toHaveCount(2);
  expect(await page.evaluate(() => window.revokedBlobUrls)).toEqual(expect.arrayContaining(firstUrls));
  await downloadCertificate(page, page.getByLabel(`Santa’s greeting for ${names[3]}`, { exact: true }));
});

test('saved-audio hit uses the same local certificate flow with zero audio generations', async ({ page }) => {
  const generations = await setup(page);
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [{ id: 'arabella', name: 'Arabella', downloadName: 'Santa-message-for-Arabella.mp3' }],
    hostedCount: 1, warning: null,
  } }));
  const hash = createHash('sha256').update(audio).digest('hex');
  const url = 'https://stagcommunications.com/santaradio/greetings-cache/certificate-test.mp3';
  await page.route('**/api/santa-greeting?*', route => route.fulfill({ json: {
    available: true, greeting: { url, sha256: hash, bytes: audio.length, recipeVersion: 'test' },
  } }));
  await page.route(`${url}?*`, route => route.fulfill({
    contentType: 'audio/mpeg', body: audio, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  await page.getByLabel('First Name').fill('Arabella');
  await page.getByRole('option', { name: 'Arabella', exact: true }).click();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  const result = page.getByLabel('Santa’s greeting for Arabella', { exact: true });
  await downloadCertificate(page, result, 'saved-audio');
  expect(generations()).toBe(0);
});
