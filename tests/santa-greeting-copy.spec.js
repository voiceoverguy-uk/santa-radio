import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';
import { MESSAGE_ACCESS_KEY } from '../src/lib/santaMessageAccess.js';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockBrevo(page);
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    hostedCount: 3, warning: null,
    records: ['Wendy', 'Erin', 'Arabella'].map(name => ({ id: name.toLowerCase(), name })),
  } }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
});

async function open(page) {
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

async function handoff(page, name) {
  const checker = page.locator('.hero-name-checker');
  await checker.getByRole('combobox').fill(name);
  await checker.getByRole('option', { name, exact: true }).click();
  await checker.getByRole('button', { name: 'Create my free Santa message →' }).click();
}

for (const width of [390, 1440]) {
  test(`prefilled greeting uses adult name and preserves explicit creation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let creations = 0;
    await page.route('**/api/santa-message', route => {
      creations++;
      expect(route.request().postDataJSON().name).toBe('wendy');
      return route.fulfill({
        contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
      });
    });
    await open(page);
    await handoff(page, 'Wendy');
    await fillAccessForm(page);
    await page.locator('input[name="FIRSTNAME"]').fill('Guy');
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    const card = page.locator('.santa-message-box');
    const input = card.getByRole('combobox');
    await expect(input).toHaveValue('Wendy');
    await expect(card.locator('h3')).toHaveText('Your free Santa greeting');
    await expect(card.locator('.form-desc')).toHaveText('Hey Guy, check the name and create message.');
    await expect(card.getByText('Santa is ready to record for Wendy.', { exact: true })).toBeVisible();
    await expect(card.locator('.service-notice')).toHaveText('Free to create and download. (not sent by email)');
    expect(creations).toBe(0);
    // Editing still works, including unavailable names and returning to the carried name.
    await input.fill('UnrecordedFixture');
    await expect(card.locator('.form-desc')).toHaveText('Hey Guy, Search for the name and press Create message.');
    await expect(card.getByText('Santa is ready to record for Wendy.', { exact: true })).toHaveCount(0);
    await input.fill('Erin');
    await expect(card.getByText('Santa is ready to record for Erin.', { exact: true })).toBeVisible();
    await input.fill('Wendy');
    await input.press('Escape');
    await expect(card.locator('.form-desc')).toHaveText('Hey Guy, check the name and create message.');
    expect(creations).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    mkdirSync('generated-artifacts', { recursive: true });
    await card.screenshot({ path: `generated-artifacts/santa-greeting-copy-${width}.png`, animations: 'disabled' });
    await card.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(card.locator('.message-result audio')).toBeVisible();
    await expect(card.locator('.message-result audio')).not.toHaveAttribute('autoplay');
    await expect(card.locator('h3')).toHaveText('Your free Santa greeting');
    const downloadPromise = page.waitForEvent('download');
    await card.getByRole('link', { name: 'Download your audio', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('santa-recorded-message-for-Wendy.mp3');
    expect(await download.failure()).toBeNull();
    expect(creations).toBe(1);
  });
}

test('without a homepage handoff the maker retains search instructions', async ({ page }) => {
  await open(page);
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  const card = page.locator('.santa-message-box');
  await expect(card.locator('.form-desc')).toHaveText('Hey Testparent, Search for the name and press Create message.');
  await expect(card.locator('h3')).toHaveText('Your free Santa greeting');
  await card.getByRole('combobox').fill('Wendy');
  await expect(card.getByText('Santa is ready to record for Wendy.', { exact: true })).toBeVisible();
  await expect(card.locator('.form-desc')).toContainText('Search for the name');
});

test('remembered access without an adult name uses there in either path', async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, 'granted'), MESSAGE_ACCESS_KEY);
  await open(page);
  const card = page.locator('.santa-message-box');
  await expect(card.locator('.form-desc')).toHaveText('Hey there, Search for the name and press Create message.');
  await handoff(page, 'Wendy');
  await expect(card.getByRole('combobox')).toHaveValue('Wendy');
  await expect(card.locator('.form-desc')).toHaveText('Hey there, check the name and create message.');
});
