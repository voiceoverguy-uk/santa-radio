import { test, expect } from '@playwright/test';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';

const checker = page => page.locator('.hero-name-checker');
const choose = async page => {
  await checker(page).getByRole('combobox').fill('Wendy');
  await checker(page).getByRole('option', { name: 'Wendy', exact: true }).click();
};
const continueToMessage = page => checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();

async function setup(page, authorized = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    window.__historyWrites = [];
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method].bind(history);
      history[method] = (...args) => {
        window.__historyWrites.push(JSON.stringify(args));
        return original(...args);
      };
    }
    window.__mediaCalls = [];
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      window.__mediaCalls.push('play');
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.__mediaCalls.push('pause');
    };
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await mockBrevo(page);
  if (authorized) await page.route('**/api/santa-message-access', route => route.fulfill({
    json: { authorized: true, availableAt: 0 },
  }));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 9774 } }));
  await page.route('**/names-data/*', route => route.fulfill({ json: ['Wendy'] }));
  const searches = [];
  await page.route('**/api/santa-names', route => {
    searches.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      hostedCount: 9774, warning: null,
      records: [{ id: 'wendy-recording', name: 'Wendy', selectionToken: 'private-fixture',
        previewUrl: '/api/santa-name-preview?token=private-fixture' }],
    } });
  });
  const requests = [];
  page.on('request', request => requests.push({ url: request.url(), body: request.postData() }));
  let creations = 0;
  await page.route('**/api/santa-message', route => {
    creations++;
    return route.fulfill({ status: 503, json: { error: 'Controlled failure' } });
  });
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  return { searches, requests, creations: () => creations };
}

async function expectPrivate(page, requests) {
  expect(page.url()).not.toMatch(/Wendy/i);
  expect(await page.evaluate(() => JSON.stringify({
    history: history.state, writes: window.__historyWrites,
    local: { ...localStorage }, session: { ...sessionStorage },
  }))).not.toMatch(/Wendy/i);
  expect(requests.filter(r => /Wendy/i.test(decodeURIComponent(r.url)))).toEqual([]);
  expect(requests.filter(r => !r.url.endsWith('/api/santa-names') && /Wendy/i.test(r.body || ''))).toEqual([]);
}

