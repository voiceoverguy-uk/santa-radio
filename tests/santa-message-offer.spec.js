import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { adult, brevoUrl, fillAccessForm, mockBrevo, mockSantaNames } from './helpers/message-access.js';
import { CONSENT_KEY, SETTINGS_EVENT } from '../src/privacy/cookieConsent.js';
import { MESSAGE_ACCESS_KEY } from '../src/lib/santaMessageAccess.js';

const OFFER_KEY = 'santa-message-offer-shown';
const LAST_SHOWN_KEY = 'santa-message-offer-last-shown';
const COOLDOWN_MS = 48 * 60 * 60 * 1000;
const offer = page => page.getByRole('dialog', { name: 'A FREE personal message from Santa' });

async function consent(page) {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })), CONSENT_KEY);
}
async function start(page, path = '/apps', { cookies = true } = {}) {
  if (cookies) await consent(page);
  await page.clock.install();
  await page.goto(path);
  await expect(page.locator('.navbar')).toBeVisible();
}
async function advance(page, ms = 16200) {
  await page.clock.runFor(ms);
}
async function openOffer(page) {
  await start(page);
  await advance(page);
  await advance(page, 400);
  await expect(offer(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockBrevo(page, { success: false, message: 'Test signup refused. Please try again.' });
  await mockSantaNames(page);
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
});

test('sixteen seconds survives internal navigation; dismissal survives refresh and contains no adult details', async ({ page }) => {
  await start(page);
  await advance(page, 9000);
  await expect(offer(page)).toHaveCount(0);
  await page.locator('.navbar').getByRole('link', { name: 'Music', exact: true }).click();
  await advance(page, 6000);
  await expect(offer(page)).toHaveCount(0);
  await advance(page, 1300);
  await expect(offer(page)).toBeVisible();
  await fillAccessForm(page);
  await offer(page).getByRole('button', { name: 'Maybe later' }).click();
  expect(await page.evaluate(key => sessionStorage.getItem(key), OFFER_KEY)).toBe('shown');
  expect(Number(await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY))).toBeGreaterThan(0);
  await page.reload();
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(adult.EMAIL);
});

test('closing with × or Escape keeps the same 48-hour cooldown', async ({ page }) => {
  await openOffer(page);
  const firstShown = await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY);
  await offer(page).getByRole('button', { name: 'Close Santa message offer' }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY)).toBe(firstShown);
  await page.reload();
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);

  // A separate tab in this browser context starts with the same origin storage.
  const second = await page.context().newPage();
  await second.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await second.clock.install();
  await second.goto('/apps');
  await expect(second.locator('.navbar')).toBeVisible();
  await advance(second);
  await expect(offer(second)).toHaveCount(0);
  await second.goto('/free-santa-message');
  await expect(second.getByRole('heading', { name: 'Free Personalised Santa Message' })).toBeVisible();
  await expect(second.locator('.santa-message-access')).toBeVisible();
  await expect(offer(second)).toHaveCount(0);
  await second.close();
});

test('Escape dismissal does not shorten the cooldown', async ({ page }) => {
  await openOffer(page);
  const firstShown = await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY);
  await page.keyboard.press('Escape');
  await expect(offer(page)).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY)).toBe(firstShown);
  await page.reload();
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);
});

test('an offer shown in another already-open tab suppresses the current visit', async ({ page }) => {
  await start(page);
  const otherTab = await page.context().newPage();
  await otherTab.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await otherTab.clock.install();
  await otherTab.goto('/apps');
  await expect(otherTab.locator('.navbar')).toBeVisible();

  await advance(page);
  await advance(page, 400);
  await expect.poll(async () => (await offer(page).count()) + (await offer(otherTab).count())).toBe(1);
  await advance(otherTab, 20000);
  await expect.poll(async () => (await offer(page).count()) + (await offer(otherTab).count())).toBe(1);
  await otherTab.close();
});

