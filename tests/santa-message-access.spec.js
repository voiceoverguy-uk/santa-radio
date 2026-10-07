import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { adult, brevoUrl, fillAccessForm, mockBrevo } from './helpers/message-access.js';
import { MESSAGE_ACCESS_KEY, ACCESS_REQUEST_TIMEOUT_MS } from '../src/lib/santaMessageAccess.js';

test.beforeEach(async ({ page }) => {
  // Every submission is intercepted; this suite must never create CRM contacts.
  await mockBrevo(page, { success: false, message: 'Test request was not accepted.' });
  await page.route('**/api/radio-metadata', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('homepage, direct visits and existing message navigation all require adult access', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('.santa-message-section');
  await expect(section.getByLabel('Child’s first name')).toHaveCount(0);
  await expect(section.getByRole('textbox', { name: 'First name', exact: true })).toBeVisible();
  await expect(section.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy-policy');
  await expect(section).not.toContainText('No signup');
  await page.locator('.hero-actions').getByRole('link', { name: /Discover Santa Messages/ }).click();
  await expect(page).toHaveURL(/\/free-santa-message$/);
  await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
  await page.goto('/apps');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'FREE Audio Message', exact: true }).click();
  await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Surname', exact: true })).toBeVisible();
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', /no signup/i);
});

test('required fields, email validation, autocomplete and keyboard errors are accessible', async ({ page }) => {
  let calls = 0;
  await page.route(brevoUrl, route => { calls++; return route.fulfill({ json: { success: false } }); });
  await page.goto('/free-santa-message');
  const first = page.getByRole('textbox', { name: 'First name', exact: true });
  const surname = page.getByRole('textbox', { name: 'Surname', exact: true });
  const email = page.getByRole('textbox', { name: 'Email address', exact: true });
  await expect(first).toHaveAttribute('autocomplete', 'given-name');
  await expect(surname).toHaveAttribute('autocomplete', 'family-name');
  await expect(email).toHaveAttribute('autocomplete', 'email');
  await expect(email).toHaveAttribute('type', 'email');
  await first.focus();
  await page.keyboard.press('Tab');
  await expect(surname).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Please enter your first name.', { exact: true })).toBeVisible();
  await fillAccessForm(page);
  await email.fill('not-an-email');
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(email).toBeFocused();
  await expect(page.getByText(/Please enter a valid email address/)).toBeVisible();
  expect(calls).toBe(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
});

test('confirmed acceptance sends exact fields, ignores external redirect and only remembers an access flag', async ({ page }) => {
  // Several full navigations on the proxied preview share one test deadline.
  test.setTimeout(90000);
  let submitted;
  const urls = [];
  page.on('request', request => urls.push(request.url()));
  await page.route(brevoUrl, async route => {
    submitted = route.request();
    await route.fulfill({ json: { success: true, redirect: 'https://example.test/legacy-message' },
      headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page).toHaveURL(/\/free-santa-message$/);
  await expect(page.getByRole('heading', { name: 'Find your free Santa greeting' })).toBeFocused();
  expect(submitted.method()).toBe('POST');
  expect(submitted.headers()['content-type']).toContain('multipart/form-data; boundary=');
  const fields = Object.fromEntries([...submitted.postData().matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)].map(match => [match[1], match[2]]));
  expect(fields).toEqual({ ...adult, email_address_check: '', locale: 'en' });
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBe('granted');
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  for (const value of Object.values(adult)) {
    expect(storage).not.toContain(value);
    expect(urls.join('\n')).not.toContain(value);
  }
  await page.reload();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  await page.goto('/');
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  await expect(page.locator('.santa-message-access')).toHaveCount(0);
  const newTab = await page.context().newPage();
  await newTab.goto('/free-santa-message');
  await expect(newTab.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
  await expect(newTab.getByLabel('Child’s first name')).toHaveCount(0);
  await newTab.close();
});

for (const [name, response] of [
  ['HTTP 200 without acceptance', { json: {} }],
  ['string false', { json: { success: 'false' } }],
  ['string true', { json: { success: 'true' } }],
  ['legacy redirect alone', { json: { redirect: 'https://example.test/legacy' } }],
  ['server failure even with success', { status: 503, json: { success: true } }],
  ['malformed HTML response', { contentType: 'text/html', body: '<html>Not acceptance</html>' }],
]) {
  test(`${name} keeps the maker locked and retains details for retry`, async ({ page }) => {
    await page.route(brevoUrl, route => route.fulfill({ ...response, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.goto('/free-santa-message');
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message' }).click();
    await expect(page.locator('.santa-message-access').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
    await expect(page.locator('input[name="EMAIL"]')).toHaveValue(adult.EMAIL);
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeEnabled();
    expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
  });
}

test('provider field errors are safe text and a successful retry opens access', async ({ page }) => {
  await mockBrevo(page, { success: false, message: '<strong>Please check your details.</strong>',
    errors: { EMAIL: 'Please check this email.', FIRSTNAME: '<img src=x onerror="window.unsafeBrevo=true">' } });
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please check your details.');
  await expect(page.locator('input[name="EMAIL"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Please check this email.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.unsafeBrevo)).toBeUndefined();
  await expect(page.locator('.santa-message-access img, .santa-message-access strong')).toHaveCount(0);
  await expect(page.locator('input[name="FIRSTNAME"]')).toHaveValue(adult.FIRSTNAME);
  await mockBrevo(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
});

for (const [field, explanation] of [
  ['CHILD_DATE_OF_BIRTH', 'still requires a child’s date of birth'],
  ['ADDITIONAL_PROVIDER_FIELD', 'requires an extra field'],
]) {
  test(`unsupported provider field ${field} explains the settings mismatch without collecting extra data`, async ({ page }) => {
    await mockBrevo(page, { success: false, errors: { [field]: '<img src=x onerror="window.unsafeBrevo=true">Required' } });
    await page.goto('/free-santa-message');
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message' }).click();
    await expect(page.getByRole('alert')).toContainText(explanation);
    await expect(page.getByRole('alert')).toContainText('contact Santa Radio');
    await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
    await expect(page.locator(`input[name="${field}"]`)).toHaveCount(0);
    await expect(page.locator('.santa-message-access img')).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeBrevo)).toBeUndefined();
    for (const [name, value] of Object.entries(adult)) {
      await expect(page.locator(`input[name="${name}"]`)).toHaveValue(value);
    }
    expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeEnabled();
  });
}

test('pending form prevents duplicate submissions and adult details never reach the audio generator', async ({ page }) => {
  let release, calls = 0, generatorFields;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(brevoUrl, async route => {
    calls++;
    await held;
    await route.fulfill({ json: { success: true }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.route('**/api/santa-message', route => {
    generatorFields = route.request().postDataJSON();
    return route.fulfill({ contentType: 'audio/wav', body: readFileSync('server/santa-audio/names/olivia.wav') });
  });
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.locator('.santa-message-access form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(page.getByRole('button', { name: 'Opening the message desk…' })).toBeDisabled();
  await expect(page.locator('input[name="FIRSTNAME"]')).toHaveAttribute('readonly', '');
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
  release();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  await page.getByLabel('Child’s first name').fill('Olivia');
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.locator('.message-result')).toBeVisible();
  expect(generatorFields).toEqual({ name: 'olivia' });
});

test('timeout remains locked, retains details and allows retry without waiting for the provider', async ({ page }) => {
  await page.clock.install();
  const held = new Promise(() => {});
  await page.route(brevoUrl, async () => held);
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByRole('button', { name: 'Opening the message desk…' })).toBeDisabled();
  await page.clock.runFor(ACCESS_REQUEST_TIMEOUT_MS + 100);
  await expect(page.getByRole('alert')).toContainText('took too long');
  await expect(page.locator('input[name="EMAIL"]')).toHaveValue(adult.EMAIL);
  await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
  await mockBrevo(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
});

test('network failure is an explicit locked retry state', async ({ page }) => {
  await page.route(brevoUrl, route => route.abort('failed'));
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByRole('alert')).toContainText('Check your connection');
  await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
  await expect(page.locator('input[name="EMAIL"]')).toHaveValue(adult.EMAIL);
});

test('opaque responses cannot unlock access', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (url, ...args) => {
      if (String(url).includes('.sibforms.com/serve/')) {
        const response = new Response('{"success":true}');
        Object.defineProperty(response, 'type', { value: 'opaque' });
        return Promise.resolve(response);
      }
      return original(url, ...args);
    };
  });
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByRole('alert')).toContainText('couldn’t confirm');
  await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
});

test('blocked session storage uses in-memory accepted access without storing adult details', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await mockBrevo(page);
  await page.goto('/free-santa-message');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  await expect(page.getByText(/Your browser can’t remember access/)).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByLabel('Child’s first name')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
});

test('adult access form fits desktop and phone screens without hiding labels or focus', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/free-santa-message');
    for (const name of ['First name', 'Surname', 'Email address']) {
      const input = page.getByRole('textbox', { name, exact: true });
      await expect(input).toBeVisible();
      await input.focus();
      await expect(input).toBeFocused();
      const box = await input.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
