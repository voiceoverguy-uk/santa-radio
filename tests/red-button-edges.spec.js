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

async function checkEdge(control, width = '1px') {
  await control.evaluate(node => node.blur());
  await expect(control).toBeVisible();
  await expect(control).toHaveCSS('border-top-style', 'solid');
  await expect(control).toHaveCSS('border-top-width', width);
  await expect(control).toHaveCSS('border-top-color', edge);
}

for (const width of [390, 1440]) {
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
    await checkEdge(page.locator('.mugshots-gallery-button'), '2px');
    await checkEdge(page.locator('.christmas-pairs__button--ruby').first());
    await checkEdge(page.locator('.radio-play'));
    if (width < 768) {
      await checkEdge(page.locator('.nav-radio-icon'));
      await page.locator('.hamburger').click();
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

test('Studio red states use the gift edge without changing geometry or non-red controls', async ({ page }) => {
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
      <button class="smw-button smw-button-back">Back</button>
      <div class="tracker-banner"><a class="tracker-action" href="#edge-fixture">Track Santa</a></div>
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
  await expect(fixture.locator('.smw-button-next:disabled')).toHaveCSS('border-top-color', bright);
  await expect(fixture.locator('.smw-button-next:disabled')).toHaveCSS('opacity', '0.48');
  await expect(fixture.locator('.smw-button-back')).toHaveCSS('border-top-color', 'rgba(212, 175, 55, 0.333)');
  await expect(fixture.locator('.studio-gift-download button:disabled')).toHaveCSS('background-color', 'rgb(247, 239, 217)');
});
