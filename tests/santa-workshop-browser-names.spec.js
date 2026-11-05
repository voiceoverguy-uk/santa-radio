import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { confirmMessage, mockStudioGeneration } from './helpers/studio-generation.js';

const names = ['Arabella', 'Brendan', 'Danny', 'Daniel', 'Dixie', 'Erin', 'Erica'];
const record = (name, suffix = '') => ({
  id: `fixture-${name}${suffix}`, name,
  ...(suffix ? { variant: `Recording ${suffix}` } : {}),
  selectionToken: 'fixture.scoped',
  previewUrl: '/api/santa-name-preview?token=fixture.scoped',
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue*', route => route.fulfill({ json: workshopCatalogueFixture }));
});

async function open(page, path) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function expectLoading(page) {
  const picker = page.locator('.smw-name-picker');
  const status = picker.locator('.smw-name-loading');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveText('Finding Santa’s recording…');
  await expect(picker.getByRole('status')).toHaveCount(1);
  await expect(status.locator('svg')).toHaveCount(1);
  await expect(status.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(picker.locator('.smw-name-skeleton, .smw-name-skeletons')).toHaveCount(0);
  await expect(picker).not.toContainText('Enter at least two letters');
  const bounds = await status.evaluate(node => {
    const box = node.getBoundingClientRect();
    const input = node.parentElement.querySelector('input').getBoundingClientRect();
    const style = getComputedStyle(node);
    return { left: box.left, right: box.right, width: innerWidth, height: box.height,
      top: box.top, inputBottom: input.bottom, border: style.borderStyle,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.inputBottom);
  expect(bounds.height).toBeLessThan(50);
  expect(bounds.border).toBe('none');
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
  return status;
}

for (const width of [390, 1280]) {
  test(`Studio shows a compact festive status for delayed catalogue and resolution at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await unlockWorkshop(page);
    const catalogue = deferred(), resolution = deferred();
    const catalogueStarted = deferred(), resolutionStarted = deferred();
    await page.route('**/names-data/*.json', async route => {
      catalogueStarted.resolve();
      await catalogue.promise;
      await route.fulfill({ json: names });
    });
    await page.route('**/api/santa-names', async route => {
      const { query, exact } = route.request().postDataJSON();
      expect(exact).toBe(true);
      expect(query).toBe('Dixie');
      resolutionStarted.resolve();
      await resolution.promise;
      await route.fulfill({ json: { records: [record(query, '1'), record(query, '2')] } });
    });
    try {
      await open(page, '/santa-message-workshop');
      await catalogueStarted.promise;
      const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
      await input.fill('Di');
      const status = await expectLoading(page);
      await expect(status.locator('svg')).toHaveCSS('animation-iteration-count', 'infinite');
      await expect(status.locator('svg')).not.toHaveCSS('animation-name', 'none');
      await input.fill('D');
      await expect(status).toHaveCount(0);
      for (const query of ['Da', 'Er', 'Di']) await input.fill(query);
      await expectLoading(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(status.locator('svg')).toHaveCSS('animation-name', 'none');
      await status.scrollIntoViewIfNeeded();
      await page.locator('.smw-builder').screenshot({ path: `generated-artifacts/workshop/name-loading-catalogue-${width}.png` });
      catalogue.resolve();
      await expect(page.getByRole('option', { name: 'Dixie', exact: true })).toBeVisible();
      await expect(status).toHaveCount(0);
      await input.press('ArrowDown');
      await input.press('Enter');
      await resolutionStarted.promise;
      await expectLoading(page);
      await expect(status.locator('svg')).toHaveCSS('animation-name', 'none');
      await expect(page.getByRole('option')).toHaveCount(0);
      await status.scrollIntoViewIfNeeded();
      await page.locator('.smw-builder').screenshot({ path: `generated-artifacts/workshop/name-loading-resolution-${width}.png` });
      resolution.resolve();
      await expect(status).toHaveCount(0);
      await expect(page.getByRole('option')).toHaveCount(2);
      await input.press('ArrowDown');
      await input.press('ArrowDown');
      await input.press('Enter');
      await expect(page.locator('.smw-name-status')).toContainText('Dixie — Recording 2');
      await expect(page.getByRole('button', { name: 'Play recorded name for Dixie', exact: true })).toBeVisible();
      await input.fill('DeletedNonexistentName');
      await expect(page.locator('.smw-name-empty')).toContainText('Santa has not recorded');
      await expect(status).toHaveCount(0);
      await expect(page.locator('.smw-name-status')).toHaveCount(0);
    } finally {
      catalogue.resolve();
      resolution.resolve();
    }
  });

  test(`homepage suggestions and selection work offline without search requests at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    let loads = 0;
    const lookups = [];
    await page.route('**/names-data/*.json', route => {
      loads++;
      return route.fulfill({ json: names });
    });
    await page.route('**/api/santa-names', route => { lookups.push(route.request().url()); return route.abort(); });
    await open(page, '/');
    const checker = page.locator('.hero-name-checker');
    const input = checker.getByRole('combobox');
    await input.fill('da');
    await expect(checker.getByRole('option')).toHaveCount(2);
    await context.setOffline(true);
    for (const query of ['er', 'di', 'da']) {
      await input.fill(query);
      await expect(checker.getByRole('option').first()).toBeVisible();
    }
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(checker.getByRole('status')).toHaveText('Yes! Santa can record for Daniel.');
    await input.fill('DeletedNonexistentName');
    await expect(checker.getByRole('option')).toHaveCount(0);
    await input.fill('d');
    await expect(checker.getByRole('option')).toHaveCount(0);
    expect(loads).toBe(1);
    expect(lookups).toEqual([]);
  });

  test(`Studio filters locally, then resolves only an explicit selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await unlockWorkshop(page);
    let loads = 0;
    const lookups = [];
    await page.route('**/names-data/*.json', route => { loads++; return route.fulfill({ json: names }); });
    await page.route('**/api/santa-names', route => {
      const data = route.request().postDataJSON();
      lookups.push(data);
      return route.fulfill({ json: { records: [record(data.query)] } });
    });
    await open(page, '/santa-message-workshop');
    const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
    for (const query of ['da', 'er', 'di', 'da']) {
      await input.fill(query);
      await expect(page.getByRole('option').first()).toBeVisible();
    }
    expect(lookups).toEqual([]);
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page.locator('.smw-name-status')).toContainText('Selected name: Daniel');
    expect(lookups).toEqual([{ query: 'Daniel', exact: true }]);
    expect(loads).toBe(1);
    await page.locator('.smw-actions .smw-button-next').click();
    await expect(page.getByRole('heading', { name: /age/i })).toBeVisible();
  });
}

test('Studio preserves variants and ignores a delayed selection after editing', async ({ page }) => {
  await unlockWorkshop(page);
  await page.route('**/names-data/*.json', route => route.fulfill({ json: names }));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/santa-names', async route => {
    const { query, exact } = route.request().postDataJSON();
    expect(exact).toBe(true);
    if (query === 'Danny') await gate;
    await route.fulfill({ json: { records: query === 'Dixie'
      ? [record(query, '1'), record(query, '2')] : [record(query)] } });
  });
  await open(page, '/santa-message-workshop');
  const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await input.fill('di');
  await page.getByRole('option', { name: 'Dixie', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('option', { name: 'Dixie Recording 2', exact: true }).click();
  await expect(page.locator('.smw-name-status')).toContainText('Dixie — Recording 2');
  await input.fill('Danny');
  const pending = page.waitForRequest('**/api/santa-names');
  await page.getByRole('option', { name: 'Danny', exact: true }).click();
  await pending;
  await expectLoading(page);
  await input.fill('Er');
  release();
  await expect(page.locator('.smw-name-loading')).toHaveCount(0);
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('.smw-name-status')).toHaveCount(0);
  await expect(input).toHaveValue('Er');
});

test('names list and Studio recording failures have working retry controls', async ({ page }) => {
  await unlockWorkshop(page);
  let loads = 0, selections = 0;
  const gates = Array.from({ length: 4 }, deferred);
  await page.route('**/names-data/*.json', async route => {
    const attempt = ++loads;
    await gates[attempt - 1].promise;
    await route.fulfill(attempt === 1
      ? { status: 503, json: { error: 'Unavailable' } }
      : { json: names });
  });
  await page.route('**/api/santa-names', async route => {
    const attempt = ++selections;
    await gates[attempt + 1].promise;
    await route.fulfill(attempt === 1
      ? { status: 503, json: { error: 'Recording unavailable. Retry.' } }
      : { json: { records: [record('Danny')] } });
  });
  await open(page, '/santa-message-workshop');
  const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await input.fill('Danny');
  await expectLoading(page);
  gates[0].resolve();
  await expect(page.locator('.smw-name-error-panel')).toContainText('names list could not be loaded');
  await expect(page.locator('.smw-name-loading')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry name search' }).click();
  await expectLoading(page);
  gates[1].resolve();
  await page.getByRole('option', { name: 'Danny', exact: true }).click();
  await expectLoading(page);
  gates[2].resolve();
  await expect(page.locator('.smw-name-error-panel')).toContainText('Recording unavailable');
  await expect(page.locator('.smw-name-loading')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry name search' }).click();
  await expectLoading(page);
  gates[3].resolve();
  await expect(page.locator('.smw-name-status')).toContainText('Selected name: Danny');
  await expect(page.locator('.smw-name-loading')).toHaveCount(0);
  expect(loads).toBe(2);
  expect(selections).toBe(2);
});

const next = page => page.locator('.smw-actions .smw-button-next').click();
const nameInput = page => page.getByRole('combobox', { name: 'Search recorded names', exact: true });
const create = page => page.locator('.smw-actions--review').getByRole('button', { name: 'Create message', exact: true });
async function chooseName(page, name = 'Brendan') {
  await nameInput(page).fill(name);
  await page.getByRole('option', { name, exact: true }).click();
}
async function remainingChoices(page) {
  await page.getByRole('listbox').press('Home');
  await next(page);
  await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
  for (let index = 0; index < 4; index++) {
    await page.getByRole('listbox').press('Home');
    await next(page);
  }
  await expect(page.locator('.smw-summary')).toBeVisible();
}
async function setupDelayed(page) {
  await unlockWorkshop(page);
  await page.route('**/names-data/*.json', route => route.fulfill({ json: names }));
  const generation = await mockStudioGeneration(page, { record: record('Brendan') });
  return generation;
}

for (const width of [390, 1280]) {
  for (const control of ['header', 'bottom']) {
    test(`chosen name advances using ${control} before lookup at ${width}px, survives Back and review edits`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const generation = await setupDelayed(page);
      const gate = deferred();
      let lookups = 0, previews = 0;
      await page.route('**/api/santa-names', async route => {
        lookups++;
        await gate.promise;
        await route.fulfill({ json: { records: [record('Brendan')] } }).catch(() => {});
      });
      await page.route('**/api/santa-name-preview?*', route => { previews++; return route.abort(); });
      try {
        await open(page, '/santa-message-workshop');
        // Typing an exact valid display name alone still cannot advance.
        await nameInput(page).fill('Brendan');
        await next(page);
        await expect(page.locator('#smw-validation')).toContainText('Please choose their name');
        await page.getByRole('option', { name: 'Brendan', exact: true }).click();
        await expect(page.locator('#smw-validation')).toHaveText('');
        await expect(page.locator('.smw-name-status')).toHaveText('Selected name: Brendan');
        await expect(page.locator('.smw-activity-wording')).toContainText('Brendan');
        await expect(page.getByRole('button', { name: 'Play recorded name for Brendan' })).toHaveCount(0);
        if (control === 'header') await page.getByRole('button', { name: 'Continue to next step', exact: true }).click();
        else await next(page);
        await expect(page.getByRole('heading', { name: 'How old are they?' })).toBeVisible();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(page.locator('.smw-name-status')).toContainText('Brendan');
        await expectLoading(page);
        await next(page);
        await remainingChoices(page);
        await expect(create(page)).toBeDisabled();
        await expect(page.locator('.smw-review')).toContainText('Finding Santa’s recording');
        if (control === 'bottom') await page.locator('.smw-review').screenshot({
          path: `generated-artifacts/workshop/name-pending-review-${width}.png`,
        });
        await page.getByRole('button', { name: 'Change Age', exact: true }).click();
        // Resolution on an unrelated step cannot move it or reset its answer.
        const age = await page.getByRole('listbox').getAttribute('aria-activedescendant');
        gate.resolve();
        await expect.poll(() => lookups).toBe(1);
        await expect(page.getByRole('heading', { name: 'How old are they?' })).toBeVisible();
        await expect(page.getByRole('listbox')).toHaveAttribute('aria-activedescendant', age);
        await next(page);
        await expect(create(page)).toBeEnabled();
        await page.getByRole('button', { name: 'Change Their recorded name', exact: true }).click();
        await expect(page.locator('.smw-name-status')).toContainText('Brendan');
        await expect(page.getByRole('button', { name: 'Play recorded name for Brendan' })).toBeVisible();
        await next(page);
        await confirmMessage(page);
        await expect(page.getByRole('region', { name: 'Your finished Santa message' })).toBeVisible();
        expect(generation.posts).toHaveLength(1);
        expect(generation.posts[0].name).toBe('fixture-Brendan');
        expect(lookups).toBe(1);
        expect(previews).toBe(0);
      } finally { gate.resolve(); }
    });
  }
}

test('multiple recordings arriving on review require an explicit exact variant without losing other answers', async ({ page }) => {
  const generation = await setupDelayed(page);
  generation.record = record('Dixie', '2');
  const gate = deferred();
  let lookups = 0;
  await page.route('**/api/santa-names', async route => {
    lookups++;
    await gate.promise;
    await route.fulfill({ json: { records: [record('Dixie', '1'), record('Dixie', '2')] } });
  });
  try {
    await open(page, '/santa-message-workshop');
    await chooseName(page, 'Dixie');
    await next(page);
    await remainingChoices(page);
    gate.resolve();
    await expect(page.locator('.smw-review')).toContainText('Choose the exact name recording');
    await expect(create(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Play recorded name for Dixie' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Check name recording', exact: true }).click();
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
    // Can return to review without a variant, but cannot generate.
    await next(page);
    await expect(create(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Check name recording', exact: true }).click();
    await page.getByRole('option', { name: 'Dixie Recording 2', exact: true }).click();
    await next(page);
    await expect(page.locator('.smw-summary')).toContainText('Dixie — Recording 2');
    await expect(page.locator('.smw-summary')).toContainText('Teamwork');
    await confirmMessage(page);
    await expect.poll(() => generation.posts.length).toBe(1);
    expect(generation.posts[0].name).toBe('fixture-Dixie2');
    expect(lookups).toBe(1);
  } finally { gate.resolve(); }
});

for (const failure of ['unavailable', 'missing', 'timeout']) {
  test(`${failure} lookup remains chosen on review and retries without resetting details`, async ({ page }) => {
    const generation = await setupDelayed(page);
    const gate = deferred();
    let attempts = 0;
    await page.route('**/api/santa-names', async route => {
      const attempt = ++attempts;
      if (attempt === 1) {
        await gate.promise;
        await route.fulfill(failure === 'unavailable'
          ? { status: 503, json: { error: 'Recording unavailable. Retry.' } }
          : { json: { records: [] } }).catch(() => {});
      } else await route.fulfill({ json: { records: [record('Brendan')] } });
    });
    try {
      await open(page, '/santa-message-workshop');
      if (failure === 'timeout') await page.clock.install();
      await chooseName(page);
      await next(page);
      await remainingChoices(page);
      if (failure === 'timeout') await page.clock.fastForward(15001);
      else gate.resolve();
      await expect(page.getByRole('button', { name: 'Retry recording lookup', exact: true })).toBeVisible();
      await expect(page.locator('.smw-summary')).toContainText('Brendan');
      await expect(page.locator('.smw-review')).not.toContainText('Please choose their name');
      await expect(create(page)).toBeDisabled();
      expect(generation.posts).toEqual([]);
      await page.getByRole('button', { name: 'Retry recording lookup', exact: true }).click();
      await expect(create(page)).toBeEnabled();
      await expect(page.locator('.smw-summary')).toContainText('Teamwork');
      expect(attempts).toBe(2);
    } finally { gate.resolve(); }
  });
}

for (const action of ['replace', 'clear', 'leave']) {
  test(`obsolete lookup is cancelled on ${action} and cannot overwrite the current choice`, async ({ page }) => {
    await setupDelayed(page);
    const gate = deferred();
    let started = false;
    await page.addInitScript(() => {
      const request = window.fetch;
      window.cancelledNameLookups = 0;
      window.fetch = (url, options) => {
        if (url === '/api/santa-names') options.signal?.addEventListener('abort', () => window.cancelledNameLookups++);
        return request(url, options);
      };
    });
    await page.route('**/api/santa-names', async route => {
      const { query } = route.request().postDataJSON();
      if (query === 'Brendan') { started = true; await gate.promise; }
      await route.fulfill({ json: { records: [record(query)] } }).catch(() => {});
    });
    try {
      await open(page, '/santa-message-workshop');
      await chooseName(page);
      await expect.poll(() => started).toBe(true);
      if (action === 'leave') await page.getByRole('link', { name: 'Home', exact: true }).first().click();
      else {
        await nameInput(page).fill('');
        if (action === 'replace') await chooseName(page, 'Erin');
      }
      await expect.poll(() => page.evaluate(() => window.cancelledNameLookups)).toBe(1);
      gate.resolve();
      if (action === 'replace') {
        await expect(page.locator('.smw-name-status')).toContainText('Erin');
        await expect(page.getByRole('button', { name: 'Play recorded name for Erin' })).toBeVisible();
      } else if (action === 'clear') {
        await expect(page.locator('.smw-name-status')).toHaveCount(0);
        await next(page);
        await expect(page.locator('#smw-validation')).toContainText('Please choose their name');
      } else await expect(page.locator('.smw-page')).toHaveCount(0);
    } finally { gate.resolve(); }
  });
}

test('same-tab recipient prefill resolves in the background but never returns after a deliberate clear', async ({ page }) => {
  await setupDelayed(page);
  const gate = deferred();
  let lookups = 0;
  await page.route('**/api/santa-names', async route => {
    lookups++;
    await gate.promise;
    await route.fulfill({ json: { records: [record('Brendan')] } }).catch(() => {});
  });
  try {
    await open(page, '/');
    const checker = page.locator('.hero-name-checker');
    await checker.getByRole('combobox').fill('Brendan');
    await checker.getByRole('option', { name: 'Brendan', exact: true }).click();
    // Real same-tab navigation through the existing promotion voucher form.
    const form = page.locator('.workshop-password-form--promotion');
    await form.getByLabel('Voucher code', { exact: true }).fill(process.env.WORKSHOP_TEST_PASSWORD);
    await form.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
    await expect(page.locator('.smw-name-status')).toHaveText('Selected name: Brendan');
    await next(page);
    await expect(page.getByRole('heading', { name: 'How old are they?' })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await nameInput(page).fill('');
    gate.resolve();
    await expect(page.locator('.smw-name-status')).toHaveCount(0);
    await next(page);
    await expect(page.locator('#smw-validation')).toContainText('Please choose their name');
    expect(lookups).toBe(1);
  } finally { gate.resolve(); }
});
