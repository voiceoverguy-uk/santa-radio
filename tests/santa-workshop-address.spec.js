import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { STUDIO_PATH, STUDIO_ALIASES } from '../src/lib/studioRoute.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { issueWorkshopToken, WORKSHOP_COOKIE } from '../server/santa-workshop-access.js';

const query = '?checkout=return&synthetic=a%2Bb&repeat=1&repeat=2';
const token = 's'.repeat(43);
const addresses = [STUDIO_PATH, ...STUDIO_ALIASES].flatMap(path => [path, `${path}/`]);

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/santa-studio-access', route => route.fulfill({ json: { authorized: false } }));
  await page.route('**/api/santa-studio-checkout', route => route.fulfill({ json: { available: false } }));
});

for (const address of addresses) {
  test(`Studio direct address, refresh and private email handoff: ${address}`, async ({ page }) => {
    const leaked = [];
    page.on('request', request => { if (request.url().includes(token)) leaked.push(request.url()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${address}${query}#studio-return=${token}`);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await expect(page).toHaveURL(STUDIO_PATH + query);
    await expect(page.getByRole('button', { name: 'Open my Studio', exact: true })).toBeVisible();
    await expect(page.locator('.smw-builder')).toHaveCount(0);
    await expect(page.locator('.radio-dock')).toBeHidden();
    await expect(page.locator('.footer')).toHaveClass(/is-studio-footer/);
    await expect(page.locator('.nav-radio-icon')).toHaveCount(0);
    let posted;
    await page.route('**/api/santa-studio-return', route => {
      posted = route.request().postDataJSON();
      return route.fulfill({ status: 410, json: { error: 'Synthetic expired link' } });
    });
    await page.getByRole('button', { name: 'Open my Studio', exact: true }).click();
    expect(posted).toEqual({ token });
    expect(leaked).toEqual([]);
    await page.reload();
    await expect(page).toHaveURL(STUDIO_PATH + query);
    await expect(page.locator('.workshop-gate')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open my Studio', exact: true })).toHaveCount(0);
  });
}

test('client-side aliases preserve query and fragment and return credentials stay in memory', async ({ page }) => {
  await page.goto('/apps');
  for (const alias of STUDIO_ALIASES) {
    // Exercise client-side routing without adding public Studio navigation.
    await page.evaluate(target => {
      history.pushState({}, '', target);
      dispatchEvent(new PopStateEvent('popstate'));
    }, `${alias}${query}#studio-return=${token}`);
    await expect(page).toHaveURL(STUDIO_PATH + query);
    await expect(page.getByRole('button', { name: 'Open my Studio', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Apps', exact: true }).click();
    await expect(page).toHaveURL('/apps');
  }
});

test('real isolated tester session enters Studio and preserves mobile framing after refresh', async ({ page, context, baseURL }) => {
  const now = Date.now();
  const config = {
    signingSecret: process.env.WORKSHOP_TEST_SESSION_SECRET,
    expiresAt: Date.parse(process.env.WORKSHOP_TEST_EXPIRES_AT),
    codes: [{ id: '1', code: process.env.WORKSHOP_TEST_PASSWORD }],
  };
  await context.addCookies([{ name: WORKSHOP_COOKIE, value: issueWorkshopToken(config, now), url: baseURL }]);
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [STUDIO_ALIASES[0], STUDIO_PATH, STUDIO_ALIASES[1]]) {
    await page.goto(path);
    await expect(page).toHaveURL(STUDIO_PATH);
    await expect(page.locator('.smw-builder')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What name should Santa say?' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const panel = document.querySelector('.smw-builder').getBoundingClientRect();
      const nav = document.querySelector('.navbar').getBoundingClientRect();
      return Math.abs(panel.top - nav.bottom - 6);
    })).toBeLessThan(2);
    await page.reload();
    await expect(page.locator('.smw-builder')).toBeVisible();
    await expect(page.locator('.radio-dock')).toBeHidden();
  }
});

test('ordinary fragments and repeated query parameters survive direct and client-side redirects', async ({ page }) => {
  for (const alias of STUDIO_ALIASES) {
    await page.goto(`${alias}/${query}#private-panel`);
    await expect(page).toHaveURL(`${STUDIO_PATH}${query}#private-panel`);
    await page.goto('/apps');
    await page.evaluate(target => {
      history.pushState({}, '', target);
      dispatchEvent(new PopStateEvent('popstate'));
    }, `${alias}/${query}#private-panel`);
    await expect(page).toHaveURL(`${STUDIO_PATH}${query}#private-panel`);
  }
});

test('confirmed paid access still enters the existing Studio from checkout returns', async ({ page }) => {
  await page.route('**/api/santa-workshop-access', route => route.fulfill({ json: { authorized: false } }));
  await page.route('**/api/santa-studio-access', route => route.fulfill({
    json: { authorized: true, mode: ['node', 'preview'].includes(process.env.WORKSHOP_SERVING_MODE) ? 'live' : 'sandbox' },
  }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  for (const path of [STUDIO_PATH, ...STUDIO_ALIASES]) {
    await page.goto(`${path}?checkout=return`);
    await expect(page).toHaveURL(`${STUDIO_PATH}?checkout=return`);
    await expect(page.locator('.smw-builder')).toBeVisible();
  }
});

test('Studio never triggers the unrelated timed free-message offer', async ({ page }) => {
  await page.clock.install();
  await page.goto(STUDIO_PATH);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.clock.fastForward(20000);
  await expect(page.locator('dialog.santa-offer')).toHaveCount(0);
});
