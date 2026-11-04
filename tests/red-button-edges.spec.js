import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';

// Chromium rounds eight-digit hex alpha differently across versions.
const edge = /^rgba\(228, 197, 102, 0\.50?2?\)$/;
const bright = 'rgb(230, 206, 134)';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = function () {};
  });
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

async function visit(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.mouse.move(0, 0);
}

test('staff sign-in uses the shared red treatment without submitting credentials', async ({ page }) => {
  await visit(page, '/sign-in');
  const action = page.locator('.staff-red-action').first();
  await checkEdge(action);
  await action.hover();
  await expect(action).toHaveCSS('border-top-color', bright);
});

async function checkEdge(control, width = '1px') {
  await control.evaluate(node => node.blur());
  await expect(control).toBeVisible();
  await expect(control).toHaveCSS('border-top-style', 'solid');
  await expect(control).toHaveCSS('border-top-width', width);
  await expect(control).toHaveCSS('border-top-color', edge);
  await expect(control).toHaveCSS('min-height', '44px');
  await expect(control).toHaveCSS('border-radius', '7px');
  const geometry = await control.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { height: rect.height, overflow: node.scrollWidth > node.clientWidth + 1,
      shadow: style.boxShadow, fill: style.backgroundColor };
  });
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.overflow).toBe(false);
  expect(geometry.shadow).toContain('inset');
  expect(geometry.fill).toBe('rgb(155, 17, 30)');
}

for (const width of [320, 390, 1440]) {
  test(`homepage and navigation red controls keep gold edges at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/');
    const hero = page.locator('.hero-name-checker__submit');
    await checkEdge(hero);
    await hero.hover();
    await expect(hero).toHaveCSS('border-top-color', bright);
    // Real keyboard navigation activates :focus-visible, unlike pointer focus.
    await hero.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(hero).toBeFocused();
    await expect(hero).toHaveCSS('border-top-color', bright);
    await expect(hero).toHaveCSS('outline-style', 'solid');
    await expect(hero).toHaveCSS('outline-width', '2px');

    await page.mouse.move(0, 0);
    await hero.blur();
    await checkEdge(page.locator('.home-page .contact-section .contact-btn'));
    await checkEdge(page.locator('.mugshots-gallery-button'));
    await checkEdge(page.locator('.christmas-pairs__button--ruby').first());
    await checkEdge(page.locator('.radio-play'));
    if (width < 768) {
      await checkEdge(page.locator('.nav-radio-icon'));
      await page.locator('.hamburger').click();
    } else {
      await expect(page.locator('.nav-radio-icon')).toBeHidden();
    }
    const navigation = page.locator('.nav-message');
    await checkEdge(navigation);
    await navigation.click();
    await expect(page).toHaveURL(/\/free-santa-message$/);
  });

  test(`message and contact red actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/free-santa-message');
    const message = page.locator('main .btn-red').first();
    await checkEdge(message);
    await message.hover();
    await expect(message).toHaveCSS('border-top-color', bright);
    await visit(page, '/submit-a-song?mode=song');
    const submit = page.locator('.song-submit-button');
    await checkEdge(submit);
    await submit.hover();
    await expect(submit).toHaveCSS('border-top-color', bright);
    // Invalid native form submission must stay on this form.
    await submit.click();
    await expect(page).toHaveURL(/submit-a-song/);
    await expect(page.locator('form :invalid').first()).toBeVisible();
  });
}

test('Studio red states share gift geometry while non-red controls retain their appearance', async ({ page }) => {
  await visit(page, '/');
  // Style fixture only: do not bypass the real Studio's access gate or
  // manufacture a successful message. All styles come from the real app.
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'edge-fixture';
    fixture.className = 'smw-page';
    fixture.innerHTML = `
      <button class="smw-header-continue">Continue</button>
      <button class="smw-name-preview-button">Play</button>
      <button class="smw-button smw-button-next">Create</button>
      <a href="#edge-fixture" class="smw-button smw-button-download">Download</a>
      <button class="smw-button smw-button-next" disabled>Unavailable</button>
      <button class="smw-button smw-button-next smw-create-disabled" disabled>Unavailable creation</button>
      <button class="smw-button smw-button-back">Back</button>
      <div class="tracker-banner"><a class="tracker-action inline-flex items-center gap-2 px-6 py-3 text-sm" href="#edge-fixture">Track Santa</a></div>
      <div class="studio-gift-download"><button>Download gift</button>
        <button disabled>Preparing gift</button></div>`;
    document.body.append(fixture);
  });
  const fixture = page.locator('#edge-fixture');
  for (const selector of ['.smw-header-continue', '.smw-name-preview-button', '.smw-button-next:not(:disabled)', '.smw-button-download', '.studio-gift-download button:not(:disabled)', '.tracker-action']) {
    const control = fixture.locator(selector);
    await checkEdge(control);
    const before = await control.evaluate(node => {
      const style = getComputedStyle(node);
      return [node.offsetWidth, node.offsetHeight, style.borderRadius, style.padding];
    });
    await control.hover();
    await expect(control).toHaveCSS('border-top-color', bright);
    const after = await control.evaluate(node => {
      const style = getComputedStyle(node);
      return [node.offsetWidth, node.offsetHeight, style.borderRadius, style.padding];
    });
    expect(after).toEqual(before);
    await page.mouse.move(0, 0);
  }
  await expect(fixture.locator('.smw-button-next:disabled').first()).toHaveCSS('border-top-color', bright);
  await expect(fixture.locator('.smw-button-next:disabled').first()).toHaveCSS('opacity', '0.48');
  await expect(fixture.locator('.smw-create-disabled')).toHaveCSS('background-color', 'rgb(64, 84, 74)');
  await expect(fixture.locator('.smw-create-disabled')).toHaveCSS('opacity', '1');
  await expect(fixture.locator('.smw-button-back')).toHaveCSS('border-top-color', 'rgba(212, 175, 55, 0.333)');
  await expect(fixture.locator('.smw-button-back')).toHaveCSS('border-radius', '14px');
  await expect(fixture.locator('.smw-button-back')).toHaveCSS('min-height', '56px');
  await expect(fixture.locator('.studio-gift-download button:disabled')).toHaveCSS('background-color', 'rgb(247, 239, 217)');
});

