import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';
import { expectStudioLaunchCopy } from './helpers/studio-promotion.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const longName = 'Alexandriarosethegreatwithaverylongunbrokenname';
const names = ['Arabella', 'Erica', 'Erin', longName];
const promotion = page => page.locator('#santa-studio-promotion');
const gifts = page => promotion(page).locator('.studio-gifts');
const checker = page => page.locator('.hero-name-checker');
const mp3 = readFileSync('server/santa-audio/sleighbells.mp3');

async function enterWorkshop(page) {
  await page.route('**/api/santa-workshop-access', route => route.fulfill({
    json: { authorized: true, expiresAt: Date.now() + 3600000 },
  }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({
    json: workshopCatalogueFixture,
  }));
  await promotion(page).getByLabel('Voucher code', { exact: true }).fill('controlled-test-only');
  const lookup = page.waitForResponse(response => response.url().endsWith('/api/santa-names')
    && response.request().method() === 'POST');
  await promotion(page).getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  await expect(page).toHaveURL(/\/santa-message-workshop$/);
  await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toBeVisible();
  await lookup;
}

for (const width of [390, 1440]) {
  for (const source of ['checked', 'free']) {
    test(`Workshop prefills ${source} recipient and allows changing it at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page);
      await chooseHero(page, 'Arabella');
      if (source === 'free') {
        await checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();
        await signup(page);
        await page.getByRole('button', { name: 'Create message', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
      }
      await enterWorkshop(page);
      const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
      await expect(input).toHaveValue('Arabella');
      await expect(input).toHaveAttribute('aria-expanded', 'false');
      await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-step-count')).toHaveText('Step 2 of 6');
      await page.locator('.smw-button-back').click();
      await input.fill('Er');
      await page.locator('.smw-button-next').click();
      await expect(page.locator('#smw-validation')).toHaveText('Please choose their name before continuing.');
      await input.focus();
      await page.getByRole('option', { name: 'Erin', exact: true }).click();
      await expect(input).toHaveValue('Erin');
      await expect(page.locator('.smw-button-next')).toBeEnabled();
      await page.locator('.smw-button-next').click();
      await page.locator('.smw-button-back').click();
      await expect(input).toHaveValue('Erin');
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Arabella|Erin/);
      await page.reload();
      await expect(input).toHaveValue('');
      await page.locator('.smw-button-next').click();
      await expect(page.locator('#smw-validation')).toHaveText('Please choose their name before continuing.');
    });
  }
}

test('Workshop prefill requires a choice for ambiguous recordings and never overwrites an edit', async ({ page }) => {
  await setup(page);
  await chooseHero(page, 'Arabella');
  await page.route('**/api/santa-names', route => {
    const query = route.request().postDataJSON().query;
    const records = query === 'Arabella'
      ? ['1', '2'].map(id => ({
        id, name: 'Arabella', variant: `Recording ${id}`, selectionToken: `fixture-${id}`,
        previewUrl: `/api/santa-name-preview?token=fixture-${id}`,
      }))
      : [{ id: 'erin', name: 'Erin', selectionToken: 'fixture-erin', previewUrl: '/api/santa-name-preview?token=fixture-erin' }];
    return route.fulfill({ json: { records } });
  });
  await enterWorkshop(page);
  const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await expect(input).toHaveValue('Arabella');
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.locator('.smw-button-next').click();
  await expect(page.locator('#smw-validation')).toHaveText('Please choose their name before continuing.');
  await input.focus();
  await page.getByRole('option', { name: 'Arabella Recording 2', exact: true }).click();
  await expect(page.locator('.smw-button-next')).toBeEnabled();
  await input.fill('Erin');
  await page.getByRole('option', { name: 'Erin', exact: true }).click();
  await expect(input).toHaveValue('Erin');
  await expect(page.locator('.smw-button-next')).toBeEnabled();
});

async function setup(page, { path = '/', cooldown = false } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ cooldown }) => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    sessionStorage.setItem('santa-radio-example-last', 'charlotte');
    if (cooldown) localStorage.setItem('santa-message-allowance', JSON.stringify({
      used: 1, availableAt: Date.now() + 2 * 3600000, cooldownMs: 2 * 3600000,
    }));
    window.__examplePauses = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {
      if (this.classList.contains('santa-message-example__audio')) window.__examplePauses++;
    };
    HTMLMediaElement.prototype.play = function () {
      if (this.classList.contains('santa-message-example__audio') && window.__holdExamplePlay) {
        return new Promise(resolve => { window.__resolveExamplePlay = resolve; });
      }
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
  }, { cooldown });
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 9774 } }));
  await page.route('**/api/santa-names', route => {
    expect(route.request().method()).toBe('POST');
    const query = route.request().postDataJSON().query.toLowerCase();
    return route.fulfill({ json: { warning: null, records: names.filter(name =>
      name.toLowerCase().startsWith(query)).map(name => ({
      id: name.toLowerCase(), name, selectionToken: 'controlled-fixture-token',
      previewUrl: '/api/santa-name-preview?token=controlled-fixture-token',
    })) } });
  });
  await mockBrevo(page);
  await page.route('**/api/santa-message', route => route.fulfill({ contentType: 'audio/mpeg', body: mp3 }));
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

async function chooseHero(page, name) {
  const input = checker(page).getByRole('combobox');
  await input.fill(name);
  // A closing native dialog can restore focus after fill(), hiding the list.
  // Refocus with real keyboard input after the bounded lookup has completed.
  await expect(checker(page).getByRole('status')).toContainText('1 matching name.');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(checker(page).getByRole('status')).toHaveText(`Yes! Santa can record for ${name}.`);
}
async function matches(page, name) {
  await expect(gifts(page)).toHaveAttribute('data-demo-name', name);
  await expect(gifts(page).getByRole('heading')).toHaveText(`All 3 gifts included for ${name} with the paid version`);
  await expect(gifts(page).locator('.studio-certificate__name')).toHaveText(name);
  await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText(name);
  await expect(gifts(page).locator('.studio-gifts__gallery .studio-gifts__sr')).toContainText(`Dear ${name},`);
  await expect(promotion(page).locator('.santa-studio-promotion__copy')).toContainText(
    `Create a personalised message from Santa, with ${name}’s age, achievements and the things that make them special for an extra personal touch.`);
  await expect(promotion(page).locator('.santa-studio-promotion__subheading')).toHaveText(`A little more Christmas magic for ${name}`);
  await expect(promotion(page).locator('.santa-studio-promotion__benefit-list li')).toHaveText([
    'An official Nice List certificate', 'A short personal letter from Santa',
    `A picture of Santa celebrating ${name}’s place on the Nice List*`,
  ]);
  await expect(page.locator('.santa-message-example')).toHaveCount(0);
}
async function signup(page) {
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toBeVisible();
}

for (const width of [390, 1440]) {
  test(`confirmed hero child stops pending random audio and updates every gift before Continue at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1100 });
    await setup(page);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
    await expectStudioLaunchCopy(promotion(page));
    await page.evaluate(() => { window.__holdExamplePlay = true; });
    await page.getByRole('button', { name: 'Hear an example audio message' }).click();
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Harry');
    await chooseHero(page, 'Erica');
    await matches(page, 'Erica');
    expect(await page.evaluate(() => window.__examplePauses)).toBeGreaterThan(0);
    await page.evaluate(() => window.__resolveExamplePlay?.());
    await checker(page).getByRole('combobox').fill('Unknown');
    await matches(page, 'Erica');
    await chooseHero(page, 'Arabella');
    await matches(page, 'Arabella');
    for (const label of ['Enlarge certificate', 'Enlarge letter to read', 'Enlarge Santa’s Nice List picture']) {
      await gifts(page).getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', /Arabella/);
      await page.keyboard.press('Escape');
    }
    await chooseHero(page, longName);
    await matches(page, longName);
    await expectStudioLaunchCopy(promotion(page));
    await page.setViewportSize({ width: 320, height: 1100 });
    await expectStudioLaunchCopy(promotion(page));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await chooseHero(page, 'Erin');
    await page.setViewportSize({ width, height: 1100 });
    mkdirSync('generated-artifacts', { recursive: true });
    await promotion(page).screenshot({ path: `generated-artifacts/studio-chosen-recipient-${width}.jpg`, animations: 'disabled' });
    await checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();
    await mockBrevo(page, { message: 'Controlled refusal' }, 503);
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    await expect(page.locator('.santa-message-access__error')).toBeVisible();
    await matches(page, 'Erin');
    await mockBrevo(page);
    await signup(page);
    await matches(page, 'Erin');
    await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Erin');
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Erica|Arabella|Erin|Alexandria/);
    await page.reload();
    await expect(checker(page).getByRole('combobox')).toHaveValue('');
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  });
}

