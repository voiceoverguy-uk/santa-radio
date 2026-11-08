import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';
import { expectSampleWatermark } from './helpers/studio-sample-watermark.js';
import { expectHaloClearance, captureHalo } from './helpers/panel-halo.js';

const path = '/preview/hero-name-checker';
const heroCopy = {
  phone: {
    note: 'The World’s Best Christmas Radio Station · 24/7 - 365 Days',
    description: 'Your Christmas Radio Station all year round, along with festive treats, amazing free apps, games and FREE personalised messages from Santa.',
  },
  wide: {
    note: 'The World’s Best Christmas Radio Station · All year round',
    description: 'Your Christmas Radio Station all year round, along with festive treats, amazing free apps, games and FREE personalised messages from Santa.',
  },
};

async function expectHeroCopy(page, width) {
  const active = width < 768 ? 'phone' : 'wide';
  const inactive = width < 768 ? 'wide' : 'phone';
  for (const [selector, key] of [['.hero-note', 'note'], ['.hero-description', 'description']]) {
    const paragraph = page.locator(selector);
    await expect(paragraph).toHaveText(heroCopy[active][key], { useInnerText: true });
    await expect(paragraph.locator(`.hero-name-preview__copy--${inactive}`)).toBeHidden();
    const accessible = await paragraph.ariaSnapshot();
    expect(accessible.split(heroCopy[active][key])).toHaveLength(2);
    if (heroCopy[active][key] !== heroCopy[inactive][key]) expect(accessible).not.toContain(heroCopy[inactive][key]);
  }
}
const inventory = {
  hostedCount: 3, warning: null,
  records: ['Arabella', 'Erin', 'Erica'].map(name => ({
    id: name.toLowerCase(), name, selectionToken: 'controlled-fixture-token',
    previewUrl: '/api/santa-name-preview?token=controlled-fixture-token',
  })),
};
const checker = page => page.locator('.hero-name-checker');
const input = page => checker(page).getByRole('combobox');
const cta = page => checker(page).getByRole('button', { name: 'Create my free Santa message →' });
const blockedNote = "We won't find that spelling. Let's not use that word! It's Christmas.";

const checkerHalo = 'rgba(230, 206, 134, 0.19) 0px 0px 0px 1px, rgba(230, 206, 134, 0.27) 0px 0px 16px 3px, rgba(4, 16, 13, 0.4) 0px 20px 56px 0px, rgba(255, 248, 231, 0.05) 0px 0px 0px 1px inset, rgba(255, 248, 231, 0.063) 0px 1px 0px 0px inset';

for (const width of [320, 390, 768, 1091, 1440]) {
  test(`whole checker gold halo preserves geometry and suggestions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 });
    await setup(page);
    await page.route('**/names-data/*', route => route.fulfill({
      json: inventory.records.map(record => record.name),
    }));
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.hero-name-preview__checker');
    await card.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const before = await card.boundingBox();
    const background = await card.evaluate(el => getComputedStyle(el).background);
    const restingShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
    const restingBorder = await card.evaluate(el => getComputedStyle(el).borderTopColor);
    await expect(card).toHaveCSS('transition-duration', '0.18s, 0.18s');
    for (const target of [card, input(page), cta(page)]) {
      await target.hover();
      await expect(card).toHaveCSS('box-shadow', checkerHalo);
      await expect(card).toHaveCSS('border-top-color', 'rgb(230, 206, 134)');
      expect(await card.boundingBox()).toEqual(before);
    }
    expect(await card.evaluate(el => getComputedStyle(el).background)).toBe(background);
    await expectHaloClearance(card);
    await captureHalo(page, card, `checker-halo-${width}.png`, testInfo);
    await page.mouse.move(0, 0);
    await expect(card).toHaveCSS('box-shadow', restingShadow);
    await expect(card).toHaveCSS('border-top-color', restingBorder);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card.hover();
    await expect(card).toHaveCSS('transition-duration', '0s');
    await expect(card).toHaveCSS('box-shadow', checkerHalo);
    await input(page).click();
    await input(page).press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(input(page)).toBeFocused();
    await expect(input(page)).toHaveCSS('box-shadow', 'rgba(230, 206, 134, 0.25) 0px 0px 0px 3px');
    await input(page).fill('Er');
    const options = checker(page).getByRole('option');
    await expect(options).toHaveCount(2);
    await options.first().hover();
    await expect(card).toHaveCSS('box-shadow', checkerHalo);
    await expect(options.first()).toBeInViewport();
    await options.first().click();
    await expect(checker(page).getByRole('status')).toHaveText('Yes! Santa can record for Erica.');
    await input(page).fill('Ar');
    await expect(options).toHaveCount(1);
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(checker(page).getByRole('status')).toHaveText('Yes! Santa can record for Arabella.');
    await page.mouse.move(0, 0);
    await expect(card).toHaveCSS('box-shadow', restingShadow);
  });
}

test('touch-only checker retains its resting shadow after tapping and choosing a name', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: Boolean(process.env.REPLIT_DEV_DOMAIN),
  });
  try {
    const page = await context.newPage();
    await setup(page);
    await page.route('**/names-data/*', route => route.fulfill({
      json: inventory.records.map(record => record.name),
    }));
    await open(page);
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const card = page.locator('.hero-name-preview__checker');
    const restingShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
    expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
    await card.tap({ position: { x: 8, y: 8 } });
    await expect(card).toHaveCSS('box-shadow', restingShadow);
    await input(page).tap();
    await input(page).fill('Ar');
    await checker(page).getByRole('option', { name: 'Arabella', exact: true }).tap();
    await expect(checker(page).getByRole('status')).toHaveText('Yes! Santa can record for Arabella.');
    await expect(card).toHaveCSS('box-shadow', restingShadow);
  } finally {
    await context.close();
  }
});

for (const width of [320, 390]) {
  test(`abusive names cannot search or continue and the status fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    const queries = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/santa-names') queries.push(request.postDataJSON().query);
    });
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await choose(page, 'Arabella');
    const status = checker(page).getByRole('status');
    const searched = queries.length;
    for (const word of ['fuck', 'SHIT', 'cunt', 'wanker', 'ＦＵＣＫ', 'f.u.c.k', 'fu\u200bck', 'sh1t', 'fυсk']) {
      await input(page).fill(word);
      await expect(status).toHaveText(blockedNote);
      await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(checker(page).getByRole('option')).toHaveCount(0);
      await input(page).press('ArrowDown');
      await input(page).press('Enter');
      await expect(status).toHaveText(blockedNote);
      await cta(page).click();
      await expect(status).toHaveText(blockedNote);
      await expect(input(page)).toBeFocused();
    }
    // Wait beyond the search debounce: none of the blocked inputs reach the API.
    await page.waitForTimeout(300);
    expect(queries).toHaveLength(searched);
    await expect(page.locator('.santa-message-access')).toHaveCount(0);
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(await input(page).getAttribute('aria-describedby')).toBe(await status.getAttribute('id'));
    for (const size of ['100%', '200%']) {
      await page.evaluate(size => { document.documentElement.style.fontSize = size; }, size);
      const geometry = await status.evaluate(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = element => element.getBoundingClientRect().toJSON();
        return {
          box: rect(node), lines: [...range.getClientRects()].map(r => r.toJSON()),
          field: rect(node.closest('form').querySelector('input')),
          button: rect(node.closest('form').querySelector('[type="submit"]')),
        };
      });
      expect(geometry.box.left).toBeGreaterThanOrEqual(0);
      expect(geometry.box.right).toBeLessThanOrEqual(width);
      expect(geometry.field.bottom).toBeLessThanOrEqual(geometry.box.top);
      expect(geometry.box.bottom).toBeLessThanOrEqual(geometry.button.top);
      for (const line of geometry.lines) {
        expect(line.left).toBeGreaterThanOrEqual(geometry.box.left - .5);
        expect(line.right).toBeLessThanOrEqual(geometry.box.right + .5);
        expect(line.bottom).toBeLessThanOrEqual(geometry.box.bottom + .5);
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await checker(page).screenshot({ path: `generated-artifacts/name-language-${width}.jpg` });
    for (const name of ['Scunthorpe', 'Fuchsia', 'Dick', 'Fanny', 'Shital', 'UnknownName']) {
      await input(page).fill(name);
      await expect(status).toHaveText('We haven’t found that spelling. Try a shorter name or another spelling.');
    }
    await input(page).fill('Er');
    await expect(checker(page).getByRole('option')).toHaveCount(2);
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(status).toHaveText('Yes! Santa can record for Erica.');
    await cta(page).click();
    await expect(page).toHaveURL(/\/free-santa-message$/);
    await expect(page.locator('.santa-message-access h3')).toBeFocused();
  });
}

