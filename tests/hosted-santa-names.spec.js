import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openMessageDesk } from './helpers/message-access.js';
import { filenameId } from '../server/santa-name-library.js';

const recording = (id, name) => ({ id, name, downloadName: `Santa-message-for-${name}.mp3` });
const demrie = recording('demrie', 'Demrie');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const method of ['mouse', 'keyboard']) {
  test(`name suggestion still selects with ${method} on desktop`, async ({ page }) => {
    let selected;
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      hostedCount: 3, warning: null,
      records: ['Dennie', 'Dennin', 'Dennis'].map(name => recording(name.toLowerCase(), name)),
    } }));
    await page.route('**/api/santa-message', async route => {
      selected = route.request().postDataJSON();
      await route.fulfill({ status: 503, json: { error: 'Test render is intentionally unavailable.' } });
    });
    await openMessageDesk(page, { mockNames: false });
    const input = page.getByRole('combobox', { name: 'First Name', exact: true });
    await input.fill('Denni');
    await expect(page.getByRole('option', { name: 'Dennis', exact: true })).toBeVisible();
    if (method === 'mouse') await page.getByRole('option', { name: 'Dennis', exact: true }).click();
    else {
      await input.press('ArrowDown');
      await input.press('Enter');
    }
    const expectedName = method === 'mouse' ? 'Dennis' : 'Dennie';
    await expect(input).toHaveValue(expectedName);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect.poll(() => selected?.name).toBe(expectedName.toLowerCase());
  });
}

test.describe('mobile name suggestion taps', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      hostedCount: 3, warning: null,
      records: ['Dennie', 'Dennin', 'Dennis'].map(name => recording(name.toLowerCase(), name)),
    } }));
    await openMessageDesk(page, { mockNames: false });
  });

  test('a touch tap fills the input and submits the selected recording', async ({ page }) => {
    let selected;
    await page.route('**/api/santa-message', async route => {
      selected = route.request().postDataJSON();
      await route.fulfill({ status: 503, json: { error: 'Test render is intentionally unavailable.' } });
    });
    const input = page.getByRole('combobox', { name: 'First Name', exact: true });
    await input.fill('Denni');
    await page.getByRole('option', { name: 'Dennis', exact: true }).tap();
    await expect(input).toHaveValue('Dennis');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect.poll(() => selected?.name).toBe('dennis');
  });

  test('touch release selects without a compatibility click, even after input blur', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'First Name', exact: true });
    await input.fill('Denni');
    const option = page.getByRole('option', { name: 'Dennin', exact: true });
    const touch = { pointerType: 'touch', pointerId: 7, clientX: 100, clientY: 250 };
    await option.dispatchEvent('pointerdown', touch);
    await input.evaluate(node => node.blur());
    await expect(option).toBeVisible();
    await option.dispatchEvent('pointerup', touch);
    await expect(input).toHaveValue('Dennin');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  test('scrolling or cancelling a touch does not select a suggestion', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'First Name', exact: true });
    await input.fill('Denni');
    const option = page.getByRole('option', { name: 'Dennis', exact: true });
    const touch = { pointerType: 'touch', pointerId: 8, clientX: 100, clientY: 250 };
    await option.dispatchEvent('pointerdown', touch);
    await option.dispatchEvent('pointermove', { ...touch, clientY: 290 });
    await option.dispatchEvent('pointerup', { ...touch, clientY: 290 });
    await option.dispatchEvent('click', { detail: 1 });
    await expect(input).toHaveValue('Denni');
    await option.dispatchEvent('pointerdown', touch);
    await option.dispatchEvent('pointercancel', touch);
    await option.dispatchEvent('pointerup', touch);
    await expect(input).toHaveValue('Denni');
  });
});

test('Unicode and apostrophe equivalents require a distinct selection when ambiguous', async ({ page }) => {
  const files = ['Seán.mp3', 'Sea\u0301n.mp3', "O'Conner.mp3", 'O’Conner.mp3', 'Mary Jane.MP3', 'ana_kayla.mp3', 'ana-kayla.mp3', 'Dixie3.mp3'];
  let selected;
  await page.route('**/api/santa-names?*', route => {
    const key = text => text.normalize('NFC').toLowerCase().replace(/’/g, "'");
    const query = key(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({ json: { hostedCount: files.length, warning: null,
      records: files.filter(file => key(file).startsWith(query)).map(file => ({
        ...recording(filenameId(file), file.slice(0, -4)), variant: file,
      })) } });
  });
  await page.route('**/api/santa-message', route => {
    selected = route.request().postDataJSON().name;
    return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3') });
  });
  await prepare(page);
  const input = page.getByLabel('First Name');
  await input.fill('SEÁN');
  await expect(page.getByRole('option')).toHaveCount(2);
  await input.press('Escape');
  await page.getByRole('button', { name: 'Create message' }).evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.getByRole('button', { name: 'Create message' }).click();
  expect(selected).toBeUndefined();
  await input.focus();
  await page.getByRole('option').nth(1).click();
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.locator('.message-result')).toHaveCount(1);
  expect(selected).toBe(filenameId(files[1]));
  await input.fill("o'conner");
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('option').nth(1).click();
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.locator('.message-result')).toHaveCount(2);
  expect(selected).toBe(filenameId(files[3]));
});

