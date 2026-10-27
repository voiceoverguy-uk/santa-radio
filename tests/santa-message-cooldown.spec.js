import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openMessageDesk, mockBrevo, fillAccessForm, mockSantaNames } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY } from '../src/lib/santaMessageAllowance.js';
import { SANTA_GIFT_COMPARISONS } from '../src/components/SantaCooldownNotice.jsx';

const audio = readFileSync('server/santa-audio/sleighbells.mp3');
const mp3 = { contentType: 'audio/mpeg', body: audio };
async function create(page, name = 'Olivia') {
  await page.getByLabel('First Name').fill(name);
  await expect(page.getByRole('option', { name, exact: true })).toBeVisible();
  await page.getByLabel('First Name').press('Escape');
  await page.getByRole('button', { name: 'Create message', exact: true }).evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('heading', { name: `For ${name}, from Santa` })).toBeVisible();
}
async function usage(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), MESSAGE_ALLOWANCE_KEY);
}

test.beforeEach(async ({ context }) => {
  test.setTimeout(120000);
  // Only local UI and mocked requests: no CRM contacts, real renders or radio connections.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === new URL(test.info().project.use.baseURL).hostname || url.protocol === 'blob:'
      ? route.continue() : route.abort();
  });
  await context.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await mockSantaNames(context);
  await context.addInitScript(() => {
    window.testNow = 1801915200000;
    Date.now = () => window.testNow;
  });
});