test('free-maker selection and generation retain recipient across navigation and cooldown reload', async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, { path: '/free-santa-message' });
  await signup(page);
  await page.getByLabel('First Name', { exact: true }).fill('Arabella');
  await page.getByRole('option', { name: 'Arabella', exact: true }).click();
  await matches(page, 'Arabella');
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
  await matches(page, 'Arabella');
  await page.locator('.message-result audio').evaluate(audio => audio.dispatchEvent(new Event('ended')));
  await matches(page, 'Arabella');
  await page.getByRole('link', { name: 'Apps', exact: true }).first().click();
  await page.goBack();
  await matches(page, 'Arabella');
  await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Arabella');
  await page.reload();
  await expect(page.locator('.studio-gifts [data-demo-name]')).toHaveCount(0);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expect(gifts(page).getByRole('button', { name: /Enlarge/ })).toHaveCount(3);
  await expect(gifts(page).getByRole('heading')).toHaveText('All 3 gifts included for Edward with the paid version');
  await expect(page.locator('.santa-message-example')).toHaveCount(0);
  await expectStudioLaunchCopy(promotion(page));
});

test('late generation cannot replace a newer confirmed hero child', async ({ page }) => {
  await setup(page);
  await chooseHero(page, 'Arabella');
  await checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();
  await signup(page);
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Arabella');
  await expect(page.locator('.message-name-hint').filter({ hasText: 'Santa is ready to record for Arabella.' })).toBeVisible();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/santa-message', async route => {
    await pending;
    await route.fulfill({ contentType: 'audio/mpeg', body: mp3 });
  });
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByText('Santa is recording a personal message for you. Do hold on one moment...')).toBeVisible();
  await chooseHero(page, 'Erin');
  await matches(page, 'Erin');
  release();
  await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
  await matches(page, 'Erin');
});