test('the offer stays suppressed just before expiry and can appear once eligible at expiry', async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, String(Date.now() - (48 * 60 * 60 * 1000) + 30000));
  }, LAST_SHOWN_KEY);
  await start(page);
  await advance(page, 16200);
  await expect(offer(page)).toHaveCount(0);
  await advance(page, 15000);
  await expect(offer(page)).toBeVisible();
});

test('an expired legacy session marker cannot suppress the offer indefinitely', async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, 'shown'), OFFER_KEY);
  await start(page);
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);
  const migratedTime = Number(await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY));
  expect(migratedTime).toBeGreaterThan(0);

  await page.evaluate(key => localStorage.setItem(key, String(Date.now() - 48 * 60 * 60 * 1000 - 1)), LAST_SHOWN_KEY);
  await page.reload();
  await advance(page);
  await expect(offer(page)).toBeVisible();
});

test('malformed cooldown data is ignored and replaced after the offer appears', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, 'not-a-timestamp'), LAST_SHOWN_KEY);
  await openOffer(page);
  expect(Number(await page.evaluate(key => localStorage.getItem(key), LAST_SHOWN_KEY))).toBeGreaterThan(0);
});

test('a storage snapshot preserves the cooldown in a fresh browser context', async ({ page, browser }) => {
  await openOffer(page);
  const state = await page.context().storageState();
  const restartedContext = await browser.newContext({ storageState: state });
  const restarted = await restartedContext.newPage();
  await restarted.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await restarted.clock.install();
  await restarted.goto('/apps');
  await expect(restarted.locator('.navbar')).toBeVisible();
  await advance(restarted, 20000);
  await expect(offer(restarted)).toHaveCount(0);
  await restartedContext.close();
});

test('hidden time is not browsing time', async ({ page }) => {
  await start(page);
  await advance(page, 8000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await advance(page, 60000);
  await expect(offer(page)).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await advance(page, 7000);
  await expect(offer(page)).toHaveCount(0);
  await advance(page, 1300);
  await expect(offer(page)).toBeVisible();
});

test('unresolved cookies and cookie settings defer the ready offer', async ({ page }) => {
  await start(page, '/apps', { cookies: false });
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);
  await page.locator('.marketing-consent').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await advance(page, 1000);
  await expect(offer(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await advance(page, 400);
  await expect(offer(page)).toBeVisible();
});

test('saved-cookie settings defer and can close an already open offer', async ({ page }) => {
  await start(page);
  await page.evaluate(event => window.dispatchEvent(new Event(event)), SETTINGS_EVENT);
  await advance(page, 18000);
  await expect(offer(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await advance(page, 400);
  await expect(offer(page)).toBeVisible();
  await page.evaluate(event => window.dispatchEvent(new Event(event)), SETTINGS_EVENT);
  await expect(offer(page)).toHaveCount(0);
});

for (const path of ['/privacy-policy', '/free-santa-message', '/sign-in', '/sign-up', '/request-names']) {
  test(`excluded route ${path} never prompts`, async ({ page }) => {
    await start(page, path);
    await advance(page, 20000);
    await expect(offer(page)).toHaveCount(0);
  });
}

test('prior message access suppresses the offer', async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, 'granted'), MESSAGE_ACCESS_KEY);
  await start(page);
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);
});

test('homepage signup in view defers until it is out of view', async ({ page }) => {
  await start(page, '/');
  await page.locator('#santa-messages .santa-message-access').scrollIntoViewIfNeeded();
  await advance(page, 18000);
  await expect(offer(page)).toHaveCount(0);
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await advance(page, 400);
  await expect(offer(page)).toBeVisible();
});

test('active and partly completed forms and other dialogs defer, not consume, the offer', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML = '<label>Test enquiry<input name="enquiry"></label>';
    document.body.prepend(form);
    form.querySelector('input').focus();
  });
  await advance(page, 18000);
  await expect(offer(page)).toHaveCount(0);
  await page.getByLabel('Test enquiry').fill('An unfinished enquiry');
  await page.getByLabel('Test enquiry').blur();
  await advance(page, 400);
  await expect(offer(page)).toHaveCount(0);
  await page.evaluate(() => {
    document.querySelector('form').remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'other-dialog';
    dialog.textContent = 'Another task';
    document.body.append(dialog);
    dialog.showModal();
  });
  await advance(page, 1000);
  await expect(offer(page)).toHaveCount(0);
  await page.evaluate(() => document.querySelector('#other-dialog').remove());
  await advance(page, 400);
  await expect(offer(page)).toBeVisible();
});

