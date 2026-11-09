import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';
import { expandStudioGifts, expectStudioLaunchCopy } from './helpers/studio-promotion.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

const longName = 'Alexandriarosethegreatwithaverylongunbrokenname';
const names = ['Arabella', 'Erica', 'Erin', longName];
const promotion = page => page.locator('#santa-studio-promotion');
const gifts = page => promotion(page).locator('.studio-gifts');
const checker = page => page.locator('.hero-name-checker');
const mp3 = readFileSync('server/santa-audio/sleighbells.mp3');

async function enterWorkshop(page) {
  await page.route('**/api/santa-workshop-access', route => route.fulfill({
    json: { authorized: true, expiresAt: Date.now() + 3600000 },
  }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({
    json: workshopCatalogueFixture,
  }));
  await promotion(page).getByLabel('Voucher code', { exact: true }).fill('controlled-test-only');
  const lookup = page.waitForResponse(response => response.url().endsWith('/api/santa-names')
    && response.request().method() === 'POST');
  await promotion(page).getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
  await expect(page).toHaveURL(/\/bespoke-personalised-message-from-santa$/);
  await expect(page.getByRole('combobox', { name: 'Search recorded names', exact: true })).toBeVisible();
  await lookup;
}

for (const width of [390, 1440]) {
  for (const source of ['checked', 'free']) {
    test(`Workshop prefills ${source} recipient and allows changing it at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page);
      await chooseHero(page, 'Arabella');
      if (source === 'free') {
        await checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();
        await signup(page);
        await page.getByRole('button', { name: 'Create message', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
      }
      await enterWorkshop(page);
      const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
      await expect(input).toHaveValue('Arabella');
      await expect(input).toHaveAttribute('aria-expanded', 'false');
      await page.locator('.smw-button-next').click();
      await expect(page.locator('.smw-step-count')).toHaveText('Step 2 of 7');
      await page.locator('.smw-button-back').click();
      await input.fill('Er');
      await page.locator('.smw-button-next').click();
      await expect(page.locator('#smw-validation')).toHaveText('Please choose their name before continuing.');
      await input.focus();
      await page.getByRole('option', { name: 'Erin', exact: true }).click();
      await expect(input).toHaveValue('Erin');
      await expect(page.locator('.smw-button-next')).toBeEnabled();
      await page.locator('.smw-button-next').click();
      await page.locator('.smw-button-back').click();
      await expect(input).toHaveValue('Erin');
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Arabella|Erin/);
      await page.reload();
      await expect(input).toHaveValue('');
      await page.locator('.smw-button-next').click();
      await expect(page.locator('#smw-validation')).toHaveText('Please choose their name before continuing.');
    });
  }
}

test('Workshop prefill requires a choice for ambiguous recordings and never overwrites an edit', async ({ page }) => {
  await setup(page);
  await chooseHero(page, 'Arabella');
  await page.route('**/api/santa-names', route => {
    const query = route.request().postDataJSON().query;
    const records = query === 'Arabella'
      ? ['1', '2'].map(id => ({
        id, name: 'Arabella', variant: `Recording ${id}`, selectionToken: `fixture-${id}`,
        previewUrl: `/api/santa-name-preview?token=fixture-${id}`,
      }))
      : [{ id: 'erin', name: 'Erin', selectionToken: 'fixture-erin', previewUrl: '/api/santa-name-preview?token=fixture-erin' }];
    return route.fulfill({ json: { records } });
  });
  await enterWorkshop(page);
  const input = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
  await expect(input).toHaveValue('Arabella');
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.locator('.smw-button-next').click();
  await expect(page.locator('#smw-validation')).toHaveText('Please choose their name before continuing.');
  await input.focus();
  await page.getByRole('option', { name: 'Arabella Recording 2', exact: true }).click();
  await expect(page.locator('.smw-button-next')).toBeEnabled();
  await input.fill('Erin');
  await page.getByRole('option', { name: 'Erin', exact: true }).click();
  await expect(input).toHaveValue('Erin');
  await expect(page.locator('.smw-button-next')).toBeEnabled();
});

async function setup(page, { path = '/', cooldown = false } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ cooldown }) => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    sessionStorage.setItem('santa-radio-example-last', 'charlotte');
    if (cooldown) localStorage.setItem('santa-message-allowance', JSON.stringify({
      used: 1, availableAt: Date.now() + 2 * 3600000, cooldownMs: 2 * 3600000,
    }));
    window.__examplePauses = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {
      if (this.classList.contains('santa-message-example__audio')) window.__examplePauses++;
    };
    HTMLMediaElement.prototype.play = function () {
      if (this.classList.contains('santa-message-example__audio') && window.__holdExamplePlay) {
        return new Promise(resolve => { window.__resolveExamplePlay = resolve; });
      }
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
  }, { cooldown });
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 9774 } }));
  await page.route('**/api/santa-studio-checkout', route => route.fulfill({ json: { available: false } }));
  // Public choices come from the bundled display-name snapshot; the POST mock
  // below resolves a chosen name to a private recording separately.
  await page.route('**/names-data/*', route => route.fulfill({ json: names }));
  await page.route('**/api/santa-names', route => {
    expect(route.request().method()).toBe('POST');
    const query = route.request().postDataJSON().query.toLowerCase();
    return route.fulfill({ json: { warning: null, records: names.filter(name =>
      name.toLowerCase().startsWith(query)).map(name => ({
      id: name.toLowerCase(), name, selectionToken: 'controlled-fixture-token',
      previewUrl: '/api/santa-name-preview?token=controlled-fixture-token',
    })) } });
  });
  await mockBrevo(page);
  await page.route('**/api/santa-message', route => route.fulfill({ contentType: 'audio/mpeg', body: mp3 }));
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

for (const path of ['/', '/free-santa-message']) {
  for (const width of [320, 390, 1440]) {
    test(`Santa studio portrait expands smoothly and closes accessibly on ${path} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page, { path });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const trigger = page.getByRole('button', { name: 'Enlarge Santa’s studio picture', exact: true });
      const modal = page.getByRole('dialog', { name: 'Santa’s studio picture', exact: true });
      const close = page.getByRole('button', { name: 'Close Santa’s studio picture', exact: true });
      if (width < 768) {
        await expect(trigger).toHaveCount(0);
        await expect(promotion(page).locator('.santa-studio-promotion__preview')).toBeHidden();
        return;
      }
      await trigger.scrollIntoViewIfNeeded();
      const originalWidth = await trigger.evaluate(node => node.getBoundingClientRect().width);
      const originalOverflow = await page.evaluate(() => document.body.style.overflow);
      await trigger.click();
      await expect(modal).toBeVisible();
      await expect(close).toBeFocused();
      await expect(modal).toHaveCSS('animation-duration', '0.7s');
      await modal.evaluate(async node => {
        await Promise.all(node.getAnimations().map(animation => animation.finished));
      });
      const box = await modal.boundingBox();
      expect(box.width).toBeCloseTo(originalWidth * 3, 0);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
      await expect(modal.locator('img')).toHaveAttribute('src', '/images/santa-studio-headphones.webp');
      expect(await modal.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await modal.locator('img').click({ position: { x: 30, y: 100 } });
      await expect(modal).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('expanded-santa-portrait.png') });
      await close.click();
      await expect(modal).not.toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe(originalOverflow);
      // Keyboard activation and native Escape dismissal remain available.
      await trigger.press('Enter');
      await expect(modal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
      await expect(trigger).toBeFocused();
      // Respect reduced motion while preserving the full-size preview.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await trigger.click();
      await expect(modal).toHaveCSS('animation-name', 'none');
      await page.mouse.click(5, 5);
      await expect(modal).not.toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await trigger.evaluate(node => node.getBoundingClientRect().width)).toBe(originalWidth);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe(originalOverflow);
    });
  }
}