async function expectLanding(page) {
  await expect(page.locator('.santa-message-box h3').first()).toBeFocused();
  const top = await page.locator('.santa-message-box').evaluate(node =>
    node.getBoundingClientRect().top - document.querySelector('.navbar').getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(10);
  expect(top).toBeLessThanOrEqual(64);
  const y = await page.evaluate(() => scrollY);
  await page.waitForTimeout(2000);
  expect(Math.abs(await page.evaluate(() => scrollY) - y)).toBeLessThan(2);
}

test('same-route navigation cannot reuse a consumed name or override a legacy link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, true);
  await choose(page);
  await continueToMessage(page);
  await expect(page.locator('.message-name-input')).toHaveValue('Wendy');
  await page.locator('.navbar').getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
  await expect(page.locator('.message-name-input')).toHaveValue('');
  await page.goBack();
  await expect(page.locator('.message-name-input')).toHaveValue('');
  // Exercise an old public query link without a full document reload.
  await page.evaluate(() => {
    history.pushState({ ...history.state, key: 'legacy-link' }, '', '/free-santa-message?name=Erin');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.message-name-input')).toHaveValue('Erin');
});

for (const width of [390, 1440]) {
  test(`private homepage journey retains name through signup and preserves radio at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await setup(page);
    await page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button').click();
    await expect(page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button')).toHaveAccessibleName('Pause Radio');
    const media = await page.evaluate(() => window.__mediaCalls.slice());
    await choose(page);
    await expect(page.locator('#santa-studio-promotion')).toHaveAttribute('data-recipient', 'Wendy');
    await expect(page.locator('.homepage-santa-studio .studio-gifts')).toHaveAttribute('data-demo-name', 'Wendy');
    await continueToMessage(page);
    await expect(page).toHaveURL(/\/free-santa-message$/);
    await expect(page.locator('.santa-message-access__intro')).toContainText('for Wendy from Santa.');
    await expectLanding(page);
    expect(await page.evaluate(() => window.__mediaCalls)).toEqual(media);
    await fillAccessForm(page);
    await expect(page.locator('.santa-message-access__intro')).toContainText('for Wendy from Santa.');
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    await expect(page.locator('.message-name-input')).toHaveValue('Wendy');
    await expect(page.locator('.message-name-hint').filter({ hasText: 'Santa is ready to record for Wendy.' })).toBeVisible();
    await expectLanding(page);
    // Public display names are not recording authority; signup triggers a
    // separate private recording lookup before creation becomes available.
    expect(fixture.searches.filter(q => q.query === 'Wendy').length).toBeGreaterThanOrEqual(1);
    expect(fixture.creations()).toBe(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('santa-message-allowance')).used)).toBe(0);
    await expectPrivate(page, fixture.requests);
    await page.locator('.message-submit').click();
    await expect(page.getByRole('alert')).toContainText('Controlled failure');
    expect(fixture.creations()).toBe(1);
  });

  test(`existing access, reload and navigation never reuse a stale handoff at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await setup(page, true);
    await choose(page);
    await continueToMessage(page);
    await expect(page.locator('.message-name-input')).toHaveValue('Wendy');
    await expect(page.locator('.santa-message-access')).toHaveCount(0);
    await expectLanding(page);
    await page.goBack();
    await expect(checker(page).getByRole('combobox')).toHaveValue('');
    await page.goForward();
    await expect(page.locator('.message-name-input')).toHaveValue('');
    await page.goBack();
    await choose(page);
    await continueToMessage(page);
    await expect(page.locator('.message-name-input')).toHaveValue('Wendy');
    await page.reload();
    await expect(page.locator('.message-name-input')).toHaveValue('');
    await page.getByRole('link', { name: 'Santa Radio home', exact: true }).click();
    await choose(page); // Checking alone must not create a handoff.
    if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.locator('.navbar').getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
    await expect(page.locator('.message-name-input')).toHaveValue('');
    await expectPrivate(page, fixture.requests);
    expect(fixture.creations()).toBe(0);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`homepage Studio heading, spacing and preserved content order at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.message-intro, .santa-message-box, .santa-message-access')).toHaveCount(0);
    const section = page.locator('.homepage-santa-studio');
    await expect(section.locator('.homepage-section-heading')).toHaveText(
      'A unique Christmas treat.MESSAGE FROM SANTAOUR PREMIUM EXPERIENCEAsk Santa for a bespoke message to your little one.');
    await expect(section.locator('.homepage-section-heading__divider')).toHaveAttribute('aria-hidden', 'true');
    await expect(section.locator('.santa-studio-promotion__offer-price')).toHaveText('£6.50');
    await expect(section.getByLabel('Voucher code', { exact: true })).toHaveCount(1);
    await expect(section.locator('.santa-message-reviews')).toHaveCount(1);
    const order = await page.locator('main.home-page > *').evaluateAll(nodes =>
      nodes.map(node => node.className?.toString() || node.tagName));
    expect(order.findIndex(s => s.includes('homepage-santa-studio'))).toBe(
      order.findIndex(s => s.includes('hero-name-preview__hero')) + 1);
    const geometry = await section.evaluate(node => {
      const rect = element => element.getBoundingClientRect();
      const hero = rect(document.querySelector('.hero'));
      const box = rect(node);
      const heading = rect(node.querySelector('.homepage-section-heading'));
      const card = rect(node.querySelector('#santa-studio-promotion'));
      return { gap: box.top - hero.bottom, headingGap: heading.top - box.top,
        cardGap: card.top - heading.bottom, left: card.left, right: card.right };
    });
    expect(Math.abs(geometry.gap)).toBeLessThan(2);
    expect(geometry.headingGap).toBeLessThanOrEqual(90);
    expect(geometry.cardGap).toBeGreaterThan(15);
    expect(geometry.cardGap).toBeLessThan(40);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    for (const zoom of ['100%', '200%']) {
      await page.evaluate(zoom => { document.documentElement.style.fontSize = zoom; }, zoom);
      const bounds = await section.locator('.homepage-section-heading > *, .homepage-section-heading__title').evaluateAll(nodes =>
        nodes.map(n => ({ width: n.clientWidth, scroll: n.scrollWidth })));
      bounds.forEach(b => expect(b.scroll).toBeLessThanOrEqual(b.width + 1));
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await section.locator('.homepage-section-heading').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`homepage-studio-${width}.jpg`) });
  });
}
