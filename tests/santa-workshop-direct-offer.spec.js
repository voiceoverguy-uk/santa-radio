import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { STUDIO_PATH } from '../src/lib/studioRoute.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const built = ['node', 'preview'].includes(process.env.WORKSHOP_SERVING_MODE);
const paidMode = built ? 'live' : 'sandbox';
const promotion = page => page.locator('#santa-studio-promotion');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 10000 } }));
  await page.route('**/api/santa-workshop-access', route => route.fulfill({ status: 401, json: { authorized: false } }));
  await page.route('**/api/santa-studio-access', route => route.fulfill({ json: { authorized: false } }));
  await page.route('**/api/santa-studio-checkout', route => route.fulfill({
    json: { available: true, sandbox: !built, mode: paidMode, amount: 650, currency: 'gbp' },
  }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
});

async function visit(page, path = STUDIO_PATH) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

test('fresh direct entry shares the complete homepage offer, not the rest of the homepage', async ({ page }) => {
  const capture = async () => promotion(page).evaluate(root => ({
    offer: root.querySelector('.santa-studio-promotion__offer').textContent,
    benefits: root.querySelector('.santa-studio-promotion__benefits-lead').textContent,
    count: root.querySelector('.santa-studio-promotion__name-count').textContent,
    gifts: root.querySelectorAll('.studio-gifts__thumbnail').length,
    layout: getComputedStyle(root).gridTemplateColumns,
    width: root.getBoundingClientRect().width,
  }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit(page, '/');
  await expect(promotion(page).locator('.santa-studio-promotion__name-count')).toContainText('names available');
  const home = await capture();
  await visit(page);
  await expect(promotion(page).locator('.santa-studio-promotion__name-count')).toContainText('names available');
  expect(await capture()).toEqual(home);
  expect(home.gifts).toBe(3);
  await expect(page.getByRole('heading', { level: 1, name: 'MESSAGE FROM SANTA', exact: true })).toBeVisible();
  await expect(page.getByLabel('Voucher code', { exact: true })).toHaveCount(1);
  await expect(promotion(page).locator('audio')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Purchase —/ })).toHaveCount(1);
  await expect(page.locator('.smw-builder, .hero-name-preview__hero, .soundboard, .santa-message-reviews')).toHaveCount(0);
  await expect(page.locator('.radio-dock')).toBeHidden();
  await page.reload();
  await expect(promotion(page)).toBeVisible();
});

test('real isolated voucher opens Studio on the same URL and refresh preserves it', async ({ page }) => {
  await page.unroute('**/api/santa-workshop-access');
  await visit(page);
  await page.getByLabel('Voucher code', { exact: true }).fill(process.env.WORKSHOP_TEST_PASSWORD);
  await page.getByLabel('Voucher code', { exact: true }).press('Enter');
  await expect(page.locator('.smw-builder')).toBeVisible();
  await expect(page).toHaveURL(STUDIO_PATH);
  await expect(promotion(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.smw-builder')).toBeVisible();
});

test('invalid vouchers and unavailable checks retain the full offer and never mount the maker', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/santa-studio-access', route => route.fulfill(
    unavailable ? { status: 503, json: {} } : { json: { authorized: false } }
  ));
  await visit(page);
  await expect(page.getByRole('alert')).toContainText('could not be reached');
  await expect(promotion(page)).toBeVisible();
  const form = promotion(page).locator('form');
  await form.getByLabel('Voucher code', { exact: true }).fill('synthetic-invalid');
  await form.getByRole('button').click();
  await expect(form.getByRole('alert')).toContainText('not recognised');
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Retry access check' }).click();
  await expect(page.getByRole('button', { name: 'Retry access check' })).toHaveCount(0);
  await expect(promotion(page)).toBeVisible();
});

test('pending payment stays locked until a successful paid check, and cancellation retains the offer', async ({ page }) => {
  let paid = false;
  await page.route('**/api/santa-studio-access', route => route.fulfill({ json: { authorized: paid, mode: paidMode } }));
  await visit(page, `${STUDIO_PATH}?studioCheckout=cancelled`);
  await expect(promotion(page)).toContainText('No new access has been granted');
  await visit(page, `${STUDIO_PATH}?checkout=return`);
  await expect(page.getByText(/A successful payment has not been confirmed/)).toBeVisible();
  await expect(promotion(page)).toBeVisible();
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  // Same-return-URL checkout must trigger a new access check too.
  await page.route('**/api/santa-studio-checkout', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    paid = true;
    return route.fulfill({ json: { openStudio: true } });
  });
  await page.getByRole('button', { name: /^Purchase —/ }).click();
  await expect(page.locator('.smw-builder')).toBeVisible();
  await expect(page).toHaveURL(`${STUDIO_PATH}?checkout=return`);
});