test('blocked input suppresses delayed results, network errors and submission validation', async ({ page }) => {
  await setup(page);
  let resolveSearch;
  const pending = new Promise(resolve => { resolveSearch = resolve; });
  let started;
  const requestStarted = new Promise(resolve => { started = resolve; });
  await page.route('**/names-data/*', async route => {
    started();
    await pending;
    await route.fulfill({ json: inventory.records.map(record => record.name) });
  });
  await open(page);
  await cta(page).click();
  await input(page).fill('Ar');
  await requestStarted;
  await input(page).fill('fuck');
  resolveSearch();
  await page.waitForTimeout(300);
  await expect(checker(page).getByRole('status')).toHaveText(blockedNote);
  await expect(checker(page).getByRole('option')).toHaveCount(0);
  await expect(checker(page).getByRole('button', { name: 'Retry name search' })).toHaveCount(0);
  // Once the public list has loaded, matching is local and does not expose
  // child queries to the private recording API.
  await input(page).fill('Er');
  await expect(checker(page).getByRole('option')).toHaveCount(2);
  await input(page).fill('shit');
  await input(page).press('Enter');
  await expect(checker(page).getByRole('status')).toHaveText(blockedNote);
  await expect(checker(page).getByRole('button', { name: 'Retry name search' })).toHaveCount(0);
});

