import { test, expect } from '@playwright/test';

const consentKey = 'santaradio-cookie-consent-v2';
const eventKey = 'partnership-test-events';
const expectedEvent = {
  name: 'partnership_enquiry_opened',
  data: { location: 'homepage_partnership', destination: '/submit-a-song', send_to: 'G-FGL2HBXZ92' },
};
const cta = page => page.locator('.partnership-strip__button');
const events = page => page.evaluate(key => {
  const current = (window.dataLayer || []).filter(args =>
    args[0] === 'event' && args[1] === 'partnership_enquiry_opened')
    .map(args => ({ name: args[1], data: args[2] }));
  return current.length ? current : JSON.parse(sessionStorage.getItem(key) || '[]');
}, eventKey);

test.use({ hasTouch: true });

test.beforeEach(async ({ context }) => {
  const hostname = new URL(test.info().project.use.baseURL).hostname;
  await context.route('**/*', route =>
    new URL(route.request().url()).hostname === hostname ? route.continue() : route.abort());
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  // Keep the app's real gtag/dataLayer queue; do not contact Google in tests.
  await context.route('https://www.googletagmanager.com/gtag/**', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }));
});

async function setup(page, { consent = true, tracker = 'available' } = {}) {
  await page.addInitScript(({ consentKey, eventKey, consent, tracker }) => {
    if (consent !== null) {
      localStorage.setItem(consentKey, JSON.stringify({
        version: 2, analytics: consent === true, marketing: false, media: false,
        savedAt: consent === 'expired' ? Date.now() - 181 * 86400000 : Date.now(),
      }));
    }
    // Snapshot the actual GA command queue before the native link unloads it.
    window.addEventListener('pagehide', () => {
      const recorded = (window.dataLayer || []).filter(args =>
        args[0] === 'event' && args[1] === 'partnership_enquiry_opened')
        .map(args => ({ name: args[1], data: args[2] }));
      sessionStorage.setItem(eventKey, JSON.stringify(recorded));
    });
  }, { consentKey, eventKey, consent, tracker });
  await page.goto('/');
  await expect(page.locator('.hero-title')).toBeVisible();
  if (consent === true) await expect.poll(() => page.evaluate(() =>
    (window.dataLayer || []).some(args => args[0] === 'event' && args[1] === 'page_view'))).toBe(true);
  if (tracker !== 'available') {
    await page.evaluate(tracker => {
      if (tracker === 'missing') delete window.gtag;
      else window.gtag = () => {
        if (tracker === 'throwing') throw new Error('Tracker blocked');
        return Promise.reject(new Error('Network blocked'));
      };
    }, tracker);
  }
  await expect(cta(page)).toHaveAttribute('href', '/submit-a-song');
}

for (const activation of ['mouse', 'keyboard', 'touch']) {
  test(`one consented event per ${activation} activation, not display or focus`, async ({ page }) => {
    await setup(page);
    await cta(page).focus();
    expect(await events(page)).toEqual([]);
    if (activation === 'keyboard') await page.keyboard.press('Enter');
    else if (activation === 'touch') await cta(page).tap();
    else await cta(page).click();
    await expect(page).toHaveURL(/\/submit-a-song$/);
    await expect(page.getByRole('heading', { name: 'Get in touch with Santa Radio', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'General enquiry', exact: true })).toBeChecked();
    expect(await events(page)).toEqual([expectedEvent]);
  });
}

for (const activation of ['middle', 'modified']) {
  test(`one event for a ${activation} new-tab activation`, async ({ page, context }) => {
    await setup(page);
    const opened = context.waitForEvent('page');
    await cta(page).click(activation === 'middle' ? { button: 'middle' } : { modifiers: ['Control'] });
    const tab = await opened;
    await expect(tab).toHaveURL(/\/submit-a-song$/);
    await expect.poll(() => events(page)).toEqual([expectedEvent]);
    await expect(page).toHaveURL(/\/$/);
    await tab.close();
  });
}

test('right-click does not emit an event', async ({ page }) => {
  await setup(page);
  await cta(page).click({ button: 'right' });
  expect(await events(page)).toEqual([]);
  await expect(page).toHaveURL(/\/$/);
});

for (const consent of [null, false, 'expired']) {
  test(`no event without valid analytics consent (${consent})`, async ({ page }) => {
    await setup(page, { consent });
    await cta(page).click();
    await expect(page).toHaveURL(/\/submit-a-song$/);
    expect(await events(page)).toEqual([]);
  });
}

test('withdrawing consent stops the event immediately', async ({ page }) => {
  await setup(page);
  await page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await page.getByRole('checkbox', { name: /Analytics cookies/ }).uncheck();
  await page.getByRole('button', { name: 'Save choices', exact: true }).click();
  await cta(page).click();
  await expect(page).toHaveURL(/\/submit-a-song$/);
  expect(await events(page)).toEqual([]);
});

for (const tracker of ['missing', 'throwing', 'rejecting']) {
  test(`navigation works when analytics is ${tracker}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await setup(page, { tracker });
    await cta(page).click();
    await expect(page).toHaveURL(/\/submit-a-song$/);
    await expect(page.getByRole('heading', { name: 'Get in touch with Santa Radio', exact: true })).toBeVisible();
    expect(await events(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