test('one success blocks another for thirty minutes, preserves downloads and offers radio', async ({ page }) => {
  let calls = 0;
  const outros = [];
  await page.route('**/api/santa-message', route => {
    calls++;
    outros.push(route.request().postDataJSON().outro);
    return route.fulfill(mp3);
  });
  await openMessageDesk(page);
  await expect(page.getByRole('heading', { name: 'Download your free Santa greeting' })).toBeVisible();
  await expect(page.locator('.form-desc')).toContainText('Search for the name and press Create message.');
  await expect(page.locator('.santa-message-box')).not.toContainText(/30.minute|messages remaining|message allowance/);
  await create(page);
  await expect(page.getByRole('link', { name: 'Download your audio' })).toBeVisible();
  expect([1, 2]).toContain(outros[0]);
  expect(outros).toHaveLength(1);
  await expect(page.locator('.message-result')).toHaveCount(1);
  await page.evaluate(() => {
    const recordings = document.querySelectorAll('.message-result audio');
    window.recordingPauses = 0;
    recordings.forEach(recording => { recording.pause = () => { window.recordingPauses++; }; });
    recordings[0].dispatchEvent(new Event('play'));
  });
  expect(await page.evaluate(() => window.recordingPauses)).toBe(0);
  await expect(page.getByText('(The radio will pause while playing)', { exact: true })).toHaveCount(0);
  await expect(page.locator('.message-wait .message-result')).toHaveCount(1);
  await expect(page.getByText('On iPhone, choose Share → Save to Files to keep the MP3.', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('timer')).toHaveText('30:00');
  const gift = await page.getByTestId('santa-gift-comparison').textContent();
  expect(SANTA_GIFT_COMPARISONS).toContain(gift);
  await expect(page.locator('.message-recovery-copy')).toHaveText(`You’ve created a Free Santa message. Please allow Santa 30 mins to recover before he records more. Coming soon! You can personalise your message further for the price of (${gift}). Meanwhile, why not tell friends and enjoy Santa Radio Christmas music while you wait.`);
  await expect(page.getByRole('button', { name: 'Share with friends', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
  await expect(page.getByLabel('First Name')).toBeDisabled();
  await page.locator('.santa-message-box form').evaluate(form => form.requestSubmit());
  expect(calls).toBe(1);
  await expect(page.locator('.message-result audio')).toHaveCount(1);
  for (const name of ['Olivia']) {
    const download = page.waitForEvent('download');
    await page.getByLabel(`Santa’s greeting for ${name}`, { exact: true }).getByRole('link', { name: 'Download your audio' }).click();
    expect((await download).suggestedFilename()).toBe(`santa-recorded-message-for-${name}.mp3`);
  }
  expect((await usage(page)).used).toBe(1);
  await page.evaluate(() => {
    window.radioPlays = 0;
    const radio = document.querySelector('audio');
    radio.play = () => { window.radioPlays++; return Promise.resolve(); };
    radio.load = () => {};
    radio.pause = () => {};
  });
  await page.getByRole('button', { name: 'Listen to Santa Radio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Santa Radio is playing', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.radioPlays)).toBe(1);
  expect(calls).toBe(1);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('timer')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.santa-message-box').screenshot({ path: `/tmp/santa-message-wait-${width}.png` });
  }
});

test('gift comparison stays fixed through timer ticks and navigation', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => Number(sessionStorage.getItem('test-gift-random') || 0);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-message', route => route.fulfill(mp3));
  await openMessageDesk(page);
  await page.clock.install({ time: new Date(await page.evaluate(() => Date.now())) });
  await create(page);
  const before = await usage(page);
  const comparison = page.getByTestId('santa-gift-comparison');
  await expect(comparison).toHaveAttribute('aria-live', 'off');
  await expect(comparison).toHaveText(SANTA_GIFT_COMPARISONS[0]);
  for (let tick = 0; tick < 12; tick++) {
    await page.clock.runFor(8000);
    await expect(comparison).toHaveText(SANTA_GIFT_COMPARISONS[0]);
  }
  expect(await usage(page)).toEqual(before);
  await expect(page.getByRole('link', { name: 'Download your audio', exact: true })).toBeVisible();
  // A remount during ordinary navigation must not pick another comparison.
  await page.evaluate(() => { Math.random = () => .999999; });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(comparison).toHaveText(SANTA_GIFT_COMPARISONS[0]);
});

test('refresh can choose any gift without changing the allowance', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => Number(sessionStorage.getItem('test-gift-random') || 0);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-message', route => route.fulfill(mp3));
  await openMessageDesk(page);
  await create(page);
  const before = await usage(page);
  const comparison = page.getByTestId('santa-gift-comparison');
  for (const [index, gift] of SANTA_GIFT_COMPARISONS.entries()) {
    await page.evaluate(value => sessionStorage.setItem('test-gift-random', String(value)),
      (index + .5) / SANTA_GIFT_COMPARISONS.length);
    await page.reload();
    await expect(comparison).toHaveText(gift);
    expect(await usage(page)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Minimise radio player', exact: true }).click();
  await page.locator('.message-recovery-copy').evaluate(node =>
    node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.locator('.message-recovery-copy').screenshot({
    path: 'generated-artifacts/cooldown/stable-gift-comparison.png', animations: 'disabled',
  });
});

test('failure, invalid name, non-audio, empty and cancelled requests do not use the allowance', async ({ page }) => {
  let mode = 'failed', calls = 0;
  await page.route('**/api/santa-message', async route => {
    calls++;
    if (mode === 'failed') return route.fulfill({ status: 503, json: { error: 'Try again.' } });
    if (mode === 'html') return route.fulfill({ contentType: 'text/html', body: 'Not an MP3' });
    if (mode === 'empty') return route.fulfill({ contentType: 'audio/mpeg', body: '' });
    if (mode === 'hold') return;
    return route.fulfill(mp3);
  });
  await openMessageDesk(page);
  await page.getByLabel('First Name').fill('Unknown');
  await page.getByRole('button', { name: 'Create message' }).click();
  expect(calls).toBe(0);
  mode = 'success';
  await create(page);
  await page.evaluate(key => {
    window.testNow = JSON.parse(localStorage.getItem(key)).availableAt;
    dispatchEvent(new Event('focus'));
  }, MESSAGE_ALLOWANCE_KEY);
  await expect(page.getByRole('button', { name: 'Create message' })).toBeEnabled();
  for (const current of ['failed', 'html', 'empty']) {
    mode = current;
    await page.getByLabel('First Name').fill('Olivia');
    await page.getByRole('button', { name: 'Create message' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect((await usage(page)).used).toBe(0);
    await expect(page.getByRole('link', { name: 'Download your audio' })).toBeVisible();
  }
  mode = 'hold';
  await page.getByRole('button', { name: 'Create message' }).click();
  await expect(page.getByRole('button', { name: 'Santa Recording...' })).toBeDisabled();
  await page.getByLabel('First Name').fill('Erin');
  await expect(page.getByRole('button', { name: 'Create message' })).toBeEnabled();
  expect((await usage(page)).used).toBe(0);
  mode = 'success';
  await create(page, 'Erin');
  expect((await usage(page)).used).toBe(1);
  await expect(page.locator('.message-result')).toHaveCount(2);
});

test('navigation, reload, a new tab and returning after the deadline preserve and restore the allowance', async ({ page, context }) => {
  await context.route('**/api/santa-message', route => route.fulfill(mp3));
  await openMessageDesk(page);
  await create(page);
  await page.reload();
  expect((await usage(page)).used).toBe(1);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Live from The North Pole, Santa Radio' })).toBeVisible();
  expect((await usage(page)).used).toBe(1);
  const deadline = (await usage(page)).availableAt;
  await page.goto('/apps');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText('30:00');
  const newTab = await context.newPage();
  await mockBrevo(newTab);
  await newTab.goto('/free-santa-message');
  await expect(newTab.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
  await fillAccessForm(newTab);
  await newTab.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(newTab.getByRole('timer')).toHaveText('30:00');
  await expect(newTab.locator('.message-wait')).toContainText('This tab no longer holds those recordings.');
  await expect(newTab.locator('.message-wait .message-download')).toHaveCount(0);
  await newTab.evaluate(time => { window.testNow = time; dispatchEvent(new Event('focus')); }, deadline - 1000);
  await expect(newTab.getByRole('timer')).toHaveText('00:01');
  await newTab.evaluate(time => { window.testNow = time; dispatchEvent(new Event('focus')); }, deadline);
  await expect(newTab.getByRole('timer')).toHaveCount(0);
  await expect(newTab.getByRole('button', { name: 'Create message' })).toBeEnabled();
  await create(newTab);
  expect((await usage(newTab)).used).toBe(1);
});

for (const legacy of [false, true]) {
  test(`simultaneous tabs cannot create a second message (${legacy ? 'IndexedDB fallback' : 'Web Locks'})`, async ({ page, context }) => {
    if (legacy) await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    let calls = 0, release;
    const held = new Promise(resolve => { release = resolve; });
    await context.route('**/api/santa-message', async route => {
      calls++;
      if (calls === 1) await held;
      return route.fulfill(mp3);
    });
    await openMessageDesk(page);
    const second = await context.newPage();
    await openMessageDesk(second);
    await page.getByLabel('First Name').fill('Erin');
    await second.getByLabel('First Name').fill('Olivia');
    await Promise.all([
      page.getByRole('button', { name: 'Create message' }).click(),
      second.getByRole('button', { name: 'Create message' }).click(),
    ]);
    await expect.poll(() => calls).toBe(1);
    await expect.poll(async () => (await page.getByRole('alert').count()) + (await second.getByRole('alert').count())).toBe(1);
    release();
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(second.getByRole('timer')).toBeVisible();
    expect((await usage(page)).used).toBe(1);
    expect(calls).toBe(1);
  });
}

test('blocked browser storage keeps an in-page allowance and explains its limitations', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.route('**/api/santa-message', route => route.fulfill(mp3));
  await openMessageDesk(page);
  await expect(page.getByText(/Your browser can’t remember the message allowance/)).toHaveCount(0);
  await create(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  // Wait for navigation to replace the old form before filling the new one.
  await expect(page.getByRole('heading', { name: 'Live from The North Pole, Santa Radio' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('30:00');
  await expect(page.getByText(/Your browser can’t remember the message allowance/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create message' })).toBeEnabled();
});