for (const route of ['/', path]) {
  test(`Santa promotional heading has two gold regular Cinzel lines without clipping on ${route}`, async ({ page }) => {
    await setup(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto(route);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.evaluate(() => document.fonts.ready);
    const heading = checker(page).getByRole('heading', { level: 2, name: 'A FREE MESSAGE FROM SANTA', exact: true });
    await expect(checker(page).getByRole('heading')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'A FREE MESSAGE FROM SANTA', exact: true })).toBeVisible();
    await expect(checker(page).locator('.hero-name-checker__eyebrow')).toHaveCount(0);
    await expect(checker(page)).not.toContainText('Can Santa say your child’s name?');
    for (const width of [320, 390, 767, 768, 1024, 1090, 1091, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(heading).toHaveText('A FREE MESSAGE FROM SANTA');
      await expect(heading.locator('br')).toHaveCount(1);
      await expect(heading).toHaveText('A FREE MESSAGE\nFROM SANTA', { useInnerText: true });
      await expect(heading).toHaveCSS('font-weight', '400');
      await expect(heading).toHaveCSS('font-family', 'Cinzel, serif');
      await expect(heading).toHaveCSS('color', 'rgb(230, 206, 134)');
      const fontSize = await heading.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
      const previousSize = (width < 768 ? 1.3 : 1.56) * 16;
      expect(fontSize / previousSize).toBeGreaterThanOrEqual(1.2);
      expect(fontSize / previousSize).toBeLessThanOrEqual(1.25);
      const geometry = await heading.evaluate(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        // Inline emphasis can split one visual line into several DOM rects.
        const lines = [];
        for (const rect of [...range.getClientRects()].filter(rect => rect.width > 0)) {
          const line = lines.find(line => Math.abs(line.top - rect.top) < .5);
          if (line) {
            line.left = Math.min(line.left, rect.left);
            line.right = Math.max(line.right, rect.right);
            line.bottom = Math.max(line.bottom, rect.bottom);
          } else lines.push(rect.toJSON());
        }
        return {
          card: node.closest('.hero-name-preview__checker').getBoundingClientRect().toJSON(),
          label: node.parentElement.querySelector('label').getBoundingClientRect().toJSON(),
          lines,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.lines).toHaveLength(2);
      expect(geometry.lines[1].top).toBeGreaterThan(geometry.lines[0].top);
      expect(geometry.lines[1].bottom).toBeLessThanOrEqual(geometry.label.top);
      expect(geometry.pageWidth).toBeLessThanOrEqual(width);
      for (const line of geometry.lines) {
        expect(line.left).toBeGreaterThanOrEqual(Math.max(0, geometry.card.left) - .5);
        expect(line.right).toBeLessThanOrEqual(Math.min(width, geometry.card.right) + .5);
        expect(line.top).toBeGreaterThanOrEqual(geometry.card.top - .5);
        expect(line.bottom).toBeLessThanOrEqual(geometry.card.bottom + .5);
      }
    }
  });

  test(`shared hero copy, responsive font match and expanded countdown on ${route}`, async ({ page }) => {
    await setup(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto(route);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.evaluate(() => document.fonts.ready);
    await expect(checker(page).getByRole('status')).toHaveText('Check the name - let Santa create magic.');
    for (const width of [320, 390, 767, 768, 1024, 1090, 1091, 1440, 1740, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await expectHeroCopy(page, width);
      const radio = page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button');
      for (const playing of [false, true]) {
        if (playing) await radio.click();
        const layout = await page.locator('.hero').evaluate(hero => {
          const rect = node => node.getBoundingClientRect().toJSON();
          const get = selector => hero.querySelector(selector);
          const text = selector => {
            const node = get(selector), range = document.createRange();
            const activeCopy = [...node.children].find(child => getComputedStyle(child).display !== 'none');
            range.selectNodeContents(activeCopy || node);
            return { box: rect(node), font: getComputedStyle(node).fontSize,
              lines: [...range.getClientRects()].filter(r => r.width && r.height).map(r => r.toJSON()) };
          };
          return {
            hero: rect(hero), description: text('.hero-description'), note: text('.hero-note'),
            statusFont: getComputedStyle(get('.hero-name-checker__status')).fontSize,
            stack: rect(get('.hero-name-preview__left-stack')),
            countdown: rect(get('.hero-countdown')), tiles: [...hero.querySelectorAll('.countdown-unit')].map(rect),
            neighbours: ['.hero-actions', '.hero-countdown', '.hero-name-preview__checker', '.hero .now-playing-artwork']
              .map(get).filter(Boolean).map(rect),
            pageWidth: document.documentElement.scrollWidth,
          };
        });
        expect(layout.description.font).toBe(layout.statusFont);
        // The checker itself has not been resized to achieve the match.
        expect(layout.statusFont).toBe(width < 768 ? '12.16px' : '15.04px');
        expect(layout.pageWidth).toBeLessThanOrEqual(width);
        for (const text of [layout.description, layout.note]) {
          expect(text.lines.length).toBeGreaterThan(0);
          for (const line of text.lines) {
            expect(line.left).toBeGreaterThanOrEqual(text.box.left - .5);
            expect(line.right).toBeLessThanOrEqual(text.box.right + .5);
            expect(line.top).toBeGreaterThanOrEqual(text.box.top - .5);
            expect(line.bottom).toBeLessThanOrEqual(text.box.bottom + .5);
          }
          expect(text.box.bottom).toBeLessThanOrEqual(layout.hero.bottom);
          for (const box of layout.neighbours) {
            expect(text.box.right <= box.left + .5 || text.box.left >= box.right - .5 ||
              text.box.bottom <= box.top + .5 || text.box.top >= box.bottom - .5).toBe(true);
          }
        }
        expect(layout.tiles).toHaveLength(4);
        if (width >= 1091) {
          expect(layout.countdown.left).toBeCloseTo(layout.stack.left, 1);
          expect(layout.countdown.right).toBeCloseTo(layout.stack.right, 1);
          expect(layout.tiles[0].left).toBeCloseTo(layout.stack.left, 1);
          expect(layout.tiles[3].right).toBeCloseTo(layout.stack.right, 1);
          for (const tile of layout.tiles) expect(tile.height).toBeGreaterThanOrEqual(64);
        }
        if (width >= 1440) {
          expect(layout.note.lines).toHaveLength(1);
          expect(layout.note.lines[0].width / layout.stack.width).toBeGreaterThan(.9);
          for (const tile of layout.tiles) expect(tile.width).toBeGreaterThan(85);
        }
        if (width === 320) expect(layout.note.lines.length).toBeGreaterThan(1);
        if (playing) await radio.click();
      }
    }
    await page.clock.setFixedTime(new Date('2026-12-25T12:00:00Z'));
    await expect(page.locator('.hero-countdown .christmas-greeting')).toHaveText('Merry Christmas from Santa Radio!');
    await expect(page.locator('.hero-countdown .countdown')).toHaveCount(0);
  });
}

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
  if (!realInventory) {
    await page.route('**/names-data/*', route => route.fulfill({
      json: inventory.records.map(record => record.name),
    }));
    await page.route('**/api/santa-names', route => route.fulfill({ json: {
      ...inventory, records: inventory.records.filter(record =>
        record.name.toLowerCase().startsWith(route.request().postDataJSON().query.toLowerCase())),
    } }));
  }
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
  await expect(checker(page).getByRole('status')).toHaveText(`Yes! Santa can record for ${name}.`);
}

for (const width of [390, 1440]) {
  test(`homepage selection opens the dedicated signup for that child at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const introduction = page.locator('#santa-messages .santa-message-access__intro');
    const generic = 'Add your details and access a free personalised downloadable message from Santa.';
    await expect(introduction).toHaveCount(0);
    await input(page).fill('Arabella');
    await expect(checker(page).getByRole('option', { name: 'Arabella', exact: true })).toBeVisible();
    await expect(introduction).toHaveCount(0);
    await choose(page, 'Arabella');
    await expect(introduction).toHaveCount(0);
    await choose(page, 'Erin');
    await expect(introduction).toHaveCount(0);
    await input(page).fill('UnknownName');
    await expect(introduction).toHaveCount(0);
    await choose(page, 'Arabella');
    await cta(page).click();
    const adultFirstName = page.locator('#santa-messages input[name="FIRSTNAME"]');
    await expect(page).toHaveURL(/\/free-santa-message$/);
    await expect(page.locator('.santa-message-access h3')).toBeFocused();
    await expect(adultFirstName).toHaveValue('');
    await adultFirstName.fill('Testparent');
    await expect(introduction).toHaveText('Add your details and access a free personalised downloadable message for Arabella from Santa.');
    expect(page.url()).not.toMatch(/Arabella|Erin/);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Arabella|Erin/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync('generated-artifacts', { recursive: true });
    await page.locator('#santa-messages .santa-message-access').screenshot({
      path: `generated-artifacts/homepage-selected-name-${width}.jpg`, animations: 'disabled',
    });
    await page.reload();
    await expect(introduction).toHaveText(generic);
  });
}

for (const route of ['/', path]) {
  test(`desktop left inset preserves the shared hero geometry on ${route}`, async ({ page }, testInfo) => {
    await setup(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto(route);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.evaluate(() => document.fonts.ready);
    const measure = async () => {
      // Settle the checker ResizeObserver after viewport changes before reading.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return {
          moved: ['.hero-title', '.hero-name-preview__strapline', '.hero-description',
            '.hero-actions', '.hero-note', '.hero-countdown'].map(rect),
          fixed: ['.hero-layout', '.hero-name-preview__checker', '.navbar', '.hero-picture',
            '.santa-message-section'].map(rect),
          artwork: rect('.hero-name-preview__artwork-slot'),
          stack: rect('.hero-name-preview__left-stack'),
          pageWidth: document.documentElement.scrollWidth,
        };
      });
    };
    for (const width of [320, 390, 768, 1024, 1090, 1091, 1120, 1280, 1440, 1740, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const playing of [false, true]) {
        if (playing) {
          await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
          await expect(page.locator('.hero .now-playing-artwork')).toBeVisible();
        }
        const inset = await measure();
        // A zero inset is the previous layout, without changing any grid sizes.
        await page.locator('.hero-layout').evaluate(el => el.style.setProperty('--hero-left-inset', '0px'));
        const original = await measure();
        await page.locator('.hero-layout').evaluate(el => el.style.removeProperty('--hero-left-inset'));
        expect(inset.fixed).toEqual(original.fixed);
        expect(inset.pageWidth).toBeLessThanOrEqual(width);
        const shift = inset.moved[0].x - original.moved[0].x;
        if (width >= 1091 && width < 1920) expect(shift).toBeGreaterThan(0);
        else expect(shift).toBe(0);
        for (let i = 0; i < inset.moved.length; i++) {
          const before = original.moved[i], after = inset.moved[i];
          expect(after.x - before.x).toBeCloseTo(shift, 1);
          expect(after.y).toBe(before.y);
          expect(after.width).toBe(before.width);
          expect(after.height).toBe(before.height);
          if (width >= 1091) expect(after.x).toBeCloseTo(inset.moved[0].x, 1);
        }
        if (width >= 1091) {
          expect(inset.artwork.width).toBe(original.artwork.width);
          expect(inset.artwork.y).toBe(original.artwork.y);
          expect(inset.artwork.left - inset.stack.right).toBeGreaterThanOrEqual(15.5);
          expect(inset.artwork.right).toBeLessThan(inset.fixed[1].left);
          expect(inset.fixed[1].top).toBeCloseTo(inset.moved[0].top, 1);
        }
        if (width === 1740) {
          expect(inset.moved[0].left / width).toBeCloseTo(.144, 3);
          await page.locator('.hero').screenshot({
            path: testInfo.outputPath(`inset-hero-${playing ? 'playing' : 'idle'}.png`), animations: 'disabled',
          });
        }
        if (playing) await page.locator('.hero-actions').getByRole('button', { name: /Pause/ }).click();
      }
    }
  });

  for (const width of [1091, 1280, 1440, 1920]) {
    test(`raised card tracks the title without moving its neighbours on ${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));
      await setup(page);
      await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
      await page.goto(route);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator('.hero-name-preview__checker');
      const title = page.locator('.hero-title');
      const geometry = () => card.evaluate(el => {
        const rect = node => node.getBoundingClientRect().toJSON();
        const box = rect(el);
        return {
          box,
          contents: [...el.querySelectorAll('*')].map(node => {
            const r = rect(node);
            return { x: r.x - box.x, y: r.y - box.y, width: r.width, height: r.height };
          }),
          neighbours: [...document.querySelectorAll(
            '.navbar, .hero-title, .hero-halloween-greeting, .hero-name-preview__flag, ' +
            '.hero-name-preview__description, .hero-countdown, .hero-name-preview__artwork-slot, .santa-message-section',
          )].map(rect),
        };
      });
      for (const halloween of [true, false]) {
        if (!halloween) {
          await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
          await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        }
        await expect(page.locator('.hero-halloween-greeting')).toHaveCount(halloween ? 1 : 0);
        for (const playing of [false, true]) {
          if (playing) {
            await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
            await expect(page.locator('.hero .now-playing-artwork')).toBeVisible();
          }
          await page.mouse.move(0, 0);
          await expect.poll(async () => Math.abs((await card.boundingBox()).y - (await title.boundingBox()).y))
            .toBeLessThan(.5);
          const raised = await geometry();
          const nav = await page.locator('.navbar').boundingBox();
          expect(raised.box.top).toBeGreaterThanOrEqual(nav.y + nav.height);
          // Restore just the old visual position. Its grid footprint, size,
          // child spacing and every other hero element must be identical.
          await card.evaluate(el => { el.style.top = '0px'; });
          const original = await geometry();
          expect(original.box.top).toBeGreaterThan(raised.box.top + 20);
          expect(original.box.width).toBe(raised.box.width);
          expect(original.box.height).toBe(raised.box.height);
          expect(original.contents).toEqual(raised.contents);
          expect(original.neighbours).toEqual(raised.neighbours);
          await card.evaluate(el => { el.style.removeProperty('top'); });
          const collisions = await card.evaluate(el => {
            const box = el.getBoundingClientRect();
            const neighbours = [...document.querySelectorAll(
              '.hero-title, .hero-halloween-greeting, .hero-name-preview__description, .hero-name-preview__flag',
            )].flatMap(node => {
              const range = document.createRange();
              range.selectNodeContents(node);
              return [...range.getClientRects()];
            }).concat([...document.querySelectorAll('.hero .now-playing-artwork')].map(node => node.getBoundingClientRect()));
            return neighbours.some(r => r.right > box.left + .5 && r.left < box.right - .5 &&
              r.bottom > box.top + .5 && r.top < box.bottom - .5);
          });
          expect(collisions).toBe(false);
          if (playing) await page.locator('.hero-actions').getByRole('button', { name: /Pause/ }).click();
        }
      }
    });
  }

  test(`desktop raise is cleared on tablets and phones on ${route}`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    const card = page.locator('.hero-name-preview__checker');
    for (const width of [1440, 1024, 768, 390, 320, 1091]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width >= 1091) {
        await expect.poll(async () => Math.abs((await card.boundingBox()).y -
          (await page.locator('.hero-title').boundingBox()).y)).toBeLessThan(.5);
      } else {
        await expect(card).toHaveCSS('top', '0px');
        await expect.poll(() => page.locator('.hero-layout').evaluate(el =>
          el.style.getPropertyValue('--hero-checker-offset'))).toBe('');
        const box = await card.boundingBox();
        const intro = await page.locator('.hero-name-preview__intro').boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(intro.y + intro.height);
        if (width < 768) {
          const description = await page.locator('.hero-description').boundingBox();
          expect(box.y - description.y - description.height).toBeCloseTo(21, 0);
        }
      }
    }
  });
}

