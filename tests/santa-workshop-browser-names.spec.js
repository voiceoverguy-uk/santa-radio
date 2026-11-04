import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const names = ['Arabella', 'Danny', 'Daniel', 'Dixie', 'Erin', 'Erica'];
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

for (const width of [390, 1280]) {
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
  await input.fill('Er');
  release();
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('.smw-name-status')).toHaveCount(0);
  await expect(input).toHaveValue('Er');
});

test('names list and Studio recording failures have working retry controls', async ({ page }) => {
  await unlockWorkshop(page);
  let loads = 0, selections = 0;
  await page.route('**/names-data/*.json', route => ++loads === 1
    ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    : route.fulfill({ json: names }));
  await page.route('**/api/santa-names', route => ++selections === 1
    ? route.fulfill({ status: 503, json: { error: 'Recording unavailable. Retry.' } })
    : route.fulfill({ json: { records: [record('Danny')] } }));
  await open(page, '/santa-message-workshop');
  const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await input.fill('Danny');
  await page.getByRole('button', { name: 'Retry name search' }).click();
  await page.getByRole('option', { name: 'Danny', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Recording unavailable');
  await page.getByRole('button', { name: 'Retry name search' }).click();
  await expect(page.locator('.smw-name-status')).toContainText('Selected name: Danny');
  expect(loads).toBe(2);
  expect(selections).toBe(2);
});