test('private links require explicit redemption and keep remaining allowance access', async ({ page }) => {
  let paid = false, redemptions = 0;
  const token = 'x'.repeat(43);
  await page.route('**/api/santa-studio-access', route => route.fulfill({
    json: { authorized: paid, mode: paidMode, remaining: 1 },
  }));
  await page.route('**/api/santa-studio-return', route => {
    redemptions++;
    expect(route.request().postDataJSON()).toEqual({ token });
    paid = true;
    return route.fulfill({ json: { authorized: true } });
  });
  await visit(page, `${STUDIO_PATH}#studio-return=${token}`);
  await expect(page.getByRole('button', { name: 'Open my Studio', exact: true })).toBeVisible();
  expect(redemptions).toBe(0);
  await expect(page).toHaveURL(STUDIO_PATH);
  await expect(promotion(page)).toBeVisible();
  await page.getByRole('button', { name: 'Open my Studio', exact: true }).click();
  await expect(page.locator('.smw-builder')).toBeVisible();
  expect(redemptions).toBe(1);
});

test('fresh email-link requests are secondary and errors stay within their form', async ({ page }) => {
  await page.route('**/api/santa-studio-return', route => route.fulfill({
    json: { requested: true, message: 'Synthetic fresh link requested.' },
  }));
  await visit(page);
  await page.getByLabel('Purchase email address').fill('studio-fixture@example.invalid');
  await page.getByRole('button', { name: 'Email a fresh access link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Synthetic fresh link requested.' })).toBeVisible();
  await expect(promotion(page)).toBeVisible();
  await expect(page.locator('.smw-builder')).toHaveCount(0);
  await page.route('**/api/santa-studio-return', route => route.fulfill({
    status: 503, json: { error: 'Synthetic email service unavailable.' },
  }));
  await page.getByLabel('Purchase email address').fill('studio-fixture@example.invalid');
  await page.getByRole('button', { name: 'Email a fresh access link' }).click();
  await expect(page.locator('.studio-entry-return').getByRole('alert')).toHaveText('Synthetic email service unavailable.');
  await expect(promotion(page).getByRole('alert')).toHaveCount(0);
});

test('voucher success supersedes an old in-flight access check and preserves voucher context', async ({ page }) => {
  let authorized = false, heldCheck;
  await page.route('**/api/santa-workshop-access', async route => {
    if (route.request().method() === 'POST') authorized = true;
    if (!authorized) {
      heldCheck = route;
      return;
    }
    return route.fulfill({ json: {
      authorized: true, expiresAt: Date.now() + 120000,
      voucher: { code: 'SYNTHETIC', unlimited: true },
    } });
  });
  await visit(page);
  await expect(page.getByText('Checking Studio access…', { exact: true })).toBeVisible();
  await expect(promotion(page)).toBeVisible();
  await page.getByLabel('Voucher code', { exact: true }).fill('synthetic');
  await page.getByLabel('Voucher code', { exact: true }).press('Enter');
  await expect(page.locator('.smw-builder')).toBeVisible();
  await heldCheck.fulfill({ status: 401, json: { authorized: false } }).catch(() => {});
  await expect(page.locator('.smw-builder')).toBeVisible();
});

for (const textSize of [100, 200]) {
  test(`narrow phone retains collapsed gifts and unclipped controls at ${textSize}% text`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1000 });
    await visit(page);
    await page.addStyleTag({ content: `html { font-size: ${textSize}%; }` });
    const toggle = promotion(page).getByRole('button', { name: 'Free gifts include' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(promotion(page).locator('.santa-studio-promotion__gift-content')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
    const voucher = page.getByLabel('Voucher code', { exact: true });
    await voucher.focus();
    await page.keyboard.press('Tab');
    await expect(promotion(page).getByRole('button', { name: 'Create your bespoke message' })).toBeFocused();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(promotion(page).locator('.santa-studio-promotion__gift-content')).toBeVisible();
    const clipped = await page.locator('.workshop-gate').evaluate(root =>
      [...root.querySelectorAll('input, button, h1, .santa-studio-promotion__offer p')]
        .filter(node => node.getBoundingClientRect().width > 0)
        .filter(node => node.scrollWidth > node.clientWidth + 1)
        .map(node => node.textContent));
    expect(clipped).toEqual([]);
  });
}
