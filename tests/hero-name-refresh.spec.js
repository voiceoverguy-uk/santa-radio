import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';

const checker = page => page.locator('.hero-name-checker');
const input = page => checker(page).getByRole('combobox');
const cta = page => checker(page).getByRole('button', { name: 'Create my free Santa message →' });
const inventory = { hostedCount: 3, warning: null, records: ['Wendy', 'Erin', 'Erica'].map(name => ({
  id: name.toLowerCase(), name, downloadName: `Santa-recorded-message-for-${name}.mp3`,
  selectionToken: 'controlled-fixture-token', previewUrl: '/api/santa-name-preview?token=controlled-fixture-token',
})) };

async function setup(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/names-data/*.json', route => route.fulfill({ json: inventory.records.map(record => record.name) }));
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/api/santa-names', route => route.fulfill({ json: {
    ...inventory, records: inventory.records.filter(record =>
      record.name.toLowerCase().startsWith(route.request().postDataJSON().query.toLowerCase())),
  } }));
  await mockBrevo(page);
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(checker(page).getByRole('status')).toHaveText('Check the name - let Santa create magic.');
}

async function choose(page, name) {
  await input(page).fill(name);
  await checker(page).getByRole('option', { name, exact: true }).click();
  await expect(checker(page).getByRole('status')).toHaveText(`Yes! Santa can record for ${name}.`);
}

async function empty(page) {
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toHaveAttribute('placeholder', 'Start typing a name…');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'false');
  await expect(input(page)).not.toHaveAttribute('aria-activedescendant');
  await expect(checker(page).getByRole('listbox')).toHaveCount(0);
  await expect(checker(page).getByRole('status')).toHaveText('Check the name - let Santa create magic.');
}

for (const width of [390, 1440]) {
  test(`typed, active, invalid and confirmed names reset on real reload at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    const urls = [];
    page.on('request', request => urls.push(request.url()));
    await input(page).fill('Er');
    await expect(checker(page).getByRole('option')).toHaveCount(2);
    await input(page).press('ArrowDown');
    await expect(input(page)).toHaveAttribute('aria-activedescendant', /option-0$/);
    await page.reload();
    await empty(page);
    await input(page).fill('Wendy');
    await input(page).press('Enter');
    await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
    await page.reload();
    await empty(page);
    await choose(page, 'Wendy');
    await cta(page).click();
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    const maker = page.locator('.santa-message-box').getByRole('combobox');
    await expect(maker).toHaveValue('Wendy');
    const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    // Chromium's reload with the cache disabled exercises a hard refresh.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.reload();
    await empty(page);
    await expect(maker).toHaveValue('');
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage);
    await input(page).fill('Er');
    await expect(checker(page).getByRole('option')).toHaveCount(2);
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await cta(page).click();
    await expect(maker).toHaveValue('Erica');
    expect(urls.filter(url => /Wendy|Erin|Erica/i.test(decodeURIComponent(url)))).toEqual([]);
    expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage, ...sessionStorage })))).not.toMatch(/Wendy|Erin|Erica/);
  });

  test(`simulated browser form restoration clears only the initial hero field at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    // Simulate an engine restoring the DOM without a React input event.
    // This is not physical iPhone/Safari verification.
    await input(page).evaluate(node => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, 'Wendy');
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });
    await empty(page);
    await choose(page, 'Wendy');
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      window.dispatchEvent(new Event('visibilitychange'));
      window.scrollTo(0, 200);
    });
    await expect(input(page)).toHaveValue('Wendy');
    await expect(checker(page).getByRole('status')).toHaveText('Yes! Santa can record for Wendy.');
    await cta(page).click();
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    await page.route('**/api/santa-message', route => route.fulfill({
      contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
    }));
    await page.locator('.santa-message-box').getByRole('button', { name: 'Create message', exact: true }).click();
    const download = page.getByRole('link', { name: 'Download your audio' });
    await expect(download).toHaveAttribute('href', /^blob:/);
    const href = await download.getAttribute('href');
    const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    await page.evaluate(() => {
      // A late load event must never wipe a deliberate selection or its handoff.
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });
    await expect(input(page)).toHaveValue('Wendy');
    await expect(download).toHaveAttribute('href', href);
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage);
    await page.reload();
    await empty(page);
    await expect(page.locator('.santa-message-access')).toHaveCount(0);
    await expect(page.locator('.santa-message-box').getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('santa-message-allowance')).used)).toBe(1);
    // Existing history is deliberately tab-memory only; actual reload already
    // discards it. The reset must not introduce persistence or clear that store.
  });
}