async function chooseHero(page, name) {
  const input = checker(page).getByRole('combobox');
  await input.fill(name);
  // A closing native dialog can restore focus after fill(), hiding the list.
  // Refocus with real keyboard input after the bounded lookup has completed.
  await expect(checker(page).getByRole('status')).toContainText('1 matching name.');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(checker(page).getByRole('status')).toHaveText(`Yes! Santa can record for ${name}.`);
}
async function matches(page, name) {
  await expandStudioGifts(promotion(page));
  await expect(gifts(page)).toHaveAttribute('data-demo-name', name);
  await expect(gifts(page).getByRole('heading')).toHaveCount(0);
  await expect(gifts(page).locator('.studio-gifts__thumbnail-label')).toHaveText([
    'Santa picture included', 'Letter included', 'Certificate included',
  ]);
  await expect(gifts(page).locator('.studio-certificate__name')).toHaveText(name);
  await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText(name);
  await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-gifts__sr')).toContainText(`Dear ${name},`);
  await expect(promotion(page).locator('.santa-studio-promotion__copy')).toContainText(
    `Create a personalised message from Santa, with ${name}’s age, achievements and the things that make them special for an extra personal touch.`);
  await expect(promotion(page).locator('.santa-studio-promotion__subheading')).toHaveText(`A little more Christmas magic for ${name}`);
  await expect(promotion(page).locator('.santa-studio-promotion__benefit-list li')).toHaveText([
    'An official Nice List certificate', 'A short personal letter from Santa',
    `Santa celebrating ${name}’s place on the Nice List`,
  ]);
  await expect(promotion(page).locator('.santa-studio-promotion__footnote')).toHaveCount(0);
  await expect(page.locator('.santa-message-example')).toHaveCount(0);
}
async function signup(page) {
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
  await expect(page.getByLabel('First Name', { exact: true })).toBeVisible();
}

