import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { GENERAL_FORM_URL } from '../src/lib/songSubmission.js';

const details = {
  FIRSTNAME: 'Ruth', LASTNAME: 'Example', EMAIL: 'ruth@example.test',
  sponsorBrand: 'North Pole Treats', sponsorWebsite: 'https://example.test',
  sponsorCampaign: 'Christmas hampers for families.', sponsorLaunchDate: '2026-11-01',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })));
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.goto('/submit-a-song?mode=sponsorship', { waitUntil: 'domcontentloaded' });
});

test('sponsorship validation, pending controls and provider message errors remain accessible', async ({ page }) => {
  let requests = 0;
  let release;
  await page.route(`${GENERAL_FORM_URL}?isAjax=1`, async route => {
    requests++;
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({
      status: 400, headers: { 'Access-Control-Allow-Origin': '*' },
      json: { success: false, message: 'Please check the campaign details.',
        errors: { SONG_REQUEST: 'Please shorten your campaign details.' } },
    });
  });
  const send = page.getByRole('button', { name: 'Send sponsorship enquiry', exact: true });
  await send.click();
  await expect(page.locator('[name="FIRSTNAME"]')).toBeFocused();
  for (const name of Object.keys(details)) {
    await expect(page.locator(`[name="${name}"]`)).toHaveAttribute('aria-invalid', 'true');
    await page.locator(`[name="${name}"]`).fill(details[name]);
  }
  await page.locator('[name="sponsorWebsite"]').fill('invalid');
  await page.locator('[name="sponsorLaunchDate"]').fill('2027-01-01');
  await send.click();
  await expect(page.locator('#song-sponsorWebsite-error')).toContainText('https://');
  await expect(page.locator('#song-sponsorLaunchDate-error')).toContainText('31 December 2026');
  expect(requests).toBe(0);
  await page.locator('[name="sponsorWebsite"]').fill(details.sponsorWebsite);
  await page.locator('[name="sponsorLaunchDate"]').fill(details.sponsorLaunchDate);
  await send.click();
  try {
    await expect(page.getByRole('button', { name: 'Sending your sponsorship enquiry…' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Christmas sponsorship', exact: true })).toBeDisabled();
    await expect(page.locator('[name="sponsorCampaign"]')).toHaveAttribute('readonly', '');
    expect(requests).toBe(1);
  } finally {
    release?.();
  }
  await expect(page.locator('#song-sponsorCampaign-error')).toHaveText('Please shorten your campaign details.');
  await expect(page.locator('[name="sponsorCampaign"]')).toBeFocused();
  await expect(page.locator('[name="sponsorBrand"]')).toHaveValue(details.sponsorBrand);
  await expect(send).toBeEnabled();
});

test('the complete sponsorship offer and fields fit desktop and narrow phones', async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Christmas sponsorship enquiry', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const fits = await page.locator('.submit-body').evaluate(element => {
      const container = element.getBoundingClientRect();
      return [...element.querySelectorAll('h2, p, input:not([tabindex="-1"]), textarea, button')]
        .filter(node => node.offsetWidth)
        .every(node => {
          const box = node.getBoundingClientRect();
          return box.left >= container.left - 1 && box.right <= container.right + 1;
        });
    });
    expect(fits).toBe(true);
  }
});