// Baseline at 1440px: 349.90625px card, 16px eyebrow, 48px field, 49px CTA.
// Measure real layout rather than transforms: larger text must have room to wrap.
for (const route of ['/', path]) {
  for (const width of [320, 390, 768, 1024, 1091, 1280, 1440, 1920]) {
    test(`enlarged name card fits ${route} at ${width}px with artwork and enlarged text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setup(page);
      await page.goto(route);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator('.hero-name-preview__checker');
      await expect(checker(page).getByRole('heading', { level: 2 })).toHaveText('A FREE MESSAGE FROM SANTA');
      await expect(checker(page).getByRole('status')).toHaveText('Check the name - let Santa create magic.');
      const initial = await card.boundingBox();
      if (width >= 1091) {
        const baselineWidth = Math.max(300, Math.min(width * .243, 350));
        expect(initial.width / baselineWidth).toBeGreaterThanOrEqual(1.18);
        expect(initial.width / baselineWidth).toBeLessThanOrEqual(1.22);
        expect(await input(page).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(57);
        expect(await cta(page).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(58);
      }
      if (width >= 768) expect(await checker(page).getByRole('heading', { level: 2 }).evaluate(el =>
        parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(19);
      const radio = page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button');
      for (const size of ['100%', '200%']) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, size);
        for (const playing of [false, true]) {
          if (playing) await radio.click();
          const geometry = await card.evaluate(el => {
            const rect = node => node.getBoundingClientRect().toJSON();
            const textRects = node => {
              const range = document.createRange();
              range.selectNodeContents(node);
              return [...range.getClientRects()].map(r => r.toJSON());
            };
            return {
              card: rect(el), hero: rect(el.closest('.hero')), viewport: innerWidth,
              formFlow: ['h2', 'label', 'input', '.hero-name-checker__status', '[type="submit"]']
                .map(selector => {
                  const node = el.querySelector(selector);
                  return { box: rect(node), lines: textRects(node).filter(r => r.width > 0) };
                }),
              pageWidth: document.documentElement.scrollWidth,
              heroContent: [...el.closest('.hero-layout').querySelectorAll('*')]
                .map(rect).filter(rect => rect.width > 0),
              controls: [...el.querySelectorAll('input, button')].map(node => ({
                box: rect(node), fits: node.scrollWidth <= node.clientWidth + 1,
                font: parseFloat(getComputedStyle(node).fontSize),
              })),
              text: [...el.querySelectorAll('p, h2, label, .hero-name-preview__checker-kicker')].map(node => ({
                box: rect(node), lines: textRects(node),
              })),
              neighbours: [
                ...document.querySelectorAll('.hero-title, .hero-halloween-greeting, .hero-name-preview__description'),
              ].flatMap(textRects).concat([
                ...document.querySelectorAll('.hero-countdown, .hero-name-preview__player-row, .hero .now-playing-artwork'),
              ].map(rect)),
            };
          });
          const { card: box } = geometry;
          // A pre-existing lower Mugshots pine decoration extends 8px beyond
          // the 320px homepage at 200% text. Keep this sizing check hero-scoped
          // there rather than changing an unrelated section to pass the test.
          if (route === '/' && width === 320 && size === '200%') {
            for (const content of geometry.heroContent) {
              expect(content.left).toBeGreaterThanOrEqual(-.5);
              expect(content.right).toBeLessThanOrEqual(width + .5);
            }
          } else expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(width + .5);
          expect(box.bottom).toBeLessThanOrEqual(geometry.hero.bottom + .5);
          for (const control of geometry.controls) {
            expect(control.box.left).toBeGreaterThanOrEqual(box.left);
            expect(control.box.right).toBeLessThanOrEqual(box.right);
            expect(control.box.bottom).toBeLessThanOrEqual(box.bottom);
            expect(control.fits).toBe(true);
            expect(control.font).toBeGreaterThanOrEqual(width >= 768 ? 14 : 12);
          }
          expect(geometry.controls[0].font).toBeGreaterThanOrEqual(16);
          for (let i = 0; i < geometry.formFlow.length - 1; i++) {
            const current = geometry.formFlow[i];
            const next = geometry.formFlow[i + 1];
            expect(current.box.bottom).toBeLessThanOrEqual(next.box.top + .5);
            for (const line of current.lines) expect(line.bottom).toBeLessThanOrEqual(next.box.top + .5);
          }
          for (const text of geometry.text) for (const line of text.lines) {
            expect(line.left).toBeGreaterThanOrEqual(text.box.left - .5);
            expect(line.right).toBeLessThanOrEqual(text.box.right + .5);
            // Cinzel ink can overhang its line box; the card does not clip it.
            expect(line.top).toBeGreaterThanOrEqual(box.top - .5);
            expect(line.bottom).toBeLessThanOrEqual(box.bottom + .5);
          }
          for (const neighbour of geometry.neighbours) {
            expect(neighbour.right <= box.left + .5 || neighbour.left >= box.right - .5 ||
              neighbour.bottom <= box.top + .5 || neighbour.top >= box.bottom - .5).toBe(true);
          }
          if (playing) await radio.click();
        }
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      // Exercise the enlarged dropdown at every breakpoint, including its bounds.
      await input(page).fill('Er');
      await expect(checker(page).getByRole('option')).toHaveCount(2);
      const list = await checker(page).getByRole('listbox').boundingBox();
      expect(list.x).toBeGreaterThanOrEqual(initial.x);
      expect(list.x + list.width).toBeLessThanOrEqual(initial.x + initial.width + .5);
      await input(page).press('ArrowDown');
      await input(page).press('Enter');
      await expect(input(page)).toHaveValue('Erica');
      await cta(page).click();
      await expect(page.locator(route === '/' ? '.santa-message-access h3' : '.santa-message-access input[name="FIRSTNAME"]')).toBeFocused();
    });
  }
}

for (const route of ['/', path]) {
  for (const width of [320, 390, 767, 768, 1440]) {
    test(`brand-first strapline and controls on ${route} at ${width}px, including enlarged text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setup(page);
      let submissions = 0;
      await page.route('**/api/santa-message', route => { submissions++; return route.abort(); });
      await page.goto(route);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      const hero = page.locator('.hero');
      const heading = hero.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText('Santa Radio MORE MAGIC FROM THE NORTH POLE');
      await expect(heading).toHaveAccessibleName('Santa Radio MORE MAGIC FROM THE NORTH POLE');
      await expect(hero.getByText('MORE MAGIC FROM THE NORTH POLE', { exact: true })).toHaveCount(1);
      await expect(hero).not.toContainText('Live from The North Pole');
      await expect(hero.locator('.hero-name-preview__eyebrow')).toHaveCount(0);
      await expect(hero.locator('.hero-name-preview__flag')).toHaveCount(route === path ? 1 : 0);
      await expectHeroCopy(page, width);
      if (route === path) await expect(hero.getByLabel('Preview only')).toBeVisible();
      for (const fontSize of ['100%', '200%']) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
        await expectHeroCopy(page, width);
        const copyGeometry = await hero.locator('.hero-description, .hero-note').evaluateAll(elements => elements.map(element => {
          const box = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return { box: box.toJSON(), lines: [...range.getClientRects()]
            .filter(rect => rect.width && rect.height).map(rect => rect.toJSON()) };
        }));
        for (const text of copyGeometry) {
          expect(text.lines.length).toBeGreaterThan(0);
          for (const line of text.lines) {
            expect(line.left).toBeGreaterThanOrEqual(text.box.left - .5);
            expect(line.right).toBeLessThanOrEqual(text.box.right + .5);
            expect(line.top).toBeGreaterThanOrEqual(text.box.top - .5);
            expect(line.bottom).toBeLessThanOrEqual(text.box.bottom + .5);
          }
        }
        const geometry = await heading.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          return {
            heading: rect.toJSON(),
            ink: [...range.getClientRects()].map(r => r.toJSON()),
            hero: el.closest('.hero').getBoundingClientRect().toJSON(),
            checker: document.querySelector('.hero-name-preview__checker').getBoundingClientRect().toJSON(),
            viewport: innerWidth,
          };
        });
        for (const ink of geometry.ink) {
          expect(ink.left).toBeGreaterThanOrEqual(-.5);
          expect(ink.right).toBeLessThanOrEqual(geometry.viewport + .5);
          expect(ink.top).toBeGreaterThanOrEqual(geometry.hero.top);
          expect(ink.bottom).toBeLessThanOrEqual(geometry.hero.bottom + .5);
          expect(ink.right <= geometry.checker.left + .5 || ink.bottom <= geometry.checker.top + .5).toBe(true);
        }
        expect(await heading.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      const listen = hero.getByRole('button', { name: 'Listen Live', exact: true });
      await listen.click();
      await expect(hero.locator('.now-playing-artwork')).toBeVisible();
      await hero.getByRole('button', { name: /Pause/ }).click();
      await expect(hero.locator('.now-playing-artwork')).toHaveCount(0);
      await choose(page, 'Arabella');
      await cta(page).click();
      await expect(page.locator(route === '/' ? '.santa-message-access h3' : '.santa-message-access input[name="FIRSTNAME"]')).toBeFocused();
      expect(submissions).toBe(0);
    });
  }
}

