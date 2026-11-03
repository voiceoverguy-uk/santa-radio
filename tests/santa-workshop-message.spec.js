import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { confirmMessage, mockStudioGeneration, emptyGeneration } from './helpers/studio-generation.js';
import { SCHOOL_TEST_START, SCHOOL_TEST_DEADLINE } from '../server/santa-workshop-settings.js';

const path = '/santa-message-workshop';
const answers = ['9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'The Enchanted Forest'];
const preparationMessages = [
  'Santa is recording. Give him a moment — the elves keep distracting him.',
  'Santa is busy recording, although the smell of cookies isn’t helping. Hang on a moment…',
  'Santa is recording your message. An elf just sneezed halfway through, so we’re going again.',
  'Santa is at the microphone. We’re just waiting for Rudolph to stop chewing.',
  'Your message is coming. Santa said “ho ho ho” so loudly, his headphones fell off.',
  'Santa is recording. The elves have promised to be quiet. We’ll believe it when we hear it.',
  'One moment — Santa is finishing your message. Someone opened a biscuit tin and we lost him briefly.',
  'Santa is recording your message. Mrs Claus has reminded him this is not the time for a nap.',
  'Hang on a moment — Santa’s checking his lines. Twice, obviously.',
  'Santa is busy recording. We’ve hidden the mince pies until he’s finished.',
];

test('authorised Studio can check its actual access without generation records', async ({ page }) => {
  await unlockWorkshop(page);
  const response = await page.request.get('/api/santa-studio-message');
  expect(response.status(), await response.text()).toBe(200);
  expect(await response.json()).toMatchObject({ temporary: true });
});

test('Vercel missing-generation-table conditions keep voucher validation and permit temporary creation', async ({ page, browser, baseURL }) => {
  test.skip(process.env.STUDIO_TEST_MISSING_TABLES !== 'generation-and-reporting',
    'Runs only with the isolated missing-table preload, without changing real schema.');
  test.setTimeout(90000);
  const origin = new URL(baseURL).origin;
  const anonymous = await browser.newContext();
  try {
    const invalid = await anonymous.request.post(`${origin}/api/santa-workshop-access`, {
      headers: { Origin: origin }, data: { code: 'invalid-isolated-test-code' },
    });
    expect(invalid.status()).toBe(401);
    expect(invalid.headers()['set-cookie']).toBeUndefined();
    expect((await anonymous.request.get(`${origin}/api/santa-studio-message`)).status()).toBe(403);
  } finally { await anonymous.close(); }
  await openReview(page, { live: true, school: true });
  const status = await page.request.get('/api/santa-studio-message');
  expect(status.status()).toBe(200);
  expect(await status.json()).toMatchObject({ temporary: true });
  await expect(page.locator('.smw-allowance')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download MP3', exact: true })).toHaveCount(0);
});

async function openReview(page, { live = false, allowance = null, tester = false, school = false } = {}) {
  const generation = live ? null : await mockStudioGeneration(page, { tester });
  if (!live) await page.route('**/api/santa-studio-message', route => route.request().method() === 'GET'
    ? allowance ? allowance(route, generation.state) : route.fulfill({ json: generation.state }) : route.fallback());
  if (!school) await unlockWorkshop(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  if (!live) {
    await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
    await page.route('**/api/santa-names', route => route.fulfill({ json: { records: [
      { id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2', selectionToken: 'expired-token',
        previewUrl: '/api/santa-name-preview?token=expired-token' },
    ] } }));
    await page.route('**/api/santa-name-preview?*', route => route.fulfill({
      contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
    }));
  }
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
  if (school) {
    await page.getByLabel('Tester code (required)', { exact: true }).fill(process.env.WORKSHOP_TEST_CODE_6);
    await page.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  }
  const checkPlaceholder = async input => {
    const colours = await input.evaluate(node => ({
      placeholder: getComputedStyle(node, '::placeholder').color,
      text: getComputedStyle(node).color,
      opacity: getComputedStyle(node, '::placeholder').opacity,
    }));
    expect(colours.placeholder).toBe('rgb(138, 138, 138)');
    expect(colours.opacity).toBe('1');
    expect(colours.placeholder).not.toBe(colours.text);
  };
  await checkPlaceholder(page.getByRole('combobox', { name: 'Search recorded names', exact: true }));
  await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill(live ? 'Arabella' : 'Dixie');
  const nameOption = page.getByRole('option', { name: live ? /^Arabella/ : /Dixie/ }).first();
  await expect(nameOption).toBeVisible({ timeout: 15000 });
  await nameOption.click();
  await page.locator('.smw-button-next').click();
  for (const answer of answers) {
    if (answer === 'The Enchanted Forest') await page.getByRole('button', { name: 'Fantasy & space', exact: true }).click();
    if (await page.getByRole('button', { name: 'Skip this section', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Skip this section', exact: true }).click();
    }
    const search = page.getByRole('searchbox');
    if (await search.count()) await checkPlaceholder(search);
    const option = page.getByRole('option', { name: answer, exact: true });
    await option.scrollIntoViewIfNeeded();
    await option.click();
    await page.locator('.smw-button-next').click();
  }
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeVisible();
  return generation;
}

test('top Return to review button fits its label on one line', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
  const button = page.getByRole('button', { name: 'Return to review from top', exact: true });
  for (const width of [320, 390, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(button).toBeVisible();
    const fits = await button.evaluate(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const bounds = node.getBoundingClientRect();
      return getComputedStyle(node).whiteSpace === 'nowrap'
        && range.getBoundingClientRect().height < 25
        && node.scrollWidth <= node.clientWidth
        && bounds.right <= innerWidth;
    });
    expect(fits).toBe(true);
  }
  await button.click();
  await expect(page.locator('.smw-summary')).toBeVisible();
});

for (const width of [390, 1365]) {
  test(`voucher entitlement remains clear during recording-service failure at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/santa-workshop-access', async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const data = await response.json();
      return route.fulfill({ response, json: { ...data,
        voucher: { code: 'preview-voucher-example', unlimited: true } } });
    });
    await openReview(page, { tester: true });
    const notice = page.locator('.smw-voucher-entitlement');
    await expect(notice).toContainText('You used Voucher Code: preview-voucher-example.');
    await expect(notice).toContainText('request limits');
    await expect(page.locator('.smw-allowance')).toHaveCount(0);
    await expect(page.locator('.smw-allowance').filter({
      hasText: 'You can create one message, then make one correction.',
    })).toHaveCount(0);
    await page.route('**/api/santa-studio-message', route => route.request().method() === 'GET'
      ? route.fulfill({ status: 503, json: { error: 'Temporary recording-service failure' } })
      : route.fallback());
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('alert')).toContainText('Your voucher is recognised');
    await expect(page.getByRole('alert')).toContainText('Your unlimited-message access has not changed.');
    await expect(notice).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('.smw-actions--review').screenshot({
      path: `generated-artifacts/studio-voucher-notice-${width}.png`, animations: 'disabled',
    });
    await page.unroute('**/api/santa-studio-message');
    await page.getByRole('button', { name: 'Retry recording check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.smw-allowance')).toHaveCount(0);
    await page.reload();
    await openReview(page, { tester: true });
    await expect(notice).toContainText('You used Voucher Code: preview-voucher-example.');
    await expect(notice).toContainText('request limits');
  });
}

test('voucher testing can generate a third message with fresh choices while retaining previous downloads', async ({ page }) => {
  test.setTimeout(60000);
  const fixture = await openReview(page, { tester: true });
  for (let number = 1; number <= 3; number++) {
    await confirmMessage(page);
    await expect(page.getByRole('link', { name: 'Download MP3', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
    expect(fixture.posts.length).toBe(number);
    if (number === 3) break;
    const previousUrl = await page.getByRole('link', { name: 'Download MP3', exact: true }).getAttribute('href');
    expect(await page.getByRole('link', { name: 'Download MP3', exact: true }).getAttribute('href')).toBe(previousUrl);
    await page.getByRole('button', { name: 'Change Their recorded name', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Return to review', exact: true }).click();
    await page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Countries & real places', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  }
  expect(fixture.recoveries || 0).toBe(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
});

for (const width of [390, 1365]) {
  test(`review Start Again returns to the first step without losing the recording or allowance at ${width}px`, async ({ page }) => {
    const fixture = await openReview(page);
    await page.setViewportSize({ width, height: 900 });
    await confirmMessage(page);
    const download = page.getByRole('link', { name: 'Download MP3', exact: true });
    await expect(download).toBeVisible();
    const previousUrl = await download.getAttribute('href');
    const allowance = structuredClone(fixture.state);
    await page.getByRole('button', { name: 'Start Again', exact: true }).click();
    await expect(page.locator('.smw-step-count')).toHaveText('Step 1 of 7');
    await expect(page.getByRole('heading', { name: 'What name should Santa say?', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toBeEnabled();
    for (let step = 1; step <= 7; step++) {
      await expect(page.locator('.smw-step-count')).toHaveText(`Step ${step} of 7`);
      if (step > 1) await expect(page.locator('.smw-actions:not([hidden])').getByRole('button', { name: 'Back', exact: true })).toBeVisible();
      await page.locator('.smw-button-next:visible').click();
    }
    await expect(page.locator('.smw-summary')).toBeVisible();
    await expect(download).toHaveAttribute('href', previousUrl);
    expect(fixture.state).toEqual(allowance);
    expect(fixture.posts).toHaveLength(1);
    await expect(page.getByRole('button', { name: 'Start Again', exact: true })).toBeVisible();
  });
}

test('voucher recording check failure retains entitlement and recovers on return to the page', async ({ page }) => {
  let healthy = false;
  const fixture = await openReview(page, { allowance: (route, state) => healthy
    ? route.fulfill({ json: state })
    : route.fulfill({ status: 503, json: { error: 'Service unavailable.' } }) });
  const allowance = page.locator('.smw-allowance');
  await expect(allowance).toContainText('Your voucher is recognised, but Santa’s recording service is temporarily unavailable.');
  await expect(page.locator('.smw-voucher-entitlement')).toContainText('subject to request limits');
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
  for (const width of [1365, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    const back = await page.locator('.smw-actions:not([hidden])').getByRole('button', { name: 'Start Again', exact: true }).boundingBox();
    const create = await page.getByRole('button', { name: 'Create message', exact: true }).boundingBox();
    expect(Math.abs(back.y + back.height / 2 - create.y - create.height / 2)).toBeLessThanOrEqual(1);
    expect(create.x).toBeGreaterThanOrEqual(back.x + back.width);
    expect(create.x + create.width).toBeLessThanOrEqual(width);
    expect(await allowance.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry recording check', exact: true })).toBeVisible();
  healthy = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(fixture.posts).toHaveLength(0);
});

test('temporary allowance failure recovers automatically without spending a message', async ({ page }) => {
  let checks = 0;
  const fixture = await openReview(page, { allowance: (route, state) => ++checks === 1
    ? route.fulfill({ status: 503, json: { error: 'Server restarting.' } })
    : route.fulfill({ json: state }) });
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled({ timeout: 10000 });
  expect(checks).toBeGreaterThan(1);
  expect(fixture.posts).toHaveLength(0);
});

test('expired access explains how to reopen Studio instead of endlessly checking', async ({ page }) => {
  await openReview(page, { allowance: route => route.fulfill({ status: 403, json: { error: 'Access expired.' } }) });
  await expect(page.locator('.smw-allowance')).not.toContainText('Checking');
  await expect(page.getByRole('alert')).toContainText('enter your access code again');
  await expect(page.getByRole('button', { name: 'Reload Studio', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
});

test('a stalled allowance request times out rather than leaving Checking indefinitely', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, options) => url === '/api/santa-studio-message' && !options?.method
      ? new Promise((resolve, reject) => options.signal.addEventListener('abort',
        () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
      : original(url, options);
  });
  await openReview(page);
  await expect(page.getByRole('alert')).toContainText('could not connect', { timeout: 15000 });
  await expect(page.locator('.smw-allowance')).not.toContainText('Checking');
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
});

test('approved recording notices are random per attempt, stable through rerenders, and wrap on phones', async ({ page }) => {
  test.setTimeout(90000);
  // Fail closed if this test ever accidentally stops intercepting creation.
  await page.route('**/api/santa-studio-message', route => route.abort());
  await openReview(page);
  await page.evaluate(() => {
    const fetch = window.fetch.bind(window);
    window.recordingAttempts = [];
    window.fetch = (input, options) => {
      if (input !== '/api/santa-studio-message' || options?.method !== 'POST') return fetch(input, options);
      return new Promise((resolve, reject) => {
        const attempt = { resolve };
        window.recordingAttempts.push(attempt);
        options.signal.addEventListener('abort', () => {
          attempt.aborted = true;
          attempt.stream?.error(new DOMException('Cancelled', 'AbortError'));
          reject(new DOMException('Cancelled', 'AbortError'));
        }, { once: true });
      });
    };
    const random = Math.random;
    window.noticeRandomCalls = 0;
    Math.random = () => {
      if (window.nextNoticeRandom === undefined) return random();
      window.noticeRandomCalls++;
      const value = window.nextNoticeRandom;
      delete window.nextNoticeRandom;
      return value;
    };
  });
  const notice = page.locator('.smw-message-result[role="status"]');
  const paragraph = notice.locator('p');
  const start = async (index, retry = false) => {
    // Exercise both ends of the random range as well as every middle bucket.
    await page.evaluate(value => { window.nextNoticeRandom = value; },
      index === 0 ? 0 : index === 9 ? 0.999999 : (index + 0.5) / 10);
    await confirmMessage(page, retry ? 'Retry message' : 'Create message');
    await expect(paragraph).toHaveText(preparationMessages[index]);
    await expect(notice).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('button', { name: 'Preparing message…', exact: true })).toBeDisabled();
    await expect(page.getByRole('progressbar', { name: 'Preparing your message' })).toBeVisible();
  };
  const cancel = async () => {
    await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
    await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
    expect(await page.evaluate(() => window.recordingAttempts.at(-1).aborted)).toBe(true);
  };
  for (let index = 0; index < preparationMessages.length; index++) {
    await start(index);
    if (index === 6) {
      // A spelling update changes parent props without changing audio choices.
      await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
      await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('D’Arcy');
      await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await paragraph.scrollIntoViewIfNeeded();
        await expect(paragraph).toHaveText(preparationMessages[index]);
        const geometry = await paragraph.evaluate(node => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const bounds = node.getBoundingClientRect();
          const lines = [...range.getClientRects()];
          return {
            wraps: lines.length > 1,
            fits: lines.every(line => line.left >= bounds.left - 1 && line.right <= bounds.right + 1 &&
              line.top >= bounds.top - 1 && line.bottom <= bounds.bottom + 1),
            noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
          };
        });
        expect(geometry).toEqual({ wraps: true, fits: true, noOverflow: true });
      }
      await page.screenshot({ path: 'generated-artifacts/studio-recording-notice-mobile.png' });
      // A delayed request must not rotate the copy on a timer either.
      await page.clock.install();
      await page.clock.runFor(10000);
      await expect(paragraph).toHaveText(preparationMessages[index]);
      await page.clock.resume();
    }
    await cancel();
  }
  // Repeats are allowed, and errors still offer a fresh choice on retry.
  await start(9);
  await page.evaluate(() => window.recordingAttempts.at(-1).resolve(
    new Response(JSON.stringify({ error: 'Recording temporarily unavailable.' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    }),
  ));
  await expect(page.getByRole('alert')).toHaveText('Recording temporarily unavailable.');
  await expect(notice).toHaveCount(0);
  await start(2, true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => {
    const attempt = window.recordingAttempts.at(-1);
    attempt.resolve(new Response(new ReadableStream({
      start(controller) { attempt.stream = controller; },
    }), { headers: { 'Content-Type': 'audio/mpeg' } }));
  });
  await expect(paragraph).toHaveText('Receiving your finished MP3…');
  await cancel();
  await start(4);
  await page.evaluate(() => {
    const attempt = window.recordingAttempts.at(-1);
    attempt.resolve(new Response(new ReadableStream({
      start(controller) { attempt.stream = controller; },
    }), { headers: { 'Content-Type': 'audio/mpeg' } }));
  });
  await expect(paragraph).toHaveText('Receiving your finished MP3…');
  // Local fixture only: exercise actual decoding/playback and download.
  await page.evaluate(bytes => {
    const stream = window.recordingAttempts.at(-1).stream;
    stream.enqueue(new Uint8Array(bytes));
    stream.close();
  }, [...readFileSync('server/santa-audio/sleighbells.mp3')]);
  const result = page.getByRole('region', { name: 'Your finished Santa message' });
  await expect(result).toBeVisible();
  await expect(notice).toHaveCount(0);
  const player = result.locator('audio');
  await expect.poll(() => player.evaluate(node => node.readyState)).toBeGreaterThanOrEqual(1);
  await player.evaluate(node => node.play());
  await expect.poll(() => player.evaluate(node => node.currentTime)).toBeGreaterThan(0.1);
  await player.evaluate(node => node.pause());
  const downloadPromise = page.waitForEvent('download');
  await result.getByRole('link', { name: /Download MP3/ }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('santa-message-for-D’Arcy.mp3');
  expect(await page.evaluate(() => window.noticeRandomCalls)).toBe(13);
  expect(await page.evaluate(() => window.recordingAttempts.length)).toBe(13);
});

test('review create placement on desktop and phones, real MP3 playback/download, local spelling and cleanup', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.revokedAudioUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.revokedAudioUrls.push(url); revoke(url); };
  });
  const fixture = await openReview(page);
  fixture.audio = readFileSync('generated-artifacts/studio-test-message.mp3');
  const submissions = fixture.posts;
  for (const width of [1365, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const create = page.getByRole('button', { name: 'Create message', exact: true });
    await create.scrollIntoViewIfNeeded();
    const bounds = await create.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThan(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const dock = page.locator('.radio-dock');
    if (await dock.isVisible()) {
      expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
    }
    await page.screenshot({ path: `generated-artifacts/studio-review-${width}.png` });
  }
  await page.getByRole('button', { name: 'Play recorded name for Dixie', exact: true }).click();
  await expect(page.locator('.smw-name-preview-status')).toHaveText('Playing name…');
  await confirmMessage(page);
  await expect(page.locator('.smw-name-preview-status')).toHaveText('');
  const result = page.getByRole('region', { name: 'Your finished Santa message' });
  await expect(result).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toEqual({ name: 'dixie-variant', age: 'year-9', talent: { skip: true }, activity: 'teamwork', achievement: 'jigsaw', treat: 'buche', place: 'forest' });
  const player = result.locator('audio');
  await expect.poll(() => player.evaluate(node => node.readyState)).toBeGreaterThanOrEqual(1);
  const duration = await player.evaluate(node => node.duration);
  expect(duration).toBeGreaterThan(40);
  await player.evaluate(node => node.play());
  await expect.poll(() => player.evaluate(node => node.currentTime)).toBeGreaterThan(0.1);
  await player.evaluate(node => node.pause());
  const url = await player.getAttribute('src');
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('D’Arcy');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
  await expect(player).toHaveAttribute('src', url);
  await result.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'generated-artifacts/studio-completed-mobile.png' });
  const download = result.getByRole('link', { name: /Download MP3/ });
  await expect(download).toHaveAttribute('download', 'santa-message-for-D’Arcy.mp3');
  const downloaded = page.waitForEvent('download');
  await download.click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('santa-message-for-D’Arcy.mp3');
  expect(submissions).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
  await expect(result).toBeHidden();
  expect(await page.evaluate(url => window.revokedAudioUrls.includes(url), url)).toBe(false);
  await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await expect(page.locator('.smw-message-result audio')).toHaveAttribute('src', url);
  await confirmMessage(page);
  await expect(page.locator('.smw-message-result audio')).toHaveCount(1);
  expect(submissions[1].activity).toBe('instrument');
  const nextUrl = await page.locator('.smw-message-result audio').getAttribute('src');
  await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  // BrowserRouter updates history before React commits the new page. Wait for
  // the old page to actually leave, then observe its resource cleanup.
  await expect(page.locator('.smw-page')).toHaveCount(0);
  await expect.poll(() => page.evaluate(url => window.revokedAudioUrls.includes(url), nextUrl)).toBe(true);
});

test('retryable preparation errors and cancellation spend no successful allowance', async ({ page }) => {
  test.setTimeout(60000);
  let attempt = 0, release;
  await page.route('**/api/santa-studio-message', async route => {
    attempt++;
    if (attempt === 1) return route.fulfill({ status: 503, json: { error: 'A recording could not be loaded. Please try again.' } });
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3') }).catch(() => {});
  });
  await openReview(page);
  await confirmMessage(page);
  await expect(page.getByRole('alert')).toContainText('A recording could not be loaded');
  await confirmMessage(page, 'Retry message');
  await expect(page.getByRole('progressbar', { name: 'Preparing your message', exact: true })).toBeVisible();
  await expect.poll(() => attempt).toBe(2);
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  release();
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
  await confirmMessage(page);
  await expect.poll(() => attempt).toBe(3);
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  release();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
});

test('school voucher form opens real long-form generation and playable MP3 without exhausting another parent', async ({ page, browser }) => {
  test.skip(Date.now() < SCHOOL_TEST_START || Date.now() >= SCHOOL_TEST_DEADLINE,
    'Real school access is date-bound; deterministic server tests cover every cutoff outside this window.');
  test.setTimeout(240000);
  // No mocks for names, catalogue, access, generation, or MP3 decoding.
  await openReview(page, { live: true, school: true });
  const requests = [];
  page.on('request', req => { if (req.method() === 'POST' && req.url().includes('/api/santa-studio-message')) requests.push(req); });
  const responsePromise = page.waitForResponse(res => res.request().method() === 'POST' && res.url().endsWith('/api/santa-studio-message'), { timeout: 120000 });
  await confirmMessage(page);
  const response = await responsePromise;
  expect(response.status(), response.status() === 200 ? 'Generated MP3' : await response.text()).toBe(200);
  const payload = requests[0].postDataJSON();
  expect(Object.keys(payload).sort()).toEqual(['achievement', 'activity', 'age', 'name', 'place', 'talent', 'treat']);
  expect(payload.talent).toEqual({ skip: true });
  expect(payload.name).toMatch(/^(?:f-[a-f0-9]{64}|arabella)$/);
  expect(response.headers()['cache-control']).toContain('no-store');
  const player = page.locator('.smw-message-result audio');
  await expect(player).toBeVisible();
  await expect.poll(() => player.evaluate(node => node.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  expect(await player.evaluate(node => node.duration)).toBeGreaterThan(60);
  await player.evaluate(node => node.play());
  await expect.poll(() => player.evaluate(node => node.currentTime)).toBeGreaterThan(0.1);
  await player.evaluate(node => node.pause());
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download MP3/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^santa-message-for-Arabella\.mp3$/);
  await download.saveAs('generated-artifacts/studio-live-hosted-message.mp3');
  expect(readFileSync(await download.path()).length).toBeGreaterThan(10000);
  // Fully decode the actual browser-local MP3, not a recovery or fixture.
  const recovered = await player.evaluate(async node => {
    const response = await fetch(node.src);
    if (!response.ok) return { status: response.status };
    const bytes = await response.arrayBuffer();
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(bytes);
      return { status: response.status, duration: decoded.duration,
        channels: decoded.numberOfChannels, samples: decoded.length,
        };
    } finally { await context.close(); }
  });
  expect(recovered.status).toBe(200);
  expect(recovered.duration).toBeGreaterThan(10);
  expect(recovered.samples).toBeGreaterThan(100000);
  expect(recovered.channels).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  const secondParent = await browser.newContext({ baseURL: origin });
  try {
    const response = await secondParent.request.post('/api/santa-workshop-access', {
      headers: { Origin: origin }, data: { code: process.env.WORKSHOP_TEST_CODE_6 },
    });
    expect(response.status()).toBe(200);
    expect(await (await secondParent.request.get('/api/santa-studio-message')).json()).toMatchObject({
      temporary: true,
    });
    expect(await (await page.request.get('/api/santa-studio-message')).json()).toMatchObject({
      temporary: true,
    });
  } finally { await secondParent.close(); }
  expect((await page.request.get('/api/santa-studio-message?audio=1')).status()).toBe(410);
  await page.reload();
  await expect(page.locator('.smw-message-result audio')).toHaveCount(0);
});

test('full-message playback coordinates with radio and pagehide stops playback without losing the result', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('https://global.citrus3.com:8164/**', route => route.fulfill({
    contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
  }));
  const fixture = await openReview(page);
  fixture.audio = readFileSync('generated-artifacts/studio-test-message.mp3');
  await confirmMessage(page);
  const player = page.locator('.smw-message-result audio');
  await expect(player).toBeVisible();
  // The approved Studio hides its dock. Exercise its still-mounted real control
  // without changing that appearance or making external radio requests.
  const radio = page.locator('.radio-dock .radio-play');
  await radio.evaluate(node => node.click());
  await expect(radio).toContainText('Pause');
  await player.evaluate(node => node.play());
  await expect(radio).toContainText('Listen Live');
  await player.evaluate(node => node.pause());
  await expect(radio).toContainText('Pause');
  await player.evaluate(node => node.play());
  await expect(radio).toContainText('Listen Live');
  await radio.evaluate(node => node.click());
  await expect(radio).toContainText('Pause');
  await expect.poll(() => player.evaluate(node => node.paused)).toBe(true);
  await player.evaluate(node => node.dispatchEvent(new Event('ended')));
  await expect(radio).toContainText('Pause');
  const url = await player.getAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(player).toHaveAttribute('src', url);
  await expect.poll(() => player.evaluate(node => node.paused)).toBe(true);
  expect(await page.evaluate(async url => {
    try { return (await fetch(url)).ok; } catch { return false; }
  }, url)).toBe(true);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
});

test('confirmation cancellation, Escape, focus trap and mobile layout never generate a recording', async ({ page }) => {
  const fixture = await openReview(page);
  await page.setViewportSize({ width: 320, height: 740 });
  const create = page.getByRole('button', { name: 'Create message', exact: true });
  await create.click();
  const dialog = page.getByRole('dialog', { name: 'Are you happy with your selection?' });
  const back = dialog.getByRole('button', { name: 'Go back', exact: true });
  await expect(back).toBeFocused();
  await expect(dialog).toContainText('temporary MP3');
  await expect(dialog).toContainText('We do not keep a copy or message history');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Create message', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'generated-artifacts/studio-generation-confirmation-320.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
  expect(fixture.posts).toHaveLength(0);
  await create.click();
  await back.click();
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.state.temporary).toBe(true);
});

test('temporary downloads survive failed replacement but never recover after refresh, new tabs or navigation', async ({ page, context }) => {
  test.setTimeout(90000);
  const fixture = await openReview(page);
  await confirmMessage(page);
  const result = page.getByRole('region', { name: 'Your finished Santa message' });
  const download = result.getByRole('link', { name: /Download MP3/ });
  await expect(download).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change Their recorded name', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Change Santa will be flying in to', exact: true })).toBeEnabled();
  const create = page.getByRole('button', { name: 'Create message', exact: true });
  await expect(create).toBeEnabled();
  for (const width of [1365, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await download.evaluate(node => {
      const button = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
      return { right: button.right, edge: parent.right, left: button.left, height: button.height,
        colour: getComputedStyle(node).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(Math.abs(geometry.right - geometry.edge)).toBeLessThan(1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.height).toBeGreaterThanOrEqual(44);
    expect(geometry.colour).toBe('rgb(155, 17, 30)');
    expect(geometry.overflow).toBe(false);
  }
  for (let n = 0; n < 2; n++) {
    const saving = page.waitForEvent('download');
    await download.click();
    expect((await saving).suggestedFilename()).toBe('santa-message-for-Dixie.mp3');
  }
  expect(fixture.posts).toHaveLength(1);
  const original = await download.getAttribute('href');
  await page.getByRole('button', { name: 'Change Trying hard at', exact: true }).click();
  await page.getByRole('option', { name: 'Playing a musical instrument', exact: true }).click();
  await page.getByRole('button', { name: 'Return to review', exact: true }).click();
  await expect(download).toHaveAttribute('href', original);
  fixture.fail = true;
  await confirmMessage(page);
  await expect(page.getByRole('alert')).toContainText('Fixture recording unavailable');
  expect(fixture.state.temporary).toBe(true);
  await expect(download).toHaveAttribute('href', original);
  fixture.fail = false;
  let release;
  fixture.hold = new Promise(resolve => { release = resolve; });
  await confirmMessage(page);
  await expect(page.getByRole('progressbar', { name: 'Preparing your message' })).toBeVisible();
  await expect(download).toHaveAttribute('href', original);
  release();
  await expect(page.getByText('Your message is ready to play and download.', { exact: false })).toBeVisible();
  await expect(create).toBeEnabled();
  expect(fixture.state.successes).toBeUndefined();
  expect(fixture.posts.at(-1).name).toBe('dixie-variant');
  expect(fixture.posts.at(-1).place).toBe('forest');
  expect(fixture.posts.at(-1).activity).toBe('instrument');
  await page.getByRole('button', { name: 'Edit certificate name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name spelling', exact: true }).fill('D’Arcy');
  await page.getByRole('button', { name: 'Use this spelling', exact: true }).click();
  await expect(download).toHaveAttribute('download', 'santa-message-for-D’Arcy.mp3');
  const postCount = fixture.posts.length;
  await page.reload();
  await expect(download).toHaveCount(0);
  const tab = await context.newPage();
  await tab.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await tab.goto(path);
  await expect(tab.getByRole('link', { name: /Download MP3/ })).toHaveCount(0);
  await tab.close();
  await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
  await expect(page.locator('.smw-page')).toHaveCount(0);
  await page.goBack();
  await expect(download).toHaveCount(0);
  expect(fixture.posts).toHaveLength(postCount);
});
