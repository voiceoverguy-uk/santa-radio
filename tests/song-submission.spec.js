import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { readFileSync } from 'node:fs';
import {
  GENERAL_FORM_URL, SONG_FORM_URL, SONG_REQUEST_TIMEOUT_MS, songCountries, validateSongFields, submitSong,
} from '../src/lib/songSubmission.js';
import { MESSAGE_ACCESS_KEY } from '../src/lib/santaMessageAccess.js';
import { brevoUrl, fillAccessForm, mockBrevo } from './helpers/message-access.js';

const songUrl = `${SONG_FORM_URL}?isAjax=1`;
const generalUrl = `${GENERAL_FORM_URL}?isAjax=1`;
const destination = mode => mode === 'song' ? songUrl : generalUrl;
const details = {
  FIRSTNAME: 'Testartist', LASTNAME: 'Example', EMAIL: 'artist@example.test',
  SONG_REQUEST: 'Test Artist — Christmas Song. https://example.test/listen A festive recording. Santa Radio promotion: https://example.test/promotion',
};

async function mockSong(page, json = { success: true }, status = 200, mode = 'song') {
  await page.route(destination(mode), route => route.fulfill({
    status, json, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
}
async function openForm(page, mode = 'song') {
  await page.goto(mode === 'song' ? '/submit-a-song?mode=song' : '/submit-a-song');
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
}
async function fillSong(page, criteria = true) {
  for (const [name, value] of Object.entries(details)) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  if (criteria) await page.getByRole('checkbox', { name: 'Have you met the criteria?' }).check();
}
function submit(page) {
  return page.getByRole('button', { name: 'Submit song', exact: true }).click();
}
async function outgoing(request) {
  const data = await new Response(request.postDataBuffer(), {
    headers: { 'Content-Type': request.headers()['content-type'] },
  }).formData();
  expect([...data.keys()].sort()).toEqual([
    'EMAIL', 'FIRSTNAME', 'LASTNAME', 'SONG_REQUEST', 'email_address_check', 'locale',
  ]);
  return Object.fromEntries(data);
}

test.beforeEach(async ({ page }) => {
  // The automatic context guard blocks and fails unexpected provider POSTs.
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('latest song action is exact and distinct from unchanged general and Santa access destinations', () => {
  const embed = readFileSync('attached_assets/Song_Suggestion_Form_1793023903195.rtf', 'utf8');
  expect(embed.match(/action="([^"]+)"/)[1]).toBe(SONG_FORM_URL);
  const previous = readFileSync('attached_assets/brevo_form_song_submission_1792592730052.rtf', 'utf8');
  // The older RTF wraps the action in an RTF HYPERLINK field.
  expect(previous.match(/action="[\s\S]*?(https:\/\/[^"}\s]+)/)[1]).toBe(GENERAL_FORM_URL);
  expect(generalUrl).not.toBe(songUrl);
  expect(generalUrl).not.toBe(brevoUrl);
  const textarea = embed.match(/<textarea\b[^>]*>/)[0];
  expect(textarea).toContain('name="SONG_REQUEST"');
  expect(textarea).toContain('maxlength="500"');
  expect(textarea).toContain('placeholder="MESSAGE"');
  expect(textarea).toMatch(/\brequired[ >]/);
  expect(embed).not.toContain('name="MESSAGE"');
  expect(embed).not.toContain('name="COMPANY:name"');
  for (const name of ['FIRSTNAME', 'LASTNAME', 'EMAIL']) {
    expect(embed).toMatch(new RegExp(`<input[^>]*name="${name}"[^>]*\\brequired[ />]`));
  }
  expect(songUrl).not.toBe(brevoUrl);
});

test('historical embed retains the previous mapping and country choices', () => {
  const embed = readFileSync('attached_assets/Pasted--Begin-Brevo-Form-START-We-recommend-to-place-the-below_1791994223545.txt', 'utf8');
  expect(embed).toContain(`action="${GENERAL_FORM_URL}"`);
  // Historical evidence only, not an assertion of the current live contract.
  expect(embed).toContain('name="COMPANY:name"');
  expect(songUrl).not.toBe(brevoUrl);
  const select = embed.match(/<select[^>]*name="SMS__COUNTRY_CODE"[\s\S]*?<\/select>/)[0];
  const choices = [...select.matchAll(/<option value="([^"]+)"[^>]*>\s*\+\d+\s+([A-Z]+)\s*<\/option>/g)]
    .map(match => `${match[2]}:${match[1]}`).sort();
  expect(songCountries.map(({ country, code }) => `${country}:${code}`).sort()).toEqual(choices);
});

test('validation rejects over-limit values even if browser limits are bypassed', () => {
  const fields = { ...details, criteriaMet: true };
  expect(validateSongFields(fields)).toEqual({});
  expect(validateSongFields({ ...fields, FIRSTNAME: 'x'.repeat(201), LASTNAME: 'x'.repeat(201),
    SONG_REQUEST: 'x'.repeat(501) })).toEqual({
    FIRSTNAME: 'Please keep your first name to 200 characters or fewer.',
    LASTNAME: 'Please keep your surname to 200 characters or fewer.',
    SONG_REQUEST: 'Please keep your message to 500 characters or fewer.',
  });
  expect(validateSongFields({ ...fields, criteriaMet: false })).toEqual({
    criteriaMet: 'Please confirm that you have met all five criteria.',
  });
  expect(validateSongFields({ ...fields, criteriaMet: false }, 'general')).toEqual({});
});

test('submission layer rejects missing song criteria and honeypots before any request', async () => {
  await expect(submitSong(details, new AbortController().signal, 'song'))
    .rejects.toMatchObject({ fieldErrors: { criteriaMet: 'Please confirm that you have met all five criteria.' } });
  await expect(submitSong({ ...details, email_address_check: 'bot' }, new AbortController().signal, 'general'))
    .rejects.toThrow('could not be sent');
});

for (const mode of ['general', 'song']) {
  test(`${mode}: required message and 500-character limit match the provider contract`, async ({ page }) => {
    const fields = { ...details, criteriaMet: true };
    for (const SONG_REQUEST of ['', '   ', '\n\t']) {
      expect(validateSongFields({ ...fields, SONG_REQUEST }, mode)).toEqual({
        SONG_REQUEST: 'Please enter your message.',
      });
      await expect(submitSong({ ...fields, SONG_REQUEST }, new AbortController().signal, mode))
        .rejects.toMatchObject({ fieldErrors: { SONG_REQUEST: 'Please enter your message.' } });
    }
    expect(validateSongFields({ ...fields, SONG_REQUEST: 'x'.repeat(501) }, mode)).toEqual({
      SONG_REQUEST: 'Please keep your message to 500 characters or fewer.',
    });
    let requests = 0;
    page.on('request', request => { if (request.url().includes('.sibforms.com/')) requests++; });
    await openForm(page, mode);
    await fillSong(page, mode === 'song');
    const message = page.locator('[name="SONG_REQUEST"]');
    await expect(message).toHaveAttribute('required', '');
    await expect(message).toHaveAttribute('maxlength', '500');
    await expect(page.locator('[name="COMPANY:name"]')).toHaveCount(0);
    await expect(page.locator('[name="MESSAGE"]')).toHaveCount(0);
    await message.fill('   ');
    await expect(page.locator('#song-message-count')).toHaveText('3 / 500 characters');
    await page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true }).click();
    await expect(message).toBeFocused();
    await expect(page.locator('#song-SONG_REQUEST-error')).toHaveText('Please enter your message.');
    await message.fill('Draft');
    await expect(message).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#song-message-count')).toHaveText('5 / 500 characters');
    await message.evaluate(el => el.removeAttribute('maxlength'));
    await message.fill('x'.repeat(501));
    await page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true }).click();
    await expect(message).toBeFocused();
    await expect(page.locator('#song-SONG_REQUEST-error')).toHaveText('Please keep your message to 500 characters or fewer.');
    await expect(message).toHaveValue('x'.repeat(501));
    expect(requests).toBe(0);
  });
}