test('promotional gifts and access controls reflow locally with a long recipient and enlarged text', async ({ page }, testInfo) => {
  await setup(page);
  await chooseHero(page, longName);
  await matches(page, longName);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  for (const width of [240, 320, 406, 987]) {
    await page.setViewportSize({ width, height: 1000 });
    const promo = promotion(page);
    const geometry = await promo.evaluate(root => {
      const rect = root.getBoundingClientRect();
      const controls = [...root.querySelectorAll('input, button')].filter(node =>
        !node.closest('dialog') && node.getClientRects().length > 0);
      return {
        left: rect.left, right: rect.right, fits: root.scrollWidth <= root.clientWidth + 1,
        scroll: root.scrollWidth, client: root.clientWidth,
        overflow: [...root.querySelectorAll('*')].filter(node => {
          const box = node.getBoundingClientRect();
          return !node.closest('dialog, .studio-gifts__sr, .studio-gifts__watermark') &&
            (box.width && (box.right > rect.right + 1 || box.left < rect.left - 1 ||
              node.scrollWidth > node.clientWidth + 1));
        }).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent.slice(0, 100),
          width: node.getBoundingClientRect().width, scroll: node.scrollWidth, client: node.clientWidth })),
        controls: controls.map(node => {
          const bounds = node.getBoundingClientRect();
          return { fits: node.scrollWidth <= node.clientWidth + 1,
            inside: bounds.left >= rect.left && bounds.right <= rect.right,
            height: bounds.height, minimumHeight: node.type === 'range' ? 30 : 44,
            className: node.className, scroll: node.scrollWidth, client: node.clientWidth };
        }),
      };
    });
    expect(geometry.fits, JSON.stringify({ width, geometry })).toBe(true);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
    for (const control of geometry.controls) {
      expect(control.fits, JSON.stringify({ width, control })).toBe(true);
      expect(control.inside).toBe(true);
      expect(control.height).toBeGreaterThanOrEqual(control.minimumHeight);
    }
    await expect(gifts(page)).toHaveAttribute('data-demo-name', longName);
    await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-gifts__watermark')).toHaveCount(3);
    await promo.screenshot({ path: testInfo.outputPath(`large-text-${width}.png`), animations: 'disabled' });
  }
});

