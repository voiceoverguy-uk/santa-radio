import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';

const path = '/preview/hero-name-checker';
const inventory = {
  hostedCount: 3, warning: null,
  records: ['Arabella', 'Erin', 'Erica'].map(name => ({ id: name.toLowerCase(), name })),
};
const checker = page => page.locator('.hero-name-checker');
const input = page => checker(page).getByRole('combobox');
const cta = page => checker(page).getByRole('button', { name: 'Create my free Santa message →' });

async function setup(page, { realInventory = false, mediaFailure = false } = {}) {
  await page.addInitScript(({ mediaFailure }) => {
    window.__playCalls = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () {
      window.__playCalls++;
      return mediaFailure ? Promise.reject(new Error('Controlled playback failure')) : Promise.resolve();
    };
  }, { mediaFailure });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { artist: 'John Legend', title: 'Bring Me Love' }, currentStatus: 'ready',
    upcoming: [], upcomingStatus: 'ready',
  } }));
  if (!realInventory) await page.route('**/api/santa-names?*', route => route.fulfill({ json: inventory }));
  // Every provider submission is intercepted; never send real test contacts.
  await mockBrevo(page);
}
async function open(page) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}
async function choose(page, name) {
  await input(page).fill('');
  await input(page).fill(name);
  await checker(page).getByRole('option', { name, exact: true }).click();
  await expect(checker(page).getByRole('status')).toHaveText(`Yes! Santa has a recording for ${name}.`);
}

test('real hosted inventory drives lookup, with no child query URLs, storage or auto audio', async ({ page }) => {
  await setup(page, { realInventory: true });
  const api = await page.request.get('/api/santa-names?inventory=hosted');
  expect(api.ok()).toBe(true);
  const live = await api.json();
  expect(live.records.length).toBeGreaterThan(0);
  const record = live.records.find(record => record.name === 'Arabella') || live.records[0];
  const requested = [];
  page.on('request', request => requested.push(request.url()));
  await open(page);
  await input(page).fill(record.name);
  await expect(checker(page).getByRole('option', { name: record.name, exact: true })).toBeVisible();
  expect(requested.filter(url => url.includes('/api/santa-names')).every(url =>
    !new URL(url).searchParams.get('q'))).toBe(true);
  expect(requested.some(url => url.includes(encodeURIComponent(record.name)))).toBe(false);
  expect(await page.evaluate(() => window.__playCalls)).toBe(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(record.name);
  expect(new URL(page.url()).pathname).toBe(path);
  await expect(cta(page)).toBeDisabled();
});

test('keyboard selection confirms only a deliberate choice and editing clears it', async ({ page }) => {
  await setup(page);
  await open(page);
  await input(page).fill('Er');
  await expect(checker(page).getByRole('option')).toHaveCount(2);
  await input(page).press('ArrowDown');
  await expect(input(page)).toHaveAttribute('aria-activedescendant', /option-0$/);
  await input(page).press('ArrowUp');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('Erica');
  await expect(cta(page)).toBeEnabled();
  await input(page).fill('Erin');
  await expect(cta(page)).toBeDisabled();
  await expect(checker(page).getByRole('status')).not.toContainText('Yes!');
  await input(page).press('Escape');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await input(page).press('ArrowDown');
  await input(page).press('Enter');
  await expect(cta(page)).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(cta(page)).toBeFocused();
});

test('loading, genuine empty results, failures and retry are distinct', async ({ page }) => {
  await setup(page);
  let release;
  let mode = 'loading';
  const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/api/santa-names?inventory=hosted', async route => {
    if (mode === 'loading') await waiting;
    await route.fulfill(mode === 'error' ? { status: 503, json: { error: 'Unavailable' } } : { json: inventory });
  });
  await open(page);
  await input(page).fill('NotRecordedFixture');
  await expect(checker(page).getByRole('status')).toHaveText('Checking Santa’s recorded names…');
  mode = 'error';
  release();
  await expect(checker(page).getByRole('status')).toContainText('temporarily unavailable');
  await expect(checker(page).getByRole('status')).not.toContainText('haven’t found');
  mode = 'success';
  await checker(page).getByRole('button', { name: 'Retry name search' }).click();
  await expect(checker(page).getByRole('status')).toHaveText('We haven’t found that spelling. Try a shorter name or another spelling.');
  await expect(cta(page)).toBeDisabled();
  await choose(page, 'Arabella');
});