for (const width of [390, 1440]) {
test(`unknown-recipient cooldown keeps all three original example gifts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await setup(page, { cooldown: true });
  await expect(gifts(page).getByRole('heading')).toHaveText('All 3 gifts included for Edward with the paid version');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expect(gifts(page).locator('.studio-certificate__name')).toHaveText('Edward');
  await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText('Edward');
  await expect(gifts(page).locator('.studio-gifts__gallery .studio-gifts__sr')).toContainText('Dear Edward,');
  for (const label of ['Enlarge certificate', 'Enlarge letter to read', 'Enlarge Santa’s Nice List picture']) {
    const button = gifts(page).getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('.santa-message-example')).toHaveCount(0);
  await expectStudioLaunchCopy(promotion(page));
  await promotion(page).screenshot({ path: `generated-artifacts/studio-cooldown-gifts-${width}.jpg`, animations: 'disabled' });
  await chooseHero(page, 'Erin');
  await matches(page, 'Erin');
});
}

for (const cooldown of [false, true]) {
test(`anonymous copy follows rotating examples${cooldown ? ' during cooldown' : ''} but a chosen child stays fixed through later cycles`, async ({ page }) => {
  await page.clock.install();
  await setup(page, { cooldown });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gifts(page).scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(10500);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expectStudioLaunchCopy(promotion(page));
  for (const exampleName of ['Erin', 'Charlotte', 'Freya', 'Harry', 'Arabella']) {
    await page.clock.runFor(10500);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', exampleName);
    await expectStudioLaunchCopy(promotion(page));
  }
  if (cooldown) await expect(page.locator('.santa-message-example')).toHaveCount(0);
  await page.clock.resume();
  await chooseHero(page, 'Erica');
  await matches(page, 'Erica');
  await gifts(page).scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(30000);
  await matches(page, 'Erica');
  await expectStudioLaunchCopy(promotion(page));
});
}
