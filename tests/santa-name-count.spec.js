import { test, expect } from '@playwright/test';
import { openMessageDesk } from './helpers/message-access.js';
import { popularSantaExamples } from '../src/data/santaPlaceholderNames.js';

const demrie = { id: 'demrie', name: 'Demrie', downloadName: 'Santa-message-for-Demrie.mp3' };

test('hosted total appears before typing, stays independent of matches and refreshes new uploads', async ({ page }) => {
  await page.clock.install();
  let total = 274, renders = 0;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  await page.route('**/api/santa-names?*', route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    return route.fulfill({ json: { records: q ? [demrie] : [], hostedCount: total, warning: null } });
  });
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('274 names available to download', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Child’s first name')).toHaveValue('');
  const input = page.getByLabel('Child’s first name');
  await expect(input).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  const example = (await input.getAttribute('placeholder')).match(/eg\. ([^,]+)/)[1];
  expect(popularSantaExamples).toContain(example);
  total = 275;
  await page.clock.fastForward(75_000);
  await expect(page.getByText('275 names available to download', { exact: true })).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', `Start typing, eg. ${example}`);
  await page.getByLabel('Child’s first name').fill('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  await expect(page.getByText('275 names available to download', { exact: true })).toBeVisible();
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
  await expect(page.getByText('0 names available to download', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Child’s first name')).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  failed = false;
  await page.getByRole('button', { name: 'Refresh name list' }).click();
  await expect(page.getByText('1 name available to download', { exact: true })).toBeVisible();
});

test('large totals fit on mobile and genuine empty inventory displays zero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let total = 12_345;
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: total, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.getByText('12,345 names available to download', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Child’s first name')).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  const placeholderFits = await page.getByLabel('Child’s first name').evaluate((input, names) => {
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
  await page.getByLabel('Child’s first name').fill('Unknown');
  await expect(page.getByText('0 names available to download', { exact: true })).toBeVisible();
});

test('the random example is chosen on page load, not when searching or refreshing', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.999999; });
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: 826, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  const input = page.getByLabel('Child’s first name');
  await expect(input).toHaveAttribute('placeholder', 'Start typing, eg. Sadie');
  await input.fill('Sad');
  await expect(input).toHaveAttribute('placeholder', 'Start typing, eg. Sadie');
});