async function prepare(page) {
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await openMessageDesk(page, { mockNames: false });
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
}

test('hosted selection uses its identifier, retains downloads and does not render during search', async ({ page }) => {
  const posts = [];
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: { records: [demrie], warning: null } }));
  await page.route('**/api/santa-message', route => {
    posts.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/names/erin.wav') });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  const input = page.getByLabel('First Name');
  await input.fill('dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  expect(posts).toHaveLength(0);
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('Demrie');
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.getByRole('link', { name: 'Download your audio' })).toHaveAttribute('download', 'Santa-message-for-Demrie.mp3');
  expect(posts).toEqual([{ name: 'demrie' }]);
  await input.fill('Other');
  await expect(page.locator('.message-result')).toHaveCount(1);
  await expect(page.locator('.message-result audio')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('rapid input ignores old results and exact typed names work without choosing a suggestion', async ({ page }) => {
  await page.route('**/api/santa-names?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('q').toLowerCase();
    if (q === 'de') await delay(500);
    await route.fulfill({ json: { records: [q.startsWith('fl') ? recording('flora', 'Flora') : demrie], warning: null } }).catch(() => {});
  });
  let chosen;
  await page.route('**/api/santa-message', route => {
    chosen = route.request().postDataJSON();
    return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/names/erin.wav') });
  });
  await prepare(page);
  const input = page.getByLabel('First Name');
  await input.fill('de');
  await expect(page.getByText('Checking Santa’s hosted name list…')).toBeVisible();
  await delay(240);
  await input.fill('flora');
  await expect(page.getByRole('option', { name: 'Flora', exact: true })).toBeVisible();
  await delay(600);
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.getByRole('link', { name: 'Download your audio' })).toBeVisible();
  expect(chosen).toEqual({ name: 'flora' });
});

test('inventory failures are explicit and retry can recover a previously missing hosted name', async ({ page }) => {
  let failed = true;
  await page.route('**/api/santa-names?*', route => failed
    ? route.fulfill({ json: { records: [], warning: 'The hosted name list is unavailable. Only existing recordings are shown.' } })
    : route.fulfill({ json: { records: [demrie], warning: null } }));
  await prepare(page);
  await page.getByLabel('First Name').fill('Demrie');
  await expect(page.getByText('The hosted name list is unavailable. Only existing recordings are shown.', { exact: true })).toBeVisible();
  await expect(page.getByText('No matching recording yet. Try another name.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No matching hosted recording was found.', { exact: true })).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: 'Refresh name list' }).click();
  await page.getByLabel('First Name').focus();
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
});

test('endpoint errors and missing audio show a useful error, do not consume allowance and can retry', async ({ page }) => {
  let searchFailed = true, audioFailed = true;
  await page.route('**/api/santa-names?*', route => searchFailed
    ? route.fulfill({ status: 503, json: { error: 'The name list could not be loaded. Please try again.' } })
    : route.fulfill({ json: { records: [demrie], warning: null } }));
  await page.route('**/api/santa-message', route => audioFailed
    ? route.fulfill({ status: 503, json: { error: 'The recording could not be loaded or mixed. Please try again.' } })
    : route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/names/erin.wav') }));
  await prepare(page);
  const input = page.getByLabel('First Name');
  await input.fill('Demrie');
  await expect(page.getByRole('button', { name: 'Retry name search' })).toBeVisible();
  searchFailed = false;
  await page.getByRole('button', { name: 'Retry name search' }).click();
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.getByRole('alert')).toContainText('recording could not be loaded');
  await expect(page.locator('.message-result')).toHaveCount(0);
  audioFailed = false;
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.getByRole('link', { name: 'Download your audio' })).toBeVisible();
  await expect(page.getByText('You’ve created your two free Santa messages for now.', { exact: false })).toHaveCount(0);
});

test('homepage message form uses the same hosted search after session access is opened', async ({ page }) => {
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: { records: [demrie], warning: null } }));
  await prepare(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const input = page.getByLabel('First Name');
  await input.fill('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
});
