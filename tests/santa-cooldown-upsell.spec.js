import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';

const longName = 'Alexandriarosethegreatwithaverylongunbrokenname';
const names = ['Erica', 'Erin', longName];
const mp3 = readFileSync('server/santa-audio/sleighbells.mp3');
const card = page => page.locator('.santa-message-box');
const offer = page => card(page).getByRole('region', { name: 'Bespoke Santa message invitation' });
const studio = page => page.locator('#santa-studio-promotion');

async function setup(page, { date = '2026-11-02T12:00:00Z', cooldown = false, width = 1440 } = {}) {
  await page.setViewportSize({ width, height: 1100 });
  await page.clock.setFixedTime(new Date(date));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ cooldown }) => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    if (cooldown) localStorage.setItem('santa-message-allowance', JSON.stringify({
      used: 1, availableAt: Date.now() + 7200000, cooldownMs: 7200000,
    }));
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  }, { cooldown });
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.route('**/api/santa-names', route => {
    expect(route.request().method()).toBe('POST');
    const query = route.request().postDataJSON().query.toLowerCase();
    return route.fulfill({ json: { records: names.filter(name => name.toLowerCase().startsWith(query))
      .map(name => ({ id: name.toLowerCase(), name, selectionToken: 'controlled-token',
        previewUrl: '/api/santa-name-preview?token=controlled-token' })), warning: null } });
  });
  await page.route('**/api/santa-message', route => route.fulfill({ contentType: 'audio/mpeg', body: mp3 }));
  await mockBrevo(page);
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(card(page).getByRole('heading', { name: 'Your free Santa greeting', exact: true })).toBeVisible();
}