for (const width of [390, 1440]) {
  test(`homepage empty-name submit highlights and focuses the search at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await expect(input(page)).toHaveAttribute('aria-invalid', 'false');
    await expect(cta(page)).toBeEnabled();
    await cta(page).click();
    await expect(input(page)).toBeFocused();
    await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(input(page)).toHaveCSS('border-color', 'rgb(238, 164, 154)');
    expect(await input(page).evaluate(node => getComputedStyle(node).boxShadow)).toContain('155, 17, 30');
    await expect(checker(page).getByRole('status')).toHaveText('Please enter a child’s name, then choose a suggestion.');
    await expect(checker(page).getByRole('status')).toHaveCSS('color', 'rgb(255, 197, 184)');
    if (width === 390) await checker(page).screenshot({ path: 'test-results/hero-name-required-mobile.png' });
    await expect(page.locator('.santa-message-access')).toHaveCount(0);

    await input(page).fill('Ara');
    await expect(input(page)).toHaveAttribute('aria-invalid', 'false');
    await expect(checker(page).getByRole('option', { name: 'Arabella', exact: true })).toBeVisible();
    await input(page).press('Enter');
    await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(input(page)).toBeFocused();
    await expect(checker(page).getByRole('status')).toHaveText('Please choose one of Santa’s recorded names from the list.');
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(input(page)).toHaveAttribute('aria-invalid', 'false');
    await expect(checker(page).getByRole('status')).toHaveText('Yes! Santa can record for Arabella.');
    await cta(page).click();
    await expect(page.locator('.santa-message-access h3')).toBeFocused();
    await expect(page).toHaveURL(/\/free-santa-message$/);
  });
}

for (const width of [390, 1440]) {
  test(`checked names personalise all gifts with watermarked enlargements at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await setup(page);
    let creations = 0;
    await page.route('**/api/santa-message', route => { creations++; return route.abort(); });
    await open(page);
    const gifts = page.locator('.studio-gifts');
    await expect(gifts.getByRole('heading')).toHaveCount(0);
    await choose(page, 'Erica'); // Not one of the rotating/sample names.
    await cta(page).click();
    await expect(gifts).toHaveAttribute('data-demo-name', 'Erica');
    await gifts.scrollIntoViewIfNeeded();
    await expect(gifts.getByRole('heading')).toHaveCount(0);
    await expect(gifts.locator('.studio-certificate__name')).toHaveText('Erica');
    await expect(gifts.locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText('Erica');
    await expect(gifts.locator('.studio-gifts__preview-stack .studio-gifts__sr')).toContainText('Dear Erica,');
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.clock.runFor(10500);
    await expect(gifts.locator('.studio-gifts__preview-stack .studio-santa-picture > img')).toHaveAttribute('src', '/images/santa-nice-list-2.jpg');
    await page.clock.runFor(19500);
    await expect(gifts).toHaveAttribute('data-demo-name', 'Erica');
    await expect(gifts.locator('.studio-gifts__preview-stack .studio-gifts__watermark')).toHaveCount(3);
    for (const label of ['Enlarge certificate', 'Enlarge letter to read', 'Enlarge Santa’s Nice List picture']) {
      const thumbnail = gifts.getByRole('button', { name: label, exact: true });
      await expectSampleWatermark(thumbnail);
      await thumbnail.click();
      const dialog = page.getByRole('dialog');
      const watermark = dialog.locator('.studio-gifts__watermark');
      await expectSampleWatermark(dialog);
      const geometries = await watermark.locator('span').evaluateAll(elements => elements.map(el => ({
        ink: el.getBoundingClientRect().toJSON(),
        sheet: el.closest('.studio-letter-dialog__document').getBoundingClientRect().toJSON(),
        color: getComputedStyle(el).color,
        size: parseFloat(getComputedStyle(el).fontSize),
      })));
      for (const geometry of geometries) {
        expect(geometry.size / geometry.sheet.width).toBeGreaterThan(.159);
        expect(geometry.color).toBe('rgba(185, 20, 35, 0.45)');
        expect(geometry.ink.left).toBeGreaterThanOrEqual(geometry.sheet.left);
        expect(geometry.ink.right).toBeLessThanOrEqual(geometry.sheet.right);
        expect(geometry.ink.top).toBeGreaterThanOrEqual(geometry.sheet.top);
        expect(geometry.ink.bottom).toBeLessThanOrEqual(geometry.sheet.bottom);
      }
      for (let index = 1; index < geometries.length; index++) {
        const previous = geometries[index - 1], current = geometries[index];
        const separation = (current.ink.top + current.ink.height / 2) - (previous.ink.top + previous.ink.height / 2);
        expect(separation / current.sheet.height).toBeGreaterThan(.25);
      }
      if (width === 1440) await dialog.screenshot({ path: `test-results/personalised-${label.split(' ')[1]}-watermark.png` });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
    await input(page).fill('Arabella');
    await expect(checker(page).getByRole('status')).toHaveText('1 matching name. Choose a name from the list.');
    await input(page).press('ArrowDown');
    await expect(checker(page).getByRole('option', { name: 'Arabella', exact: true })).toBeVisible();
    await input(page).press('Enter');
    await cta(page).click();
    await expect(gifts).toHaveAttribute('data-demo-name', 'Arabella');
    await expect(gifts.getByRole('heading')).toHaveCount(0);
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    const maker = page.locator('.santa-message-box');
    await expect(maker.getByRole('combobox')).toBeVisible();
    await expect(gifts).toHaveAttribute('data-demo-name', 'Arabella');
    await maker.getByRole('combobox').fill('Erin');
    await maker.getByRole('option', { name: 'Erin', exact: true }).click();
    await expect(gifts).toHaveAttribute('data-demo-name', 'Erin');
    await expect(gifts.getByRole('heading')).toHaveCount(0);
    expect(creations).toBe(0);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Erica|Arabella|Erin/);
  });
}

