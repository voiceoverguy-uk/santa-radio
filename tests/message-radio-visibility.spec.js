import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from './helpers/provider-test.js';
import { fillAccessForm } from './helpers/message-access.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { confirmMessage, mockStudioGeneration } from './helpers/studio-generation.js';

async function fixtures(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.radioCalls = { play: 0, pause: 0, load: 0 };
    for (const method of ['play', 'pause', 'load']) {
      HTMLMediaElement.prototype[method] = function () {
        if (this.src.includes('citrus3')) window.radioCalls[method]++;
        return method === 'play' ? Promise.resolve() : undefined;
      };
    }
  });
  let authorized = false;
  await page.route('**/api/santa-message-access', route => {
    if (route.request().method() === 'POST') authorized = true;
    return route.fulfill({ json: route.request().method() === 'POST'
      ? { success: true } : { authorized, availableAt: 0 } });
  });
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { currentStatus: 'unavailable', upcomingStatus: 'unavailable', upcoming: [] },
  }));
  await page.route('**/api/santa-names', route => route.fulfill({
    json: { records: [{ id: 'dixie-variant', name: 'Dixie', selectionToken: 'fixture-token',
      previewUrl: '/api/santa-name-preview?token=fixture-token' }], hostedCount: 1 },
  }));
  await page.route('**/api/santa-name-preview?*', route => route.fulfill({
    contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
  }));
  await page.route('**/api/santa-workshop-access', route => route.fulfill({
    json: { authorized: false },
  }));
  await page.route('**/api/santa-studio-access', route => route.fulfill({
    json: { authorized: false },
  }));
  await page.route('**/api/santa-workshop-catalogue*', route => route.fulfill({ json: workshopCatalogueFixture }));
}

async function open(page, path = '/') {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

async function position(page, where) {
  await page.evaluate(where => {
    window.dispatchEvent(new Event('touchstart'));
    const card = document.querySelector('.santa-message-box');
    const y = card.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: where === 'card' ? y - 110
      : where === 'edge' ? y - innerHeight + 8 : 0, behavior: 'instant' });
  }, where);
}

async function hiddenDock(page) {
  const dock = page.locator('.radio-dock');
  await expect(dock).toBeHidden();
  await expect(dock).toHaveAttribute('hidden', '');
  await expect(dock).toHaveAttribute('inert', '');
  await expect(page.getByRole('complementary', { name: 'Santa Radio player' })).toHaveCount(0);
  expect(await dock.evaluate(node => node.getBoundingClientRect().height)).toBe(0);
}

