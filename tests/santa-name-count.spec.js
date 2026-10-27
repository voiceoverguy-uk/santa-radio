import { test, expect } from '@playwright/test';
import { openMessageDesk } from './helpers/message-access.js';
import { popularSantaExamples } from '../src/data/santaPlaceholderNames.js';

const demrie = { id: 'demrie', name: 'Demrie', downloadName: 'Santa-message-for-Demrie.mp3' };

for (const path of ['/', '/free-santa-message']) {
  test(`public counter starts 50 low, adds one every five seconds and stops at the real total on ${path}`, async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      records: [], hostedCount: 9775, warning: null,
    } }));
    await page.goto(path);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const counter = page.locator('.message-name-count');
    await expect(counter).toHaveText('9,725 names available');
    await expect(counter).toHaveAttribute('aria-live', 'off');
    const indicator = page.locator('.message-recording-indicator');
    await expect(indicator).toHaveText('Recording');
    await expect(indicator).toBeVisible();
    const dot = indicator.locator('.message-recording-dot');
    await expect(dot).toHaveAttribute('aria-hidden', 'true');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(dot).toHaveCSS('animation-name', 'message-recording-pulse');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dot).toHaveCSS('animation-name', 'none');
    await page.clock.runFor(5000);
    await expect(counter).toHaveText('9,726 names available');
    await page.clock.runFor(245_000);
    await expect(counter).toHaveText('9,775 names available');
    await page.clock.runFor(15_000);
    await expect(counter).toHaveText('9,775 names available');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await page.locator('.message-name-status').screenshot({
      path: `generated-artifacts/workshop/recording-indicator-${path === '/' ? 'home' : 'maker'}.png`,
      animations: 'disabled',
    });
  });
}

test('small totals never start negative and stop with correct singular wording', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: 1, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.locator('.message-name-count')).toHaveText('0 names available');
  await page.clock.runFor(5000);
  await expect(page.locator('.message-name-count')).toHaveText('1 name available');
  await page.clock.runFor(10_000);
  await expect(page.locator('.message-name-count')).toHaveText('1 name available');
});

test('hosted total appears before typing, stays independent of matches and refreshes new uploads', async ({ page }) => {
  await page.clock.install();
  let total = 274, renders = 0;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  await page.route('**/api/santa-names?*', route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    return route.fulfill({ json: { records: q ? [demrie] : [], hostedCount: total, warning: null } });
  });
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('224 names available', { exact: true })).toBeVisible();
  await expect(page.getByLabel('First Name')).toHaveValue('');
  const input = page.getByLabel('First Name');
  await expect(input).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  const example = (await input.getAttribute('placeholder')).match(/eg\. ([^,]+)/)[1];
  expect(popularSantaExamples).toContain(example);
  total = 275;
  await page.clock.runFor(75_000);
  await expect(page.getByText('239 names available', { exact: true })).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', `Start typing, eg. ${example}`);
  await page.getByLabel('First Name').fill('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  await expect(page.getByText('239 names available', { exact: true })).toBeVisible();
  expect(renders).toBe(0);
  await expect(input).toHaveAttribute('placeholder', `Start typing, eg. ${example}`);
});

test('unavailable inventory does not invent a zero total and a retry restores the count', async ({ page }) => {
  let failed = true;
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: failed ? null : 1,
    warning: failed ? 'The hosted name list is unavailable. Only existing recordings are shown.' : null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('Name total temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.locator('.message-recording-indicator')).toHaveCount(0);
  await expect(page.getByText('0 names available', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('First Name')).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  failed = false;
  await page.getByRole('button', { name: 'Refresh name list' }).click();
  await expect(page.getByText('0 names available', { exact: true })).toBeVisible();
});

test('large totals fit on mobile and genuine empty inventory displays zero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let total = 12_345;
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: total, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('12,295 names available', { exact: true })).toBeVisible();
  await expect(page.locator('.message-recording-indicator')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.locator('.message-name-status').evaluate(element =>
    element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  await expect(page.getByLabel('First Name')).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  const placeholderFits = await page.getByLabel('First Name').evaluate((input, names) => {
    const style = getComputedStyle(input), placeholder = getComputedStyle(input, '::placeholder');
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    context.font = `${placeholder.fontWeight} ${placeholder.fontSize} ${placeholder.fontFamily}`;
    const width = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return parseFloat(placeholder.fontSize) >= 14 && names.every(name =>
      context.measureText(`Start typing, eg. ${name}`).width <= width + 0.5);
  }, popularSantaExamples);
  expect(placeholderFits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  total = 0;
  await page.getByLabel('First Name').fill('Unknown');
  await expect(page.getByText('0 names available', { exact: true })).toBeVisible();
  await expect(page.locator('.message-recording-indicator')).toHaveCount(0);
});

test('the random example is chosen on page load, not when searching or refreshing', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.999999; });
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: 826, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  const input = page.getByLabel('First Name');
  await expect(input).toHaveAttribute('placeholder', 'Start typing, eg. Sadie');
  await input.fill('Sad');
  await expect(input).toHaveAttribute('placeholder', 'Start typing, eg. Sadie');
});