for (const width of [1280, 390]) test(`signup handoff, deliberate focus and later selections at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page);
  let renders = 0;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  await open(page);
  await choose(page, 'Arabella');
  await cta(page).click();
  await expect(page.locator('.santa-message-access input[name="FIRSTNAME"]')).toBeFocused();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveCount(0);
  // A failed signup keeps the pending name, adult fields and access gate.
  await mockBrevo(page, { message: 'Controlled provider refusal' }, 503);
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.locator('.santa-message-access__error')).toBeVisible();
  await expect(page.locator('.santa-message-access input[name="FIRSTNAME"]')).toHaveValue('Testparent');
  await mockBrevo(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  const maker = page.getByLabel('First Name', { exact: true });
  await expect(maker).toHaveValue('Arabella');
  await expect(page.locator('.santa-message-box h3')).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  expect(renders).toBe(0);
  const card = await page.locator('.santa-message-box').boundingBox();
  const nav = await page.locator('.navbar').boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(nav.y + nav.height);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await choose(page, 'Erin');
  await cta(page).click();
  await expect(maker).toHaveValue('Erin');
  await expect(maker).toBeFocused();
  expect(renders).toBe(0);
  await maker.fill('UnrecordedFixture');
  await expect(page.getByRole('button', { name: 'Request this name', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Arabella');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Erin');
});

test('phone touch selection handles taps but not scrolling or cancelled touches', async ({ page }) => {
  await setup(page);
  await open(page);
  await input(page).fill('Er');
  const option = checker(page).getByRole('option', { name: 'Erin', exact: true });
  const touch = { pointerType: 'touch', pointerId: 7, clientX: 100, clientY: 250 };
  await option.dispatchEvent('pointerdown', touch);
  await option.dispatchEvent('pointermove', { ...touch, clientY: 290 });
  await option.dispatchEvent('pointerup', { ...touch, clientY: 290 });
  await option.dispatchEvent('click', { detail: 1 });
  await expect(cta(page)).toBeDisabled();
  await option.dispatchEvent('pointerdown', touch);
  await input(page).evaluate(node => node.blur());
  await option.dispatchEvent('pointerup', touch);
  await expect(cta(page)).toBeEnabled();
});

test('creating the enabled Arabella pilot uses only a private POST, preserving the allowance', async ({ page }) => {
  await setup(page);
  const urls = [];
  const creations = [];
  page.on('request', request => urls.push(request.url()));
  // Trap both saved-greeting shortcuts: either would leak the selected name.
  await page.route('**/api/santa-greeting?*', route => route.abort());
  await page.route('https://stagcommunications.com/**', route => route.abort());
  await page.route('**/api/santa-message', route => {
    creations.push({ method: route.request().method(), body: route.request().postDataJSON() });
    return route.fulfill({
      contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
    });
  });
  await open(page);
  await choose(page, 'Arabella');
  await cta(page).click();
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Arabella');
  await expect(page.locator('.message-name-hint').filter({ hasText: 'Arabella is selected.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  const result = page.locator('.message-result');
  await expect(result).toBeVisible();
  await expect(result.getByRole('link', { name: 'Download your audio' })).toHaveAttribute('href', /^blob:/);
  expect(creations).toHaveLength(1);
  expect(creations[0].method).toBe('POST');
  expect(creations[0].body.name).toBe('arabella');
  expect([1, 2]).toContain(creations[0].body.outro);
  expect(urls.filter(url => /arabella/i.test(decodeURIComponent(url)))).toEqual([]);
  expect(urls.some(url => url.includes('/api/santa-greeting'))).toBe(false);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(storage.toLowerCase()).not.toContain('arabella');
  const allowance = await page.evaluate(() => JSON.parse(localStorage.getItem('santa-message-allowance')));
  expect(allowance.used).toBe(1);
  expect(allowance.availableAt).toBeGreaterThan(Date.now());
  await expect(page.getByRole('button', { name: 'Create message', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(path);
});

for (const width of [1280, 768, 390, 320]) test(`layout and playback stay stable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await open(page);
  const card = page.locator('.hero-name-preview__checker');
  const countdown = page.locator('.hero-countdown');
  const reservedArtwork = page.locator('.hero-name-preview__artwork-slot');
  await expect(reservedArtwork).toBeHidden();
  await expect(page.getByText('Song artwork appears here while Santa Radio is playing.')).toHaveCount(0);
  await expect(page.locator('.hero .app-store-badge')).toHaveCount(0);
  await expect(page.locator('.hero input')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const before = await card.boundingBox();
  const countdownBefore = await countdown.boundingBox();
  const listen = page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true });
  await listen.click();
  const artwork = page.locator('.hero .now-playing-artwork');
  await expect(artwork).toBeVisible();
  await expect(artwork).toContainText('Bring Me Love');
  const after = await card.boundingBox();
  const countdownAfter = await countdown.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(Math.abs(countdownAfter.y - countdownBefore.y)).toBeLessThan(1);
  const picture = await artwork.boundingBox();
  expect(picture.x + picture.width).toBeLessThanOrEqual(width);
  const image = await artwork.locator('.now-playing-artwork__image').boundingBox();
  const artworkSlot = await page.locator('.hero-name-preview__artwork-slot').boundingBox();
  expect(Math.abs(image.width - image.height)).toBeLessThan(1);
  expect(image.y).toBeGreaterThanOrEqual(artworkSlot.y);
  expect(image.y + image.height).toBeLessThanOrEqual(artworkSlot.y + artworkSlot.height);
  const caption = await artwork.locator('.now-playing-artwork__caption').boundingBox();
  expect(caption.y + caption.height).toBeLessThanOrEqual(artworkSlot.y + artworkSlot.height);
  if (width >= 1280) {
    // The owner must be able to see the cover, not a tiny inline thumbnail.
    expect(image.width).toBeGreaterThanOrEqual(200);
    expect(picture.width).toBeLessThan(320);
    const title = await page.locator('.hero-title').boundingBox();
    expect(title.width).toBeGreaterThan(before.width + picture.width);
    const description = await page.locator('.hero-name-preview__description').boundingBox();
    expect(description.width).toBeLessThanOrEqual(380);
    expect(Math.abs(countdownAfter.y + countdownAfter.height - artworkSlot.y - artworkSlot.height)).toBeLessThan(1);
    expect(description.y).toBeGreaterThanOrEqual(title.y + title.height);
    // Match the owner's mockup: the cover tucks beside the second title
    // line, above the paragraph, rather than following the entire heading.
    expect(picture.x).toBeLessThan(width * .48);
    expect(picture.y).toBeLessThan(description.y);
    expect(picture.y).toBeLessThan(title.y + title.height);
    expect(Math.abs(artworkSlot.y - before.y)).toBeLessThanOrEqual(48);
    const secondTitleLine = await page.locator('.hero-title span').boundingBox();
    expect(Math.abs(artworkSlot.y - secondTitleLine.y)).toBeLessThan(20);
    expect(Math.abs(before.y - secondTitleLine.y)).toBeLessThan(20);
  }
  if (width >= 768) expect(picture.x + picture.width).toBeLessThan(before.x);
  else {
    const intro = await page.locator('.hero-name-preview__intro').boundingBox();
    expect(before.y).toBeGreaterThan(intro.y + intro.height);
    expect(picture.y).toBeGreaterThan(before.y + before.height);
  }
  const pause = page.locator('.hero-actions').getByRole('button', { name: /Pause/ });
  await pause.click();
  await expect(artwork).toHaveCount(0);
  await expect(reservedArtwork).toBeHidden();
  expect(Math.abs((await card.boundingBox()).y - before.y)).toBeLessThan(1);
  expect(Math.abs((await countdown.boundingBox()).y - countdownBefore.y)).toBeLessThan(1);
});