async function navigate(page, path) {
  // Real SPA links retain the provider and dock state (including mobile menu).
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(`.navbar-links a[href="${path}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

for (const width of [390, 1440]) {
  for (const expanded of [false, true]) {
    test(`inline signup visibility, focus, viewport and restoration ${width} expanded=${expanded}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await fixtures(page);
      await open(page);
      const dock = page.locator('.radio-dock');
      await expect(dock).toBeVisible();
      if (expanded) await page.getByRole('button', { name: 'Expand radio player', exact: true }).click();
      await page.locator('.radio-play').click();
      const before = await page.evaluate(() => ({ ...window.radioCalls }));
      await position(page, 'edge');
      await expect(dock).toBeVisible();
      await position(page, 'card');
      await expect(page.locator('.santa-message-access')).toBeInViewport();
      await hiddenDock(page);
      await page.screenshot({ path: `test-results/signup-no-dock-${width}-${expanded}.png` });
      const input = page.locator('.santa-message-access input[name="FIRSTNAME"]');
      await input.focus();
      await input.fill('Parent');
      await page.setViewportSize({ width, height: 440 });
      await expect(input).toBeFocused();
      await hiddenDock(page);
      await position(page, 'top');
      await hiddenDock(page); // Focus retains suppression even offscreen.
      await page.locator('.navbar-logo').focus();
      await expect(dock).toBeVisible();
      await expect(dock).toHaveClass(expanded ? /^(?!.*is-minimized)/ : /is-minimized/);
      expect(await page.evaluate(() => window.radioCalls)).toEqual(before);
      await page.setViewportSize({ width, height: 844 });
      await position(page, 'card');
      await hiddenDock(page);
      await navigate(page, '/apps');
      await expect(dock).toBeVisible();
      await expect(page.locator('.radio-play')).toHaveText('Pause Radio');
      await expect(dock).toHaveClass(expanded ? /^(?!.*is-minimized)/ : /is-minimized/);
      expect(await page.evaluate(() => window.radioCalls)).toEqual(before);
    });
  }

  for (const entry of ['/', '/free-santa-message/']) {
  test(`signup, preparing, result and unchanged radio coordination ${width} ${entry}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await fixtures(page);
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    await page.route('**/api/santa-message', async route => {
      await hold;
      await route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3') });
    });
    await open(page, entry);
    // Dedicated pages suppress the dock before signup; use the retained
    // provider's control without making external radio requests.
    if (entry === '/') await page.locator('.radio-play').click();
    else await page.locator('.radio-play').dispatchEvent('click');
    await position(page, 'card');
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    await hiddenDock(page);
    await page.getByLabel('First Name', { exact: true }).fill('Dixie');
    await page.getByRole('option', { name: 'Dixie', exact: true }).click();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.getByRole('button', { name: /Santa Recording/ })).toBeDisabled();
    await hiddenDock(page);
    expect(await page.evaluate(() => window.radioCalls)).toEqual({ play: 1, pause: 0, load: 1 });
    release();
    const result = page.locator('.message-result');
    await expect(result).toBeVisible();
    await hiddenDock(page);
    await result.locator('audio').dispatchEvent('play');
    await expect(page.locator('.radio-play')).toHaveText('Listen Live');
    await result.locator('audio').dispatchEvent('ended');
    await expect(page.locator('.radio-play')).toHaveText('Pause Radio');
    const download = page.waitForEvent('download');
    await result.getByRole('link', { name: /Download your audio/ }).click();
    expect(await (await download).failure()).toBeNull();
    await hiddenDock(page);
    await navigate(page, '/apps');
    await expect(page.locator('.radio-dock')).toBeVisible();
    expect(await page.evaluate(() => window.radioCalls)).toEqual({ play: 2, pause: 1, load: 2 });
  });
  }

  test(`dedicated routes and Studio access hide both sizes including trailing slashes ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await fixtures(page);
    for (const path of ['/free-santa-message', '/free-santa-message/', '/santa-message-workshop', '/santa-message-workshop/']) {
      await open(page, path);
      await hiddenDock(page);
      // Existing state remains mounted; changing it cannot defeat suppression.
      await page.locator('.radio-size-toggle').dispatchEvent('click');
      await hiddenDock(page);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.radio-dock'))).toBe(false);
      await navigate(page, '/apps');
      await expect(page.locator('.radio-dock')).toBeVisible();
    }
  });

  test(`Studio selection, review, preparation, finished audio and gifts ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 844 });
    await fixtures(page);
    await page.route('**/api/santa-workshop-access', route => route.fulfill({
      json: { authorized: true, expiresAt: Date.now() + 3600000 },
    }));
    const fixture = await mockStudioGeneration(page);
    let release;
    fixture.hold = new Promise(resolve => { release = resolve; });
    await open(page, '/santa-message-workshop/');
    await hiddenDock(page);
    await page.getByRole('combobox', { name: 'Search recorded names', exact: true }).fill('Dixie');
    await page.getByRole('option', { name: 'Dixie', exact: true }).click();
    await page.locator('.smw-button-next').click();
    for (const answer of ['9 years old', 'Teamwork', 'Completing a jigsaw puzzle', 'Bûche de Noël', 'England']) {
      const skip = page.getByRole('button', { name: 'Skip this section', exact: true });
      if (await skip.isVisible()) await skip.click();
      await page.getByRole('option', { name: answer, exact: true }).click();
      await page.locator('.smw-button-next').click();
      await hiddenDock(page);
    }
    await confirmMessage(page);
    await expect(page.locator('.smw-review-create-action button')).toHaveText('Recording message →');
    await hiddenDock(page);
    release();
    await expect(page.getByRole('region', { name: 'Your finished Santa message' })).toBeVisible();
    await expect(page.locator('.studio-gift-download button').first()).toBeEnabled();
    await hiddenDock(page);
    expect(await page.locator('.smw-page').evaluate(node =>
      parseFloat(getComputedStyle(node).paddingBottom))).toBeLessThanOrEqual(24);
    expect(await page.evaluate(() => window.radioCalls)).toEqual({ play: 0, pause: 0, load: 0 });
  });
}

test('hiding a focused dock closes its lyrics dialog without stealing maker focus', async ({ page }) => {
  await fixtures(page);
  await open(page);
  await page.getByRole('button', { name: 'Expand radio player', exact: true }).click();
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Live lyrics' })).toBeVisible();
  await position(page, 'card');
  await hiddenDock(page);
  await expect(page.locator('dialog[open].live-lyrics-dialog')).toHaveCount(0);
  expect(await page.evaluate(() => !!document.activeElement?.closest('.radio-dock'))).toBe(false);
  await expect(page.locator('#page-content')).toBeFocused();
  const input = page.locator('.santa-message-access input[name="FIRSTNAME"]');
  await input.focus();
  await page.keyboard.type('Parent');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Parent');
});

test('hidden expanded player retains its size beyond the auto-minimise deadline', async ({ page }) => {
  await fixtures(page);
  await open(page);
  await page.clock.install();
  await page.getByRole('button', { name: 'Expand radio player', exact: true }).click();
  await position(page, 'card');
  await hiddenDock(page);
  await page.clock.fastForward(11000);
  await hiddenDock(page);
  await position(page, 'top');
  await expect(page.locator('.radio-dock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minimise radio player', exact: true })).toBeVisible();
});