test('real public display inventory drives lookup without private recording access or auto audio', async ({ page }) => {
  await setup(page, { realInventory: true });
  const record = { name: 'Arabella' };
  const requested = [];
  page.on('request', request => requested.push(request.url()));
  await open(page);
  await input(page).fill(record.name);
  await expect(checker(page).getByRole('option', { name: record.name, exact: true })).toBeVisible();
  expect(requested.filter(url => url.includes('/api/santa-names'))).toEqual([]);
  expect(requested.some(url => url.includes(encodeURIComponent(record.name)))).toBe(false);
  expect(await page.evaluate(() => window.__playCalls)).toBe(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(record.name);
  expect(new URL(page.url()).pathname).toBe(path);
  await cta(page).click();
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  expect(new URL(page.url()).pathname).toBe(path);
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
  await expect(input(page)).toHaveValue('Erin');
  await expect(cta(page)).toBeEnabled();
  await input(page).fill('Erica');
  await expect(cta(page)).toBeEnabled();
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
  await page.route('**/names-data/*', async route => {
    if (mode === 'loading') await waiting;
    await route.fulfill(mode === 'error' ? { status: 503, json: { error: 'Name search is temporarily unavailable.' } } : {
      json: inventory.records.map(record => record.name),
    });
  });
  await open(page);
  await input(page).fill('NotRecordedFixture');
  await expect(checker(page).getByRole('status')).toHaveText('Checking Santa’s recorded names…');
  mode = 'error';
  release();
  await expect(checker(page).getByRole('status')).toContainText('could not be loaded');
  await expect(checker(page).getByRole('status')).not.toContainText('haven’t found');
  mode = 'success';
  await checker(page).getByRole('button', { name: 'Retry name search' }).click();
  await expect(checker(page).getByRole('status')).toHaveText('We haven’t found that spelling. Try a shorter name or another spelling.');
  await cta(page).click();
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
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
  await expect(checker(page).getByRole('status')).not.toContainText('Yes!');
  await expect(input(page)).toHaveValue('Er');
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

for (const route of ['/', path]) {
test(`mobile hero places description before the complete checker and countdown after it on ${route}`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.goto(route);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.hero-description')).toHaveCount(1);
  const seconds = page.locator('.hero-countdown .countdown-unit strong').last();
  await page.clock.pauseAt(new Date('2026-11-01T12:00:10Z'));
  const before = await seconds.textContent();
  await page.clock.runFor(1000);
  await expect(seconds).not.toHaveText(before);
  await page.clock.resume();
  const measure = () => page.locator('.hero').evaluate(hero => {
    const box = selector => hero.querySelector(selector).getBoundingClientRect().toJSON();
    return {
      title: box('.hero-title'), listen: box('.hero-name-preview__player-row'),
      note: box('.hero-note'), checker: box('.hero-name-preview__checker'),
      description: box('.hero-description'), submit: box('.hero-name-checker__submit'),
      countdown: box('.hero-countdown'),
      artwork: hero.querySelector('.now-playing-artwork') ? box('.now-playing-artwork') : null,
      list: hero.querySelector('[role="listbox"]') ? box('[role="listbox"]') : null,
      content: [...hero.querySelectorAll('*')].map(node => node.getBoundingClientRect().toJSON())
        .filter(rect => rect.width > 0),
    };
  });
  const assertOrder = bounds => {
    expect(bounds.listen.top).toBeGreaterThanOrEqual(bounds.title.bottom);
    expect(bounds.note.top).toBeGreaterThanOrEqual(bounds.listen.bottom);
    expect(bounds.description.top).toBeGreaterThanOrEqual(bounds.note.bottom);
    expect(bounds.checker.top - bounds.description.bottom).toBeCloseTo(21, 0);
    expect(bounds.submit.bottom).toBeLessThanOrEqual(bounds.checker.bottom);
    // Retain the countdown's existing 13px top margin plus the 21px grid gap.
    expect(bounds.countdown.top - bounds.checker.bottom).toBeCloseTo(34, 0);
    if (bounds.artwork) expect(bounds.artwork.top).toBeGreaterThanOrEqual(bounds.countdown.bottom);
  };
  for (const width of [320, 390, 767]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const fontSize of ['100%', '200%']) {
      await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
      await expectHeroCopy(page, width);
      for (const playing of [false, true]) {
        if (playing) await page.locator('.hero-actions button').click();
        assertOrder(await measure());
        await input(page).fill('Er');
        await page.clock.runFor(500);
        await expect(checker(page).getByRole('option')).toHaveCount(2);
        const expanded = await measure();
        assertOrder(expanded);
        expect(expanded.list.left).toBeGreaterThanOrEqual(expanded.checker.left);
        expect(expanded.list.right).toBeLessThanOrEqual(expanded.checker.right);
        expect(expanded.list.top).toBeGreaterThanOrEqual(expanded.description.bottom);
        expect(expanded.list.bottom).toBeLessThanOrEqual(expanded.countdown.top);
        for (const box of expanded.content) {
          expect(box.left).toBeGreaterThanOrEqual(-.5);
          expect(box.right).toBeLessThanOrEqual(width + .5);
        }
        // The lower homepage has a pre-existing decoration overflow at 320px
        // with 200% text; verify the entire hero above without changing it.
        if (!(route === '/' && width === 320 && fontSize === '200%')) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        }
        await input(page).press('ArrowDown');
        await input(page).press('Enter');
        await expect(input(page)).toHaveValue('Erica');
        await expect(page.locator('.radio-dock')).toBeVisible();
        if (fontSize === '100%' && !playing) {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await page.screenshot({ path: testInfo.outputPath(`mobile-order-${width}.png`) });
        }
        if (playing) await page.locator('.hero-actions button').click();
      }
    }
    await cta(page).click();
    await expect(page.locator(route === '/' ? '.santa-message-access h3' : '.santa-message-access input[name="FIRSTNAME"]')).toBeFocused();
    await expect(page.locator('.hero-actions button')).toHaveCount(route === '/' ? 0 : 1);
    await expect(input(page)).toHaveCount(route === '/' ? 0 : 1);
    await expect(page.locator('.hero input[type="checkbox"]')).toHaveCount(0);
    if (route === '/') await page.goBack();
  }
});
}

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
    // The compact card sits beside the introduction, with its bottom aligned
    // to the countdown rather than stretched to a fixed height.
    expect(picture.x).toBeLessThan(width * .48);
    // The longer copy may start just above the compact, bottom-aligned cover.
    expect(picture.y).toBeLessThan(description.y + description.height);
    const strapline = await page.locator('.hero-name-preview__strapline').boundingBox();
    expect(strapline.x + strapline.width).toBeLessThanOrEqual(before.x);
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