test('storage failure keeps dismissal suppressed for mounted navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.startsWith('santa-message-offer-')) throw new Error('blocked'); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('santa-message-offer-')) throw new Error('blocked'); return set.call(this, key, value); };
  });
  await openOffer(page);
  await page.keyboard.press('Escape');
  await page.locator('.navbar').getByRole('link', { name: 'Music', exact: true }).click();
  await advance(page, 20000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(offer(page)).toHaveCount(0);
});

test('storage failure still shares the shown offer with another open tab', async ({ page }) => {
  await page.context().addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key.startsWith('santa-message-offer-')) throw new Error('blocked');
      return get.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('santa-message-offer-')) throw new Error('blocked');
      return set.call(this, key, value);
    };
  });
  await start(page);
  const otherTab = await page.context().newPage();
  await otherTab.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await otherTab.clock.install();
  await otherTab.goto('/apps');
  await expect(otherTab.locator('.navbar')).toBeVisible();

  await advance(page);
  await advance(page, 400);
  await expect.poll(async () => (await offer(page).count()) + (await offer(otherTab).count())).toBe(1);
  await advance(otherTab, 20000);
  await expect.poll(async () => (await offer(page).count()) + (await offer(otherTab).count())).toBe(1);
  await otherTab.close();
});

test('keyboard is contained, background inert, Escape restores focus and privacy navigation is free', async ({ page }) => {
  await start(page);
  const opener = page.locator('.navbar').getByRole('link', { name: 'Music', exact: true });
  await opener.focus();
  await advance(page);
  const close = offer(page).getByRole('button', { name: 'Close Santa message offer' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(offer(page).getByRole('button', { name: 'Maybe later' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(await page.locator('.santa-offer').evaluate(el => el.matches(':modal'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await page.evaluate(keys => {
    sessionStorage.removeItem(keys.session);
    localStorage.removeItem(keys.lastShown);
  }, { session: OFFER_KEY, lastShown: LAST_SHOWN_KEY });
  await page.reload();
  await advance(page);
  await offer(page).getByRole('link', { name: 'privacy policy' }).click();
  await expect(page).toHaveURL(/privacy-policy$/);
  await expect(offer(page)).toHaveCount(0);
  expect(await page.locator('body').evaluate(el => el.style.overflow)).not.toBe('hidden');
});

test('wheel outside the open offer scrolls the website without dismissing or activating background controls', async ({ page }) => {
  await openOffer(page);
  const dialog = offer(page);
  await expect(dialog.locator('.santa-message-access__intro')).toHaveText('These are your details. You’ll choose your child’s recorded name next.');
  const close = dialog.getByRole('button', { name: 'Close Santa message offer' });
  await expect(close).toBeFocused();
  const before = await page.evaluate(() => window.scrollY);
  const panel = await dialog.boundingBox();
  await page.mouse.click(8, 200);
  await page.mouse.wheel(0, 350);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 200);
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  expect(await dialog.evaluate(el => el.matches(':modal'))).toBe(true);
  const afterOutside = await page.evaluate(() => window.scrollY);
  await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(afterOutside);
  await page.mouse.move(8, 200);
  await page.mouse.wheel(0, -350);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(afterOutside);
  await close.click();
  await expect(dialog).toHaveCount(0);
  expect(await page.locator('body').evaluate(el => el.style.overflow)).not.toBe('hidden');
});

test('accepted signup unlocks studio directly with empty child name and no duplicate requests', async ({ page }) => {
  let calls = 0, release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(brevoUrl, async route => {
    calls++;
    await held;
    await route.fulfill({ json: { success: true }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await openOffer(page);
  await fillAccessForm(page);
  await offer(page).locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(offer(page).getByRole('button', { name: 'Opening the recording studio…' })).toBeDisabled();
  await expect.poll(() => calls).toBe(1);
  release();
  await expect(page).toHaveURL(/free-santa-message$/);
  await expect(offer(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Download your free Santa greeting' })).toBeFocused();
  await advance(page, 500);
  await expect.poll(() => page.evaluate(() => Math.round(
    document.querySelector('#santa-messages .message-layout').getBoundingClientRect().top -
    document.querySelector('.navbar').getBoundingClientRect().bottom,
  ))).toBe(24);
  await expect(page.getByRole('combobox')).toHaveValue('');
  await expect(page.locator('.santa-message-access')).toHaveCount(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBe('granted');
  await page.goto('/');
  await expect(page.locator('#santa-messages .santa-message-access')).toHaveCount(0);
});

test('validation, honeypot, rejection and timeout retain details and allow retry', async ({ page }) => {
  let calls = 0;
  await page.route(brevoUrl, route => { calls++; return route.fulfill({ json: { success: false, message: 'Please retry your signup.' } }); });
  await openOffer(page);
  await offer(page).getByRole('button', { name: 'Unlock my free Santa message' }).click();
  await expect(offer(page).getByRole('textbox', { name: 'First name', exact: true })).toBeFocused();
  await fillAccessForm(page);
  await offer(page).locator('[name=email_address_check]').fill('bot', { force: true });
  await offer(page).locator('form').evaluate(form => form.requestSubmit());
  expect(calls).toBe(0);
  await offer(page).locator('[name=email_address_check]').evaluate(el => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await offer(page).locator('form').evaluate(form => form.requestSubmit());
  await expect(offer(page).getByRole('alert')).toContainText('Please retry');
  await page.route(brevoUrl, () => new Promise(() => {}));
  await offer(page).locator('form').evaluate(form => form.requestSubmit());
  await advance(page, 15400);
  await expect(offer(page).getByRole('alert')).toContainText('took too long');
  for (const [name, value] of Object.entries(adult)) await expect(offer(page).locator(`[name="${name}"]`)).toHaveValue(value);
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
  await mockBrevo(page);
  await offer(page).getByRole('button', { name: 'Unlock my free Santa message' }).click();
  await expect(page).toHaveURL(/free-santa-message$/);
});

test('unlock sits directly below email with no adult radio or extra Brevo fields', async ({ page }) => {
  let submitted;
  await page.route(brevoUrl, route => {
    submitted = route.request().postData();
    return route.fulfill({ json: { success: true }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await openOffer(page);
  for (const [name, value] of Object.entries(adult)) await offer(page).locator(`[name="${name}"]`).fill(value);
  await expect(offer(page).getByRole('radio')).toHaveCount(0);
  const email = await offer(page).locator('[name="EMAIL"]').boundingBox();
  const unlock = await offer(page).getByRole('button', { name: 'Unlock my free Santa message' }).boundingBox();
  expect(unlock.y - email.y - email.height).toBeGreaterThanOrEqual(0);
  expect(unlock.y - email.y - email.height).toBeLessThan(24);
  expect(submitted).toBeUndefined();
  await expect(offer(page).locator('.santa-message-access__delivery')).toHaveText('Create your greeting, download instantly and share - not sent by email.');
  await expect(offer(page).locator('.santa-offer-sparkle')).toHaveCount(0);
  await expect(offer(page).locator('.santa-offer-decoration')).toHaveCount(0);
  await expect(offer(page).locator('.santa-offer-unlock-sparkle')).toHaveCount(2);
  await offer(page).getByRole('button', { name: 'Unlock my free Santa message' }).click();
  await expect(page).toHaveURL(/free-santa-message$/);
  expect(submitted).not.toContain('adult_confirmation');
  expect(submitted).toContain('FIRSTNAME');
});

test('dismissal aborts a pending request without unlocking access', async ({ page }) => {
  await page.route(brevoUrl, () => new Promise(() => {}));
  await openOffer(page);
  await fillAccessForm(page);
  await offer(page).getByRole('button', { name: 'Unlock my free Santa message' }).click();
  await page.keyboard.press('Escape');
  await advance(page, 20000);
  await expect(offer(page)).toHaveCount(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
});

test('FREE and unlock shimmer move gently, and reduced motion stops all decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openOffer(page);
  const samples = await offer(page).evaluate(element => {
    return [
      ['.santa-offer-free-word', .4, 'backgroundPosition'],
      ['.santa-offer-unlock-sparkle', .82, 'transform'],
      ['.santa-offer-unlock-sheen', .25, 'opacity'],
    ].map(([selector, progress, property]) => {
      const target = element.querySelector(selector);
      const animation = target.getAnimations()[0];
      if (!animation) return { selector, missing: true };
      animation.pause();
      animation.currentTime = 0;
      const before = getComputedStyle(target)[property];
      animation.currentTime = animation.effect.getTiming().duration * progress;
      const after = getComputedStyle(target)[property];
      return { selector, before, after, duration: animation.effect.getTiming().duration };
    });
  });
  for (const sample of samples) {
    expect(sample.missing, sample.selector).not.toBe(true);
    expect(sample.after, sample.selector).not.toBe(sample.before);
    expect(sample.duration).toBeGreaterThanOrEqual(3000);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const selector of ['.santa-offer-free-word', '.santa-offer-unlock-sparkle', '.santa-offer-unlock-sheen']) {
    await expect(offer(page).locator(selector).first()).toHaveCSS('animation-name', 'none');
  }
});

test('desktop and short mobile offer stays scrollable, including enlarged text and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await openOffer(page);
  await page.screenshot({ path: 'generated-artifacts/santa-offer-desktop.png', animations: 'disabled' });
  const panelBounds = await offer(page).boundingBox();
  expect(panelBounds.height).toBeLessThanOrEqual(876);
  expect(Math.abs(panelBounds.y + panelBounds.height / 2 - 450)).toBeLessThanOrEqual(2);
  expect(await offer(page).evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  expect(await offer(page).locator('.santa-message-access__intro').evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().height <= parseFloat(getComputedStyle(element).lineHeight) + 1;
  })).toBe(true);
  await expect(offer(page).locator('.santa-offer-decoration, .santa-offer-sparkle')).toHaveCount(0);
  const headline = offer(page).getByRole('heading', { name: 'A FREE personal message from Santa' });
  await expect(headline).toHaveText('A FREE personal message from Santa');
  const backdrop = await offer(page).evaluate(element => {
    const style = getComputedStyle(element, '::backdrop');
    return { colour: style.backgroundColor, filter: style.backdropFilter };
  });
  expect(backdrop.colour).toMatch(/,\s*0\.3\)$/);
  expect(['none', 'blur(1px)']).toContain(backdrop.filter);
  await expect(offer(page).locator('.santa-offer-holly')).toHaveCount(2);
  const unlockBounds = await offer(page).locator('.santa-message-access__submit').boundingBox();
  const beforeBounds = await offer(page).locator('.santa-offer-unlock-sparkle--before').boundingBox();
  const afterBounds = await offer(page).locator('.santa-offer-unlock-sparkle--after').boundingBox();
  expect(beforeBounds.x + beforeBounds.width).toBeLessThanOrEqual(unlockBounds.x);
  expect(afterBounds.x).toBeGreaterThanOrEqual(unlockBounds.x + unlockBounds.width);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await offer(page).evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 375, height: 560 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: 'generated-artifacts/santa-offer-mobile.png', animations: 'disabled' });
  for (const height of [560, 320]) {
    await page.setViewportSize({ width: 375, height });
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await expect.poll(async () => (await offer(page).boundingBox()).height).toBeLessThanOrEqual(height - 15);
    for (const selector of ['[name=FIRSTNAME]', '[name=LASTNAME]', '[name=EMAIL]', '.santa-message-access__privacy', '.santa-message-access__delivery', '.santa-message-access__submit', '.santa-offer-later', '.santa-offer-close']) {
      const item = offer(page).locator(selector);
      await item.scrollIntoViewIfNeeded();
      const bounds = await item.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
      expect(bounds.y).toBeGreaterThanOrEqual(-1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    }
  }
  expect(await offer(page).evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
