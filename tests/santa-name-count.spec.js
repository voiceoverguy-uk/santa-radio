import { test, expect } from '@playwright/test';
import { fillAccessForm, mockBrevo, openMessageDesk } from './helpers/message-access.js';
import { popularSantaExamples } from '../src/data/santaPlaceholderNames.js';

const demrie = { id: 'demrie', name: 'Demrie', downloadName: 'Santa-message-for-Demrie.mp3' };

async function expectGroupedStatus(page) {
  await expect(page.locator('.message-name-status')).toBeVisible();
  const geometry = await page.locator('.message-name-status').evaluate(row => {
    const counter = row.querySelector('.message-name-count');
    const indicator = row.querySelector('.message-recording-indicator');
    const label = [...indicator.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const range = document.createRange();
    range.selectNodeContents(label);
    return {
      row: row.getBoundingClientRect().toJSON(),
      counter: counter.getBoundingClientRect().toJSON(),
      indicator: indicator.getBoundingClientRect().toJSON(),
      dot: indicator.querySelector('.message-recording-dot').getBoundingClientRect().toJSON(),
      label: range.getBoundingClientRect().toJSON(),
      overflow: row.scrollWidth - row.clientWidth,
      postmark: row.parentElement.querySelector('.message-postmark').getBoundingClientRect().toJSON(),
      counterFontSize: parseFloat(getComputedStyle(counter).fontSize),
      indicatorFontSize: parseFloat(getComputedStyle(indicator).fontSize),
      subtitleFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize) * .75,
    };
  });
  const { row, counter, indicator, dot, label } = geometry;
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(row.left).toBeCloseTo(geometry.postmark.left, 0);
  expect(row.top - geometry.postmark.bottom).toBeCloseTo(5, 0);
  expect(geometry.counterFontSize).toBeCloseTo(geometry.subtitleFontSize, 1);
  expect(geometry.indicatorFontSize).toBeCloseTo(geometry.subtitleFontSize, 1);
  expect(counter.left).toBeCloseTo(row.left, 0);
  for (const item of [counter, indicator]) {
    expect(item.left).toBeGreaterThanOrEqual(row.left - 1);
    expect(item.right).toBeLessThanOrEqual(row.right + 1);
  }
  if (counter.width + indicator.width + 12 <= row.width + .5) {
    expect(indicator.left - counter.right).toBeCloseTo(12, 0);
    expect(indicator.top + indicator.height / 2).toBeCloseTo(counter.top + counter.height / 2, 0);
  } else {
    expect(indicator.left).toBeCloseTo(row.left, 0);
    expect(indicator.top - counter.bottom).toBeCloseTo(8, 0);
  }
  expect(dot.right).toBeLessThan(label.left);
  expect(dot.top).toBeLessThan(label.bottom);
  expect(dot.bottom).toBeGreaterThan(label.top);
}

for (const path of ['/', '/free-santa-message']) {
  for (const width of [320, 390, 1280]) {
    test(`recording stays beside the counter or wraps left at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
      await mockBrevo(page);
      await page.route('**/api/santa-names?*', route => route.fulfill({
        json: { records: [], hostedCount: 9780, warning: null },
      }));
      await page.goto(path);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await expect(page.locator('.message-name-count')).toHaveText('9,730 names available');
      await expect(page.getByText('A recorded hello, ready to keep', { exact: true })).toHaveCount(0);
      await expect(page.locator('.message-card-heading .message-name-status')).toHaveCount(1);
      for (const unlocked of [false, true]) {
        if (unlocked) {
          await fillAccessForm(page);
          await page.getByRole('button', { name: 'Get my free Santa message' }).click();
          await expect(page).toHaveURL(/\/free-santa-message(?:[?#]|$)/);
          // Homepage signup opens the dedicated desk; return to verify the
          // shared homepage maker with the same remembered access.
          if (path === '/') await page.goto(path);
          await expect(page.getByLabel('First Name')).toBeVisible();
          await expect(page.locator('.message-name-count')).toHaveText('9,730 names available');
        }
        for (const enlarged of [false, true]) {
          await page.addStyleTag({ content: `html { font-size: ${enlarged ? 200 : 100}%; }` });
          await expectGroupedStatus(page);
          const dot = page.locator('.message-recording-dot');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await expect(dot).toHaveCSS('animation-name', 'message-recording-pulse');
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await expect(dot).toHaveCSS('animation-name', 'none');
          await expectGroupedStatus(page);
          await page.locator('.message-name-status').evaluate(row =>
            row.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.locator('.message-card-top').screenshot({
            path: `generated-artifacts/recording-alignment/${path === '/' ? 'home' : 'maker'}-${width}-${unlocked ? 'unlocked' : 'public'}-${enlarged ? '200' : '100'}.png`,
            animations: 'disabled',
          });
        }
        await page.addStyleTag({ content: 'html { font-size: 100%; }' });
      }
    });
  }
}

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
  await expect(page.locator('.message-name-count')).toHaveText('224 names available');
  await expect(page.getByLabel('First Name')).toHaveValue('');
  const input = page.getByLabel('First Name');
  await expect(input).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  const example = (await input.getAttribute('placeholder')).match(/eg\. ([^,]+)/)[1];
  expect(popularSantaExamples).toContain(example);
  total = 275;
  await page.clock.runFor(75_000);
  await expect(page.locator('.message-name-count')).toHaveText('239 names available');
  await expect(input).toHaveAttribute('placeholder', `Start typing, eg. ${example}`);
  await page.getByLabel('First Name').fill('Dem');
  await expect(page.getByRole('option', { name: 'Demrie', exact: true })).toBeVisible();
  await expect(page.locator('.message-name-count')).toHaveText('239 names available');
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
  await expect(page.locator('.message-name-count')).toHaveText('Name total temporarily unavailable.');
  await expect(page.locator('.message-recording-indicator')).toHaveCount(0);
  await expect(page.getByText('0 names available', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('First Name')).toHaveAttribute('placeholder', /^Start typing, eg\. [A-Za-z]+$/);
  failed = false;
  await page.getByRole('button', { name: 'Refresh name list' }).click();
  await expect(page.locator('.message-name-count')).toHaveText('0 names available');
});

test('large totals fit on mobile and genuine empty inventory displays zero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let total = 12_345;
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [], hostedCount: total, warning: null,
  } }));
  await openMessageDesk(page, { mockNames: false });
  await expect(page.locator('.message-name-count')).toHaveText('12,295 names available');
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
  await expect(page.locator('.message-name-count')).toHaveText('0 names available');
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