async function generate(page, name = 'Erica') {
  await expect(offer(page)).toHaveCount(0);
  await page.getByLabel('First Name', { exact: true }).fill(name);
  await page.getByRole('option', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(card(page).getByRole('heading', { name: `To ${name} from Santa` })).toBeVisible();
  await expect(offer(page)).toBeVisible();
}

async function checkNavigation(page, name) {
  await offer(page).getByRole('link').click();
  await expect(page.locator('#santa-studio-title')).toBeFocused();
  const previewName = name || 'Edward';
  await expect(studio(page).locator('.studio-gifts')).toHaveAttribute('data-demo-name', previewName);
  await expect(studio(page).locator('.studio-certificate__name')).toHaveText(previewName);
  await expect(studio(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText(previewName);
  await expect(studio(page).locator('.studio-gifts__gallery .studio-gifts__sr')).toContainText(`Dear ${previewName},`);
  if (name) await expect(studio(page).locator('.santa-studio-promotion__subheading')).toContainText(name);
  const visibleTop = await studio(page).evaluate(node => ({
    top: node.getBoundingClientRect().top,
    header: document.querySelector('.navbar').getBoundingClientRect().bottom,
  }));
  expect(visibleTop.top).toBeGreaterThanOrEqual(visibleTop.header - 1);
  expect(visibleTop.top).toBeLessThan(400);
  expect(new URL(page.url()).search).toBe('');
}

for (const width of [390, 1440]) {
  test(`prelaunch invitation keeps the free recipient, deadline and downloads at ${width}px`, async ({ page }) => {
    await setup(page, { width });
    await generate(page);
    await expect(offer(page).getByRole('heading')).toHaveText('Coming soon: a little more magic for Erica');
    await expect(offer(page).getByRole('link')).toHaveText('Preview Erica’s bespoke message package');
    await expect(offer(page).locator('p')).toHaveText('When Santa’s Message Maker Studio opens, you’ll be able to create a bespoke message personalised with Erica’s age, achievements and the things that make them special. The paid package will also include three personalised digital gifts at no extra cost: a Nice List certificate, a short letter from Santa and Santa’s Nice List picture.');
    await expect(card(page).locator('.message-cooldown-status')).toContainText('Your next free message will be available at');
    await expect(card(page).getByRole('link', { name: /Download your audio/ })).toBeVisible();
    const order = await offer(page).evaluate(node => ({
      top: node.getBoundingClientRect().top,
      availabilityBottom: document.querySelector('.message-cooldown-status').getBoundingClientRect().bottom,
      downloadsBottom: document.querySelector('.message-download-actions').getBoundingClientRect().bottom,
    }));
    expect(order.top).toBeGreaterThan(order.availabilityBottom);
    expect(order.top).toBeGreaterThan(order.downloadsBottom);
    await card(page).screenshot({ path: `generated-artifacts/studio-cooldown-upsell-${width}.jpg`, animations: 'disabled' });
    const input = page.locator('.hero-name-checker').getByRole('combobox');
    await input.fill('Erin');
    await expect(page.locator('.hero-name-checker').getByRole('status')).toContainText('1 matching name.');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(studio(page).locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Erin');
    await expect(offer(page).getByRole('heading')).toHaveText('Coming soon: a little more magic for Erica');
    await checkNavigation(page, 'Erica');
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Erica|Erin/);
  });
}

for (const prelaunch of [true, false]) {
  test(`unknown child uses natural generic ${prelaunch ? 'prelaunch' : 'live'} wording`, async ({ page }) => {
    await setup(page, { cooldown: true, date: prelaunch ? '2026-11-02T12:00:00Z' : '2026-11-07T12:00:00Z' });
    await expect(offer(page).getByRole('heading')).toHaveText(prelaunch
      ? 'Coming soon: a little more Christmas magic' : 'A little more Christmas magic?');
    await expect(offer(page).getByRole('link')).toHaveText(prelaunch
      ? 'Preview the bespoke message package' : 'Explore bespoke Santa messages');
    await expect(offer(page).locator('p')).toContainText('a little one’s age, achievements and the things that make them special.');
    await expect(offer(page)).not.toContainText(/your child/i);
    await expect(offer(page)).not.toContainText('child’s’s');
    await expect(offer(page)).not.toContainText(/Erica|Erin|Arabella|Abbey|Edward/);
    await expect(card(page).locator('.message-cooldown-status')).toContainText('Your recording isn’t saved by this site');
    await expect(card(page).locator('.service-notice')).toHaveText('Free to create and download. (not sent by email)');
    await checkNavigation(page);
  });
}

test('invitation changes from prelaunch to live without changing the free deadline, then disappears when eligible', async ({ page }) => {
  await setup(page, { date: '2026-11-05T23:59:59Z' });
  await generate(page);
  await expect(offer(page).getByRole('link')).toHaveText('Preview Erica’s bespoke message package');
  const deadline = await card(page).locator('.message-cooldown-status').innerText();
  await page.clock.setFixedTime(new Date('2026-11-06T00:00:01Z'));
  await expect(offer(page).getByRole('heading')).toHaveText('A little more magic for Erica?');
  await expect(offer(page).getByRole('link')).toHaveText('Explore Erica’s bespoke message');
  await expect(offer(page).locator('p')).toHaveText('Make it extra special with a bespoke message from Santa, personalised with Erica’s age, achievements and the things that make them special. Your paid package also includes three personalised digital gifts at no extra cost: a Nice List certificate, a short letter from Santa and Santa’s Nice List picture.');
  await expect(card(page).locator('.message-cooldown-status')).toHaveText(deadline);
  await checkNavigation(page, 'Erica');
  await page.clock.setFixedTime(new Date('2026-11-06T02:00:01Z'));
  await expect(offer(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toBeEnabled();
});

test('long chosen names fit the compact invitation at 320px', async ({ page }) => {
  await setup(page, { width: 320 });
  await generate(page, longName);
  const fits = await offer(page).evaluate(node => [node, ...node.querySelectorAll('h4, p, a')]
    .every(element => element.scrollWidth <= element.clientWidth + 1));
  expect(fits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await checkNavigation(page, longName);
});
