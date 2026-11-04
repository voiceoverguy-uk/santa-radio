import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { adult, mockBrevo, mockSantaNames } from './helpers/message-access.js';
import { ACCESS_REQUEST_TIMEOUT_MS, MESSAGE_ACCESS_KEY } from '../src/lib/santaMessageAccess.js';
import { CONSENT_KEY } from '../src/privacy/cookieConsent.js';

// These are DOM-level simulations, NOT real browser profile autofill or
// password-manager verification. Never send contacts to the real provider.
async function openSignup(page, entry) {
  await mockBrevo(page, { success: false });
  await mockSantaNames(page);
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })), CONSENT_KEY);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto(entry === 'popup' ? '/' : '/free-santa-message');
  await expect(page.locator('.navbar')).toBeVisible();
  const card = entry === 'popup'
    ? page.getByRole('dialog', { name: 'A FREE personal message from Santa' }).locator('.santa-message-access')
    : page.locator('.santa-message-access');
  if (entry === 'popup') await page.clock.runFor(17000);
  await expect(card).toBeVisible();
  return card;
}

async function silentlyFill(card, values = adult) {
  await card.locator('form').evaluate((form, fields) => {
    for (const [name, value] of Object.entries(fields)) {
      // Bypass React's value tracker and do NOT dispatch input/change.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
        form.elements.namedItem(name), value,
      );
    }
  }, values);
}

async function expectLocked(page, card) {
  await expect(card.getByRole('alert')).toBeVisible();
  await expect(card.getByRole('button', { name: /my free Santa message/ })).toBeEnabled();
  await expect(page.locator('.message-name-label')).toHaveCount(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
  for (const [name, value] of Object.entries(adult)) {
    await expect(card.locator(`[name="${name}"]`)).toHaveValue(value);
  }
}

for (const entry of ['popup', 'standalone']) {
  test(`${entry}: simulated contact autofill leaves the neutral trap empty and submits actual DOM values`, async ({ page }) => {
    const card = await openSignup(page, entry);
    const trap = card.locator('[name="studio_check"]');
    await expect(trap).toHaveAttribute('autocomplete', 'off');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(trap.locator('..')).toHaveAttribute('aria-hidden', 'true');
    for (const hint of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) {
      await expect(trap).toHaveAttribute(hint, 'true');
    }
    // Simulate a contact manager's identifier heuristic: the old trap name
    // matched /email/. The neutral id/name/label must not invite contact data.
    expect(await trap.evaluate(input =>
      /email|contact|address|first.?name|last.?name|surname|phone|website/i.test(
        `${input.name} ${input.id} ${[...input.labels].map(label => label.textContent).join(' ')}`,
      ))).toBe(false);
    await expect(card.locator('[name="email_address_check"]')).toHaveCount(0);
    for (const [name, autocomplete] of [['FIRSTNAME', 'given-name'], ['LASTNAME', 'family-name'], ['EMAIL', 'email']]) {
      await expect(card.locator(`[name="${name}"]`)).toHaveAttribute('autocomplete', autocomplete);
    }
    await card.locator('form').evaluate((form, fields) => {
      for (const input of form.querySelectorAll('input[type="text"], input[type="email"]')) {
        const identifier = `${input.id} ${input.name}`;
        const value = /email/i.test(identifier) ? fields.EMAIL
          : /first.?name/i.test(identifier) ? fields.FIRSTNAME
            : /surname|last.?name/i.test(identifier) ? fields.LASTNAME : null;
        if (value !== null) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      }
    }, adult);
    // Editing one field must not erase eventless autofill in the others.
    await card.locator('[name="FIRSTNAME"]').fill(`${adult.FIRSTNAME} edited`);
    await expect(card.locator('[name="LASTNAME"]')).toHaveValue(adult.LASTNAME);
    await expect(card.locator('[name="EMAIL"]')).toHaveValue(adult.EMAIL);
    await expect(trap).toHaveValue('');
    await card.locator('[name="EMAIL"]').focus();
    await page.keyboard.press('Tab');
    await expect(card.getByRole('button', { name: /my free Santa message/ })).toBeFocused();
    let submitted;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/santa-message-access')) {
        submitted = request.postDataJSON();
      }
    });
    await mockBrevo(page);
    await card.getByRole('button', { name: /my free Santa message/ }).click();
    await expect(page).toHaveURL(/\/free-santa-message$/);
    await expect(page.locator('.message-name-label')).toBeVisible();
    expect(submitted).toEqual({ ...adult, FIRSTNAME: `${adult.FIRSTNAME} edited`, studio_check: '' });
    await expect(page.locator('.form-desc')).toContainText(`${adult.FIRSTNAME} edited`);
  });

  test(`${entry}: deliberately filled trap blocks even without change events and is not silently cleared`, async ({ page }) => {
    const card = await openSignup(page, entry);
    let calls = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/santa-message-access')) calls++;
    });
    await silentlyFill(card, { ...adult, studio_check: 'deliberate trap value' });
    await card.getByRole('button', { name: /my free Santa message/ }).click();
    await expectLocked(page, card);
    await expect(card.getByRole('alert')).toHaveText('Your details could not be submitted. Please try again.');
    await expect(card.locator('[name="studio_check"]')).toHaveValue('deliberate trap value');
    expect(calls).toBe(0);
    // A second attempt cannot clear/bypass the populated trap.
    await card.getByRole('button', { name: /my free Santa message/ }).click();
    expect(calls).toBe(0);
    await silentlyFill(card, { studio_check: '' });
    await mockBrevo(page);
    await card.getByRole('button', { name: /my free Santa message/ }).click();
    await expect(page.locator('.message-name-label')).toBeVisible();
    expect(calls).toBe(1);
  });

  for (const failure of ['rejected', 'unavailable', 'unconfirmed', 'network', 'timeout']) {
    test(`${entry}: ${failure} preserves simulated autofill and allows retry without refresh`, async ({ page }) => {
      const card = await openSignup(page, entry);
      await silentlyFill(card);
      await page.route('**/api/santa-message-access', route => {
        if (route.request().method() !== 'POST') return route.fallback();
        if (failure === 'network') return route.abort('failed');
        if (failure === 'timeout') return new Promise(() => {});
        return route.fulfill({
          status: failure === 'rejected' ? 422 : failure === 'unavailable' ? 503 : 200,
          json: failure === 'unconfirmed' ? { success: 'true' }
            : { success: false, errors: failure === 'rejected' ? { EMAIL: 'Please check this email.' } : {} },
        });
      });
      await card.getByRole('button', { name: /my free Santa message/ }).click();
      if (failure === 'timeout') await page.clock.runFor(ACCESS_REQUEST_TIMEOUT_MS + 100);
      await expectLocked(page, card);
      if (failure === 'rejected') await expect(card.locator('[name="EMAIL"]')).toHaveAttribute('aria-invalid', 'true');
      await mockBrevo(page);
      await card.getByRole('button', { name: /my free Santa message/ }).click();
      await expect(page.locator('.message-name-label')).toBeVisible();
      await expect(page).toHaveURL(/\/free-santa-message$/);
    });
  }
}