for (const width of [1091, 1280, 1440, 1920, 768, 390, 320]) {
  test(`playing artwork has no empty footer and aligns with the desktop countdown at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    for (const [index, song] of [
      { artist: 'Mariah Carey', title: 'Oh Santa' },
      { artist: 'A Christmas Artist With A Longer Name', title: 'A Longer Christmas Song Title For The Festive Season' },
    ].entries()) {
      await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
        current: song, currentStatus: 'ready', upcoming: [], upcomingStatus: 'ready',
      } }));
      await page.goto('/');
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
      const slot = page.locator('.hero-name-preview__artwork-slot');
      const caption = slot.locator('.now-playing-artwork__caption');
      await expect(caption).toContainText(song.title);
      const measure = () => slot.evaluate(el => {
        const rect = node => node.getBoundingClientRect().toJSON();
        return { card: rect(el), image: rect(el.querySelector('.now-playing-artwork__image')),
          caption: rect(el.querySelector('.now-playing-artwork__caption')),
          countdown: rect(document.querySelector('.hero-countdown')),
          viewport: innerWidth };
      });
      const bounds = await measure();
      expect(bounds.card.bottom - bounds.caption.bottom).toBeGreaterThanOrEqual(9);
      expect(bounds.card.bottom - bounds.caption.bottom).toBeLessThanOrEqual(11);
      expect(bounds.image.width).toBeCloseTo(bounds.image.height, 1);
      expect(bounds.card.right).toBeLessThanOrEqual(bounds.viewport);
      if (width >= 1091) expect(Math.abs(bounds.card.bottom - bounds.countdown.bottom)).toBeLessThan(1);
      if (index === 0) await page.locator('.hero').screenshot({
        path: `test-results/compact-playing-artwork-${width}.png`, animations: 'disabled',
      });
      // The live card must stay aligned when the available space changes.
      if (width >= 1091) {
        await page.setViewportSize({ width: width + 80, height: 850 });
        const resized = await measure();
        expect(Math.abs(resized.card.bottom - resized.countdown.bottom)).toBeLessThan(1);
        await page.setViewportSize({ width, height: 1000 });
      }
    }
  });
}

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
  expect(await response.text()).toContain('A FREE MESSAGE <br/>FROM SANTA');
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

for (const width of [1440, 390]) test(`approved homepage handoff and left-aligned radio/countdown at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await setup(page);
  let renders = 0;
  await page.route('**/api/santa-message', route => { renders++; return route.abort(); });
  const requested = [];
  page.on('request', request => requested.push(request.url()));
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const button = await page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button').boundingBox();
  const countdown = await page.locator('.hero-countdown .countdown').boundingBox();
  expect(countdown.width).toBeGreaterThanOrEqual(button.width);
  if (width >= 1091) {
    const stack = await page.locator('.hero-name-preview__left-stack').boundingBox();
    expect(countdown.width).toBeCloseTo(stack.width, 1);
  }
  if (width >= 768) expect(Math.abs(button.x - countdown.x)).toBeLessThan(1);
  const heading = await page.locator('.hero-title').boundingBox();
  const description = await page.locator('.hero-description').boundingBox();
  if (width >= 768) {
    expect(description.y - heading.y - heading.height).toBeGreaterThanOrEqual(12);
    expect(description.y - heading.y - heading.height).toBeLessThanOrEqual(24);
  }
  await choose(page, 'Arabella');
  await cta(page).click();
  await expect(page.locator('.santa-message-access h3')).toBeFocused();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveCount(0);
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Arabella');
  expect(new URL(page.url()).pathname).toBe('/free-santa-message');
  expect(requested.some(url => url.includes('Arabella'))).toBe(false);
  expect(renders).toBe(0);
});

test('mobile name entry avoids automatic-zoom sizing and keeps the form stable as the keyboard opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.evaluate(() => document.fonts.ready);
  await input(page).scrollIntoViewIfNeeded();
  await input(page).focus();
  expect(await input(page).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  const geometry = () => input(page).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y + window.scrollY, width: box.width };
  });
  const before = await geometry();
  await input(page).fill('Ara');
  await expect(checker(page).getByRole('option', { name: 'Arabella', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 440 });
  const after = await geometry();
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(Math.abs(after.width - before.width)).toBeLessThan(1);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
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