for (const path of ['/', '/free-santa-message']) {
for (const width of [320, 360, 390, 406, 987, 1440]) {
  test(`Studio shared header separates identity and enlarged Recording on ${path} at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page, { path });
    const promo = promotion(page);
    await expandStudioGifts(promo);
    const divider = promo.locator('.santa-studio-promotion__header-divider');
    await expect(divider).toHaveCount(1);
    await expect(divider).toHaveAttribute('aria-hidden', 'true');
    await page.evaluate(() => document.fonts.ready);
    for (const fontSize of [100, 200]) {
      await page.addStyleTag({ content: `html { font-size: ${fontSize}%; }` });
      const geometry = await promo.evaluate(card => {
        const box = selector => {
          const { left, right, top, bottom } = card.querySelector(selector).getBoundingClientRect();
          return { left, right, top, bottom };
        };
        const line = card.querySelector('.santa-studio-promotion__header-divider');
        const border = node => {
          const style = getComputedStyle(node);
          return [style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor];
        };
        const count = box('.santa-studio-promotion__name-count');
        const recording = box('.message-recording-indicator');
        const dot = card.querySelector('.message-recording-dot');
        return {
          line: box('.santa-studio-promotion__header-divider'),
          shared: box('.santa-studio-promotion__header'),
          header: box('.santa-studio-promotion__topline'),
          portrait: box('.studio-portrait-trigger'),
          title: box('h3'),
          gifts: box('.studio-gifts__preview-stack'),
          dot: dot.getBoundingClientRect().toJSON(),
          animation: getComputedStyle(dot).animationName,
          recordingFont: parseFloat(getComputedStyle(card.querySelector('.message-recording-indicator')).fontSize),
          border: border(line),
          count, recording,
          cardOverflow: card.scrollWidth > card.clientWidth + 1,
          cardLeft: card.getBoundingClientRect().left,
          cardRight: card.getBoundingClientRect().right,
        };
      });
      expect(geometry.border.slice(0, 2)).toEqual(['1px', 'solid']);
      await expect(divider).toHaveCSS('border-bottom-color', 'rgba(212, 175, 55, 0.19)');
      expect(geometry.line.left).toBeCloseTo(geometry.shared.left, 1);
      expect(geometry.line.right).toBeCloseTo(geometry.shared.right, 1);
      expect(geometry.line.top).toBeGreaterThanOrEqual(Math.max(
        geometry.header.bottom, geometry.recording.bottom,
        ...(width >= 768 ? [geometry.portrait.bottom] : [])) + 13);
      expect(geometry.title.top - geometry.line.bottom).toBeGreaterThanOrEqual(13);
      for (const item of [geometry.count, geometry.recording, ...(width >= 768 ? [geometry.portrait] : [])]) {
        expect(item.left).toBeGreaterThanOrEqual(geometry.shared.left - 1);
        expect(item.right).toBeLessThanOrEqual(geometry.shared.right + 1);
        expect(item.bottom).toBeLessThan(geometry.line.top);
      }
      const disjoint = (a, b) => a.right <= b.left || b.right <= a.left ||
        a.bottom <= b.top || b.bottom <= a.top;
      expect(disjoint(geometry.header, geometry.recording)).toBe(true);
      expect(disjoint(geometry.portrait, geometry.recording)).toBe(true);
      expect(geometry.dot.width).toBeGreaterThanOrEqual(12);
      expect(geometry.recordingFont).toBeGreaterThanOrEqual(16);
      expect(geometry.animation).toBe('none');
      if (width >= 768) {
        expect(geometry.recording.left).toBeGreaterThan(geometry.header.right);
        expect(geometry.recording.right).toBeLessThanOrEqual(geometry.portrait.left);
        expect(geometry.portrait.right).toBeCloseTo(geometry.shared.right, 0);
        expect(geometry.gifts.top).toBeCloseTo(geometry.title.top, 0);
      } else {
        expect(geometry.gifts.top).toBeGreaterThan(geometry.title.bottom);
      }
      expect(geometry.cardOverflow).toBe(false);
      expect(geometry.cardLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.cardRight).toBeLessThanOrEqual(width);
    }
    await page.addStyleTag({ content: 'html { font-size: 100%; }' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(promo.locator('.message-recording-dot')).toHaveCSS('animation-name', 'santa-studio-recording-pulse');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await promo.screenshot({ path: testInfo.outputPath('studio-header-divider.png'), animations: 'disabled' });
  });
}
}

for (const width of [390, 1440]) {
  test(`confirmed hero child stops pending random audio and updates every gift before Continue at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1100 });
    await setup(page);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
    await expectStudioLaunchCopy(promotion(page));
    await page.evaluate(() => { window.__holdExamplePlay = true; });
    await page.getByRole('button', { name: 'Hear an example audio message' }).click();
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Harry');
    await chooseHero(page, 'Erica');
    await matches(page, 'Erica');
    expect(await page.evaluate(() => window.__examplePauses)).toBeGreaterThan(0);
    await page.evaluate(() => window.__resolveExamplePlay?.());
    await checker(page).getByRole('combobox').fill('Unknown');
    await matches(page, 'Erica');
    await chooseHero(page, 'Arabella');
    await matches(page, 'Arabella');
    for (const label of ['Enlarge certificate', 'Enlarge letter to read', 'Enlarge Santa’s Nice List picture']) {
      await gifts(page).getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', /Arabella/);
      await page.keyboard.press('Escape');
    }
    await chooseHero(page, longName);
    await matches(page, longName);
    await expectStudioLaunchCopy(promotion(page));
    await page.setViewportSize({ width: 320, height: 1100 });
    await expectStudioLaunchCopy(promotion(page));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await chooseHero(page, 'Erin');
    await page.setViewportSize({ width, height: 1100 });
    mkdirSync('generated-artifacts', { recursive: true });
    await promotion(page).screenshot({ path: `generated-artifacts/studio-chosen-recipient-${width}.jpg`, animations: 'disabled' });
    await checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();
    await mockBrevo(page, { message: 'Controlled refusal' }, 503);
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    await expect(page.locator('.santa-message-access__error')).toBeVisible();
    await matches(page, 'Erin');
    await mockBrevo(page);
    await signup(page);
    await matches(page, 'Erin');
    await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Erin');
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Erica|Arabella|Erin|Alexandria/);
    await page.reload();
    await expect(checker(page).getByRole('combobox')).toHaveValue('');
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  });
}