for (const path of ['/submit-a-song', '/submit-a-song?mode=invalid', '/submit-a-song?mode=general']) {
  test(`general enquiry defaults correctly at ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('group', { name: 'What are you contacting us about?' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Song submission' })).not.toBeChecked();
    await expect(page.locator('main').getByRole('checkbox')).toHaveCount(0);
    await expect(page.locator('.song-requirements')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('airplay');
    await expect(page.locator('#song-message-help')).not.toContainText('artist name');
    await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Contact Santa Radio | General Enquiries & Song Submissions');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/submit-a-song');
  });
}

test('general enquiry accepts without criteria using the exact provider fields and no access grant', async ({ page }) => {
  let payload;
  await page.route(generalUrl, async route => {
    payload = await outgoing(route.request());
    await route.fulfill({ json: { success: true } });
  });
  await openForm(page, 'general');
  await fillSong(page, false);
  for (const name of ['FIRSTNAME', 'LASTNAME', 'EMAIL']) {
    await page.locator(`[name="${name}"]`).fill(`  ${details[name]}  `);
  }
  await page.getByLabel('Message', { exact: false }).fill('  A general press enquiry.\nPlease keep this second line.  ');
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for your enquiry' })).toBeVisible();
  // Multipart FormData normalises textarea line breaks to CRLF on the wire.
  expect(payload).toEqual({ ...details, SONG_REQUEST: 'A general press enquiry.\r\nPlease keep this second line.', email_address_check: '', locale: 'en' });
  expect(payload).not.toHaveProperty('COMPANY:name');
  await expect(page.locator('.song-form-success')).toBeFocused();
  await expect(page.locator('main')).not.toContainText('airplay');
  await expect(page.locator('.song-form-success')).toContainText('does not confirm delivery to our inbox');
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
});

test('mode switching retains drafts, clears stale errors and requires fresh criteria even through history', async ({ page }) => {
  await openForm(page);
  await fillSong(page);
  await page.getByLabel('Email address').fill('invalid');
  await submit(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('radio', { name: 'General enquiry' }).check();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toHaveValue('invalid');
  await expect(page.getByLabel('Message', { exact: false })).toHaveValue(details.SONG_REQUEST);
  await page.goBack();
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Have you met the criteria?' })).not.toBeChecked();
  await page.getByLabel('Email address').fill(details.EMAIL);
  await submit(page);
  await expect(page.locator('#song-criteriaMet-error')).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeChecked();
  await expect(page.locator('#song-criteriaMet-error')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Song submission' }).check();
  await expect(page.getByRole('checkbox', { name: 'Have you met the criteria?' })).not.toBeChecked();
});

test('required errors, email validation and message guidance are accessible', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (request.url().includes('sibforms.com/serve/')) requests++; });
  await openForm(page);
  await submit(page);
  await expect(page.getByRole('alert')).toHaveText('Please check the highlighted details.');
  await expect(page.getByLabel('First name', { exact: false })).toBeFocused();
  for (const name of Object.keys(details)) {
    const input = page.locator(`[name="${name}"]`);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(await input.getAttribute('aria-describedby')).toBeTruthy();
  }
  await fillSong(page);
  await page.getByLabel('Email address').fill('not-an-email');
  await submit(page);
  await expect(page.getByLabel('Email address')).toBeFocused();
  await expect(page.locator('#song-EMAIL-error')).toContainText('valid email');
  await expect(page.locator('#song-message-help')).toContainText('artist name, song title, a listening link');
  const checklist = page.getByRole('region', { name: 'Before you send your song' });
  await expect(checklist).toContainText('all five items');
  await expect(checklist.getByRole('listitem')).toHaveText([
    'Artist name', 'Song title',
    'A link to the song (YouTube, SoundCloud, Spotify etc.)',
    'A short bio or description',
    'A link to any promotion of Santa Radio',
  ]);
  await expect(checklist).toContainText('within 500 characters');
  await expect(checklist).toContainText('both your listening and promotion links work');
  expect(await checklist.evaluate(section =>
    Boolean(section.compareDocumentPosition(document.querySelector('.song-submission-form')) & Node.DOCUMENT_POSITION_FOLLOWING),
  )).toBe(true);
  await expect(page.locator('[name="FIRSTNAME"]')).toHaveAttribute('autocomplete', 'given-name');
  await expect(page.locator('[name="LASTNAME"]')).toHaveAttribute('autocomplete', 'family-name');
  await expect(page.locator('[name="EMAIL"]')).toHaveAttribute('autocomplete', 'email');
  expect(requests).toBe(0);
});

test('name and message limits hold and whitespace-only fields cannot submit', async ({ page }) => {
  await openForm(page);
  await page.getByLabel('First name').fill('a'.repeat(201));
  await expect(page.getByLabel('First name')).toHaveValue('a'.repeat(200));
  await page.getByLabel('Surname').fill('b'.repeat(201));
  await expect(page.getByLabel('Surname')).toHaveValue('b'.repeat(200));
  await page.getByLabel('Message', { exact: false }).fill('m'.repeat(501));
  await expect(page.locator('[name="SONG_REQUEST"]')).toHaveValue('m'.repeat(500));
  await expect(page.locator('#song-message-count')).toHaveText('500 / 500 characters');
  await page.getByLabel('First name').fill('   ');
  await submit(page);
  await expect(page.locator('#song-FIRSTNAME-error')).toHaveText('Please enter your first name.');
});

test('explicit acceptance sends only exact fields, stays on site and grants no message access', async ({ page }) => {
  let payload;
  await page.route(songUrl, async route => {
    payload = await outgoing(route.request());
    await route.fulfill({ json: { success: true, redirect: 'https://untrusted.example.test/' } });
  });
  await openForm(page);
  await fillSong(page);
  for (const [name, value] of Object.entries(details)) {
    await page.locator(`[name="${name}"]`).fill(`  ${value}  `);
  }
  await submit(page);
  await expect(page.getByRole('heading', { name: 'Thank you for your song submission' })).toBeVisible();
  expect(payload).toEqual({
    ...details, email_address_check: '', locale: 'en',
  });
  expect(payload).not.toHaveProperty('COMPANY:name');
  await expect(page).toHaveURL(/\/submit-a-song\?mode=song$/);
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeNull();
  await expect(page.locator('.song-form-success')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Submit song', exact: true })).toHaveCount(0);
  await expect(page.locator('main')).toContainText('not a promise of airplay or a reply');
});

test('phone fields are removed and promotion link is included in the message sent to Brevo', async ({ page }) => {
  let payload;
  await page.route(songUrl, async route => {
    payload = await outgoing(route.request());
    await route.fulfill({ json: { success: true } });
  });
  await openForm(page);
  await fillSong(page);
  await expect(page.getByLabel('Country code')).toHaveCount(0);
  await expect(page.getByLabel('Phone number (optional)')).toHaveCount(0);
  await expect(page.locator('.song-privacy').first()).not.toContainText('phone');
  await submit(page);
  await expect(page.locator('.song-form-success')).toBeVisible();
  expect(payload).not.toHaveProperty('SMS');
  expect(payload).not.toHaveProperty('SMS__COUNTRY_CODE');
  expect(payload).not.toHaveProperty('criteriaMet');
  expect(payload.SONG_REQUEST).toContain('https://example.test/promotion');
});

test('criteria must be confirmed and honeypot cannot masquerade as success', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (request.url() === songUrl) requests++; });
  await openForm(page);
  await fillSong(page);
  const confirmation = page.getByRole('checkbox', { name: 'Have you met the criteria?' });
  await confirmation.uncheck();
  await submit(page);
  await expect(page.locator('#song-criteriaMet-error')).toContainText('all five criteria');
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toBe(0);
  await confirmation.check();
  await page.locator('[name="email_address_check"]').evaluate(el => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, 'bot value');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('could not be sent');
  expect(requests).toBe(0);
});

for (const [label, json, status] of [
  ['rejection', { success: false, message: 'Provider rejected this submission.' }, 200],
  ['truthy string', { success: 'true' }, 200],
  ['missing success', { redirect: 'https://untrusted.example.test' }, 200],
  ['HTTP failure despite success flag', { success: true }, 500],
  ['null JSON', null, 200],
]) {
  for (const mode of ['general', 'song']) {
  test(`${mode}: ${label} retains every entry for retry without confirmation`, async ({ page }) => {
    await mockSong(page, json, status, mode);
    await openForm(page, mode);
    await fillSong(page, mode === 'song');
    await page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.song-form-success')).toHaveCount(0);
    for (const [name, value] of Object.entries(details)) {
      await expect(page.locator(`[name="${name}"]`)).toHaveValue(value);
    }
    if (mode === 'song') await expect(page.getByRole('checkbox', { name: 'Have you met the criteria?' })).toBeChecked();
    await expect(page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true })).toBeEnabled();
  });
  }
}

test('general pending request locks modes and duplicate sends; timeout keeps the draft', async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await page.route(generalUrl, () => { requests++; });
  await openForm(page, 'general');
  await fillSong(page, false);
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sending your enquiry…' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeDisabled();
  await expect(page.getByLabel('Message', { exact: false })).toHaveAttribute('readonly', '');
  await page.locator('.song-submission-form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  expect(requests).toBe(1);
  await page.clock.runFor(SONG_REQUEST_TIMEOUT_MS + 100);
  await expect(page.getByRole('alert')).toContainText('took too long');
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeEnabled();
  await expect(page.getByLabel('Email address')).toHaveValue(details.EMAIL);
  await mockSong(page, { success: true }, 200, 'general');
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for your enquiry' })).toBeVisible();
});

test('history changes cannot switch the displayed mode during an active request', async ({ page }) => {
  let release;
  let submitted;
  await page.route(songUrl, async route => {
    submitted = route.request();
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { success: false } });
  });
  await openForm(page, 'general');
  await page.getByRole('radio', { name: 'Song submission' }).check();
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeChecked();
  await fillSong(page);
  await submit(page);
  await expect(page.locator('.song-pending')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/submit-a-song$/);
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeDisabled();
  expect(submitted.url()).toBe(songUrl);
  expect(await outgoing(submitted)).toEqual({ ...details, email_address_check: '', locale: 'en' });
  release();
  await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeChecked();
  await expect(page.getByLabel('Email address')).toHaveValue(details.EMAIL);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const mode of ['general', 'song']) {
  test(`${mode}: history during pending acceptance preserves the submitted confirmation`, async ({ page }) => {
    let release;
    let requests = 0;
    await page.route(destination(mode), async route => {
      expect(route.request().url()).toBe(destination(mode));
      expect(await outgoing(route.request())).toEqual({ ...details, email_address_check: '', locale: 'en' });
      requests++;
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ json: { success: true } });
    });
    await openForm(page, mode === 'song' ? 'general' : 'song');
    await page.getByRole('radio', { name: mode === 'song' ? 'Song submission' : 'General enquiry' }).check();
    await fillSong(page, mode === 'song');
    await page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true }).click();
    await expect(page.locator('.song-pending')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('radio', { name: mode === 'song' ? 'Song submission' : 'General enquiry' })).toBeChecked();
    release();
    await expect(page.getByRole('heading', { name: mode === 'song' ? 'Thank you for your song submission' : 'Thank you for your enquiry' })).toBeVisible();
    await expect(page.locator('.song-form-success')).toBeFocused();
    await expect(page.locator('.song-submission-form')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Submit song|Send enquiry)$/ })).toHaveCount(0);
    expect(requests).toBe(1);
    // A new, intentional navigation after acceptance can open a fresh form.
    await page.goForward();
    await expect(page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true })).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveValue('');
  });
}

test('malformed HTML cannot confirm submission', async ({ page }) => {
  await page.route(songUrl, route => route.fulfill({
    contentType: 'text/html', body: '<h1>Success</h1>',
  }));
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('unexpected response');
  await expect(page.locator('[name="SONG_REQUEST"]')).toHaveValue(details.SONG_REQUEST);
  await expect(page.locator('.song-form-success')).toHaveCount(0);
});

test('opaque response cannot confirm submission', async ({ page }) => {
  await page.addInitScript(url => {
    const original = window.fetch;
    window.fetch = (input, options) => input === url
      ? Promise.resolve({ ok: true, type: 'opaque', json: async () => ({ success: true }) })
      : original(input, options);
  }, songUrl);
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.song-form-success')).toHaveCount(0);
});

for (const mode of ['general', 'song']) {
test(`${mode}: SONG_REQUEST provider errors render safely and successful retry sends retained fields`, async ({ page }) => {
  await mockSong(page, { success: false,
    message: '<img src=x onerror="window.injected=true">Please review your details.',
    errors: {
      SONG_REQUEST: '<script>window.injected=true</script>Message needs a link.',
    },
  }, 200, mode);
  await openForm(page, mode);
  await fillSong(page, mode === 'song');
  const button = page.getByRole('button', { name: mode === 'song' ? 'Submit song' : 'Send enquiry', exact: true });
  await button.click();
  await expect(page.locator('#song-SONG_REQUEST-error')).toContainText('Message needs a link.');
  await expect(page.locator('[name="SONG_REQUEST"]')).toBeFocused();
  await expect(page.locator('[name="SONG_REQUEST"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[name="SONG_REQUEST"]')).toHaveAttribute('aria-describedby', /song-SONG_REQUEST-error/);
  await expect(page.getByRole('alert')).toHaveText('Please review your details.');
  for (const [name, value] of Object.entries(details)) {
    await expect(page.locator(`[name="${name}"]`)).toHaveValue(value);
  }
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('.song-form-alert img, .song-field-error script, .song-field-error b')).toHaveCount(0);
  let payload;
  await page.route(destination(mode), async route => {
    payload = await outgoing(route.request());
    await route.fulfill({ json: { success: true } });
  });
  await button.click();
  await expect(page.locator('.song-form-success')).toBeVisible();
  expect(payload).toEqual({ ...details, email_address_check: '', locale: 'en' });
  expect(payload).not.toHaveProperty('COMPANY:name');
});
}

test('unexpected required provider fields report the exact configuration problem', async ({ page }) => {
  await mockSong(page, { success: false, errors: { EXTRA_REQUIRED: 'Required' } });
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('EXTRA_REQUIRED');
  await expect(page.getByRole('alert')).toContainText('check the form settings');
  await expect(page.locator('[name="EXTRA_REQUIRED"]')).toHaveCount(0);
});

test('pending state prevents duplicate submissions and editing', async ({ page }) => {
  let requests = 0;
  let release;
  await page.route(songUrl, async route => {
    requests++;
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { success: false } });
  });
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.getByRole('button', { name: 'Submitting your song…' })).toBeDisabled();
  await expect(page.locator('.song-pending')).toBeVisible();
  await expect(page.locator('[name="SONG_REQUEST"]')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('checkbox', { name: 'Have you met the criteria?' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeDisabled();
  await page.locator('form.song-submission-form').evaluate(form => {
    form.requestSubmit(); form.requestSubmit();
  });
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('network failure is an explicit retry state', async ({ page }) => {
  await page.route(songUrl, route => route.abort('failed'));
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('Check your connection');
  await expect(page.locator('[name="SONG_REQUEST"]')).toHaveValue(details.SONG_REQUEST);
});

test('timeout aborts the request, retains entries and allows retry', async ({ page }) => {
  await page.clock.install();
  await page.route(songUrl, () => {});
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.locator('.song-pending')).toBeVisible();
  await page.clock.runFor(SONG_REQUEST_TIMEOUT_MS + 100);
  await expect(page.getByRole('alert')).toContainText('took too long');
  await expect(page.locator('[name="EMAIL"]')).toHaveValue(details.EMAIL);
  await mockSong(page);
  await submit(page);
  await expect(page.locator('.song-form-success')).toBeVisible();
});

test('HTTP redirects are not followed or treated as acceptance', async ({ page }) => {
  let redirected = false;
  await page.route('https://untrusted.example.test/**', route => { redirected = true; return route.abort(); });
  await page.route(songUrl, route => route.fulfill({
    status: 302, headers: { Location: 'https://untrusted.example.test/' },
  }));
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(redirected).toBe(false);
  await expect(page).toHaveURL(/\/submit-a-song\?mode=song$/);
});

test('navigation cancels in-flight submission and back opens a fresh form without saved contacts', async ({ page }) => {
  let heldRoute;
  await page.route(songUrl, route => { heldRoute = route; });
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.locator('.song-pending')).toBeVisible();
  await page.locator('footer a[href="/privacy-policy"]').click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  // Router transitions may update the address before committing the new page.
  // Wait for unmount (and its abort) before releasing the provider response.
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  await expect(page.locator('.song-pending')).toHaveCount(0);
  await heldRoute.fulfill({ json: { success: true } }).catch(() => {});
  await page.goBack();
  await expect(page.getByLabel('First name')).toHaveValue('');
  await expect(page.locator('.song-form-success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit song', exact: true })).toBeEnabled();
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
  expect(storage).not.toContain(details.EMAIL);
  expect(storage).not.toContain(details.SONG_REQUEST);
});

test('home, music and footer links select the correct shared form mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get in touch', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeChecked();
  await page.goto('/christmas-music');
  await page.locator('footer').getByRole('link', { name: 'Submit your song', exact: true }).click();
  await expect(page).toHaveURL(/\/submit-a-song\?mode=song$/);
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeChecked();
  await expect(page.getByLabel('First name')).toBeVisible();
  await page.locator('footer a[href="/privacy-policy"]').click();
  await expect(page.getByRole('heading', { name: 'Song submissions', exact: true })).toBeVisible();
  await expect(page.locator('article')).toContainText('a link to any promotion of Santa Radio');
  await expect(page.locator('article')).not.toContainText('phone number and country code, but these are optional');
  await expect(page.locator('article')).toContainText('do not open the message maker or give consent for marketing');
  await page.locator('footer').getByRole('link', { name: 'Submit your song', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: false })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('songs@santaradio.co.uk');
  await expect(page.getByRole('radio', { name: 'Song submission' })).toBeChecked();
  await expect(page.locator('.song-privacy')).toContainText('Brevo');
});

test('song submission does not alter the independent Santa-message access flow', async ({ page }) => {
  await mockSong(page);
  await mockBrevo(page);
  await openForm(page);
  await fillSong(page);
  await submit(page);
  await expect(page.locator('.song-form-success')).toBeVisible();
  await page.goto('/free-santa-message');
  await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key), MESSAGE_ACCESS_KEY)).toBeTruthy();
});

for (const width of [320, 390, 1280]) {
  test(`general form keyboard path fits ${width}px and clears the fixed dock`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await openForm(page, 'general');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('First name')).toBeFocused();
    for (const label of ['Surname', 'Email address', 'Message']) {
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(label, { exact: false })).toBeFocused();
    }
    await page.keyboard.press('Tab'); // Privacy link, no song criteria in this mode.
    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Send enquiry', exact: true });
    await expect(button).toBeFocused();
    await expect.poll(() => button.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      const dock = document.querySelector('.radio-dock').getBoundingClientRect();
      return bounds.top >= 100 && bounds.bottom <= dock.top;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mockSong(page, { success: true }, 200, 'general');
    await fillSong(page, false);
    await button.click();
    await expect(page.getByRole('heading', { name: 'Thank you for your enquiry' })).toBeVisible();
  });

  test(`form fits ${width}px, keyboard focus and controls avoid the fixed radio`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await openForm(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#page-content')).toBeFocused();
    // Real keyboard navigation, not programmatic focus-visible approximation.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Song submission' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'General enquiry' })).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Song submission' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('First name')).toBeFocused();
    for (const label of ['Surname', 'Email address', 'Message']) {
      await page.keyboard.press('Tab');
      const control = page.getByLabel(label, { exact: false });
      await expect(control).toBeFocused();
      expect(await control.evaluate(el => el.matches(':focus-visible'))).toBe(true);
      expect(await control.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      await expect.poll(() => control.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        const dock = document.querySelector('.radio-dock').getBoundingClientRect();
        return bounds.top >= 100 && (bounds.right <= dock.left || bounds.left >= dock.right || bounds.bottom <= dock.top);
      })).toBe(true);
    }
    await page.keyboard.press('Tab');
    const confirmation = page.getByRole('checkbox', { name: 'Have you met the criteria?' });
    await expect(confirmation).toBeFocused();
    await page.keyboard.press('Space');
    await expect(confirmation).toBeChecked();
    await page.keyboard.press('Tab'); // Privacy link.
    await page.keyboard.press('Tab'); // Submit.
    const button = page.getByRole('button', { name: 'Submit song', exact: true });
    await expect(button).toBeFocused();
    await expect.poll(() => button.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return bounds.bottom <= document.querySelector('.radio-dock').getBoundingClientRect().top;
    })).toBe(true);
    await fillSong(page);
    await mockSong(page);
    await submit(page);
    await expect(page.locator('.song-form-success')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