test('unavailable metadata never claims the previous song is live, and playback failure shows no artwork', async ({ page }) => {
  await setup(page, { mediaFailure: true });
  await open(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(page.locator('.hero .now-playing-artwork')).toHaveCount(0);
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { artist: 'John Legend', title: 'Bring Me Love' }, currentStatus: 'unavailable',
    upcoming: [], upcomingStatus: 'unavailable',
  } }));
  await page.evaluate(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
  await page.locator('.hero-actions').getByRole('button', { name: /Try Again|Listen Live/ }).click();
  await expect(page.locator('.hero .now-playing-artwork')).toContainText('Santa Radio live');
  await expect(page.locator('.hero .now-playing-artwork')).not.toContainText('John Legend');
});

test('preview stays non-indexable while the approved homepage hero omits the store badge and retains SEO', async ({ page }) => {
  await setup(page);
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  expect(await response.text()).toContain('Does Santa have your child');
  await open(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain(path);
  await page.goto('/');
  await expect(page.locator('.hero .app-store-badge')).toHaveCount(0);
  await expect(page.locator('.hero a[href*="apps.apple.com"]')).toHaveCount(0);
  await expect(page.locator('.hero .hero-name-checker')).toHaveCount(1);
  await expect(page.locator('.hero-name-preview__flag')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/');
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
  await expect(page.locator('.partnership-strip')).toHaveCount(1);
  await expect(page.locator('.santa-dash-promo')).toHaveCount(1);
});

for (const width of [1440, 390]) test(`approved homepage handoff and matching radio/countdown widths at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await setup(page);
  let renders = 0;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  const requested = [];
  page.on('request', request => requested.push(request.url()));
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.locator('.hero-actions button')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const button = await page.locator('.hero-actions button').boundingBox();
  const countdown = await page.locator('.hero-countdown .countdown').boundingBox();
  expect(Math.abs(button.width - countdown.width)).toBeLessThan(1);
  expect(Math.abs(button.x - countdown.x)).toBeLessThan(1);
  const heading = await page.locator('.hero-title').boundingBox();
  const description = await page.locator('.hero-description').boundingBox();
  expect(description.y - heading.y - heading.height).toBeGreaterThanOrEqual(width >= 1091 ? 40 : 0);
  await choose(page, 'Arabella');
  await cta(page).click();
  await expect(page.locator('.santa-message-access input[name="FIRSTNAME"]')).toBeFocused();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveCount(0);
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Arabella');
  expect(new URL(page.url()).pathname).toBe('/');
  expect(requested.some(url => url.includes('Arabella'))).toBe(false);
  expect(renders).toBe(0);
});

test('approval screenshots show the real name inventory on desktop and phone', async ({ page }) => {
  await setup(page, { realInventory: true });
  await page.unroute('**/api/radio-metadata*');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  mkdirSync('generated-artifacts', { recursive: true });
  for (const [label, width] of [['desktop', 1440], ['mobile', 390]]) {
    await page.setViewportSize({ width, height: label === 'desktop' ? 1000 : 1100 });
    await open(page);
    await choose(page, 'Arabella');
    const minimise = page.getByRole('button', { name: 'Minimise radio player', exact: true });
    if (await minimise.isVisible()) await minimise.click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `generated-artifacts/hero-name-checker-${label}.png` });
    await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
    await expect(page.locator('.hero .now-playing-artwork')).toBeVisible();
    await page.locator('.hero').screenshot({ path: `generated-artifacts/hero-name-checker-${label}-playing.png` });
    await page.locator('.hero-actions').getByRole('button', { name: 'Pause Radio', exact: true }).click();
  }
});