test('free-maker selection and generation retain recipient across navigation and cooldown reload', async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, { path: '/free-santa-message' });
  await signup(page);
  await page.getByLabel('First Name', { exact: true }).fill('Arabella');
  await page.getByRole('option', { name: 'Arabella', exact: true }).click();
  await matches(page, 'Arabella');
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
  await matches(page, 'Arabella');
  await page.locator('.message-result audio').evaluate(audio => audio.dispatchEvent(new Event('ended')));
  await matches(page, 'Arabella');
  await page.getByRole('link', { name: 'Apps', exact: true }).first().click();
  await page.goBack();
  await matches(page, 'Arabella');
  await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Arabella');
  await page.reload();
  await expect(page.locator('.studio-gifts [data-demo-name]')).toHaveCount(0);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expandStudioGifts(promotion(page));
  await expect(gifts(page).getByRole('button', { name: /Enlarge/ })).toHaveCount(3);
  await expect(gifts(page).getByRole('heading')).toHaveCount(0);
  await expect(page.locator('.santa-message-example')).toHaveCount(0);
  await expectStudioLaunchCopy(promotion(page));
});

test('late generation cannot replace a newer confirmed hero child', async ({ page }) => {
  await setup(page);
  await chooseHero(page, 'Arabella');
  await checker(page).getByRole('button', { name: 'Create my free Santa message →' }).click();
  await signup(page);
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Arabella');
  await expect(page.locator('.message-name-hint').filter({ hasText: 'Santa is ready to record for Arabella.' })).toBeVisible();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/santa-message', async route => {
    await pending;
    await route.fulfill({ contentType: 'audio/mpeg', body: mp3 });
  });
  await page.getByRole('button', { name: 'Create message', exact: true }).click();
  await expect(page.getByText('Santa is recording a personal message for Arabella. Hang on!')).toBeVisible();
  await chooseHero(page, 'Erin');
  await matches(page, 'Erin');
  release();
  await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
  await matches(page, 'Erin');
});

for (const width of [390, 1440]) {
test(`unknown-recipient cooldown keeps all three original example gifts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await setup(page, { cooldown: true });
  await expandStudioGifts(promotion(page));
  await expect(gifts(page).getByRole('heading')).toHaveCount(0);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expect(gifts(page).locator('.studio-certificate__name')).toHaveText('Edward');
  await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name')).toHaveText('Edward');
   await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-gifts__sr')).toContainText('Dear Edward,');
  for (const label of ['Enlarge certificate', 'Enlarge letter to read', 'Enlarge Santa’s Nice List picture']) {
    const button = gifts(page).getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('.santa-message-example')).toHaveCount(0);
  await expectStudioLaunchCopy(promotion(page));
  await promotion(page).screenshot({ path: `generated-artifacts/studio-cooldown-gifts-${width}.jpg`, animations: 'disabled' });
  await chooseHero(page, 'Erin');
  await matches(page, 'Erin');
});
}

for (const cooldown of [false, true]) {
test(`anonymous copy follows rotating examples${cooldown ? ' during cooldown' : ''} but a chosen child stays fixed through later cycles`, async ({ page }) => {
  await page.clock.install();
  await setup(page, { cooldown });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gifts(page).scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(10500);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expectStudioLaunchCopy(promotion(page));
  for (const exampleName of ['Erin', 'Charlotte', 'Freya', 'Harry', 'Arabella']) {
    await page.clock.runFor(10500);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', exampleName);
    await expectStudioLaunchCopy(promotion(page));
  }
  if (cooldown) await expect(page.locator('.santa-message-example')).toHaveCount(0);
  await page.clock.resume();
  await chooseHero(page, 'Erica');
  await matches(page, 'Erica');
  await gifts(page).scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(30000);
  await matches(page, 'Erica');
  await expectStudioLaunchCopy(promotion(page));
});
}