for (const width of [320, 1440]) {
  test(`all red action families match gift sizing and support wrapping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/');
    // Exercise actual styles for gated/conditional controls without granting
    // access, submitting forms, playing audio or creating fake downloads.
    await page.evaluate(() => {
      const fixture = document.createElement('section');
      fixture.id = 'red-geometry-fixture';
      fixture.style.cssText = 'position:relative;padding:20px;display:grid;gap:16px;max-width:100%;';
      fixture.innerHTML = `
        <button class="btn-red">FREE Santa Message</button>
        <div class="smw-page" style="padding:0;min-height:0">
          <button class="smw-button smw-button-next">Create message</button>
          <a class="smw-button smw-button-download" href="#red-geometry-fixture">Download MP3</a>
          <button class="smw-header-continue">Continue</button>
          <button class="smw-name-preview-button" aria-label="Play name">
            <svg width="20" height="20" aria-hidden="true"><path d="M4 2L18 10L4 18Z"/></svg>
          </button>
        </div>
        <div class="studio-gift-download"><button>Download gift</button></div>
        <button class="lyrics-toggle-btn">Show lyrics</button>
        <a class="karaoke-link" href="#red-geometry-fixture">Karaoke</a>
        <button class="load-more-btn">Load more</button>
        <button class="suggest-btn">Suggest</button>
        <button class="contender-vote-button">Vote</button>
        <div class="contenders-alert"><button>Try again</button></div>
        <button class="staff-red-action">Continue</button>
        <div class="mugshots-sort"><button aria-pressed="true">Newest</button></div>
        <button class="soundboard-stop" aria-label="Stop sound"><span class="soundboard-stop-square" aria-hidden="true"></span></button>
        <div class="santa-studio-promotion">
          <form class="workshop-password-form--promotion"><button type="button">Continue</button></form>
        </div>
        <button class="btn-red wrap-check" style="width:150px">Create a free Santa message with a longer label</button>
        <button class="btn-red" disabled>Unavailable</button>`;
      document.body.append(fixture);
    });
    const fixture = page.locator('#red-geometry-fixture');
    const red = fixture.locator('button:not(:disabled), a');
    for (const control of await red.all()) {
      await checkEdge(control);
      if (!(await control.getAttribute('class'))?.includes('wrap-check')) {
        const label = await control.textContent();
        const height = await control.evaluate(node => node.getBoundingClientRect().height);
        expect(height, label).toBeLessThanOrEqual(46);
      }
    }
    const wrapped = fixture.locator('.wrap-check');
    expect(await wrapped.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(44);
    await wrapped.hover();
    await wrapped.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(wrapped).toBeFocused();
    await expect(wrapped).toHaveCSS('outline-style', 'solid');
    await expect(wrapped).toHaveCSS('border-top-color', bright);
    const disabled = fixture.locator('.btn-red:disabled');
    await expect(disabled).toHaveCSS('background-color', 'rgb(155, 17, 30)');
    await expect(disabled).toHaveCSS('border-top-color', bright);
    await expect(disabled).toHaveCSS('opacity', '0.65');
    await expect(disabled).toHaveCSS('border-radius', '7px');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const control of await red.all()) {
      const label = await control.getAttribute('class');
      const readable = await control.evaluate(node => ({
        height: node.getBoundingClientRect().height,
        fits: node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1,
      }));
      expect(readable.height).toBeGreaterThanOrEqual(44);
      expect(readable.fits, label).toBe(true);
    }
  });
}

for (const width of [390, 1440]) {
  test(`Apps image badges stay transparent and unpadded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/apps');
    const badges = page.locator('.apps-page .app-dl-btn');
    expect(await badges.count()).toBeGreaterThan(0);
    for (const badge of await badges.all()) {
      await expect(badge).toBeVisible();
      await expect(badge.locator('img')).toHaveAttribute('src', '/images/download-on-the-app-store.svg');
      const destination = await badge.getAttribute('href');
      expect(destination).toMatch(/^https:\/\/(?:apps|itunes)\.apple\.com\//);
      await expect(badge).toHaveAttribute('target', '_blank');
      for (const state of ['rest', 'hover', 'focus']) {
        if (state === 'hover') await badge.hover();
        if (state === 'focus') {
          await badge.press('Tab');
          await page.keyboard.press('Shift+Tab');
          await expect(badge).toBeFocused();
          await expect(badge).toHaveCSS('outline-style', 'solid');
        }
        await expect(badge).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(badge).toHaveCSS('padding', '0px');
        await expect(badge).toHaveCSS('border-top-width', '0px');
        await expect(badge).toHaveCSS('border-radius', '8px');
        await expect(badge).toHaveCSS('box-shadow', 'none');
        const size = await badge.boundingBox();
        expect(size.width).toBeCloseTo(150, 0);
        expect(size.height).toBeCloseTo(50, 0);
      }
    }
  });
}
