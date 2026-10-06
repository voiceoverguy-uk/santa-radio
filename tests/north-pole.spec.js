import { test, expect } from '@playwright/test';

test('responsive homepage, matching typography, effects and mobile navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('North Pole');
  await expect(page.locator('h1')).toHaveCSS('font-family', /Cinzel/);
  await expect(page.locator('.hero-actions .btn-red')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.hero-picture img')).toHaveJSProperty('complete', true);
  expect(await page.locator('.hero-picture img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Effects On' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-effects', 'off');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-effects', 'off');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Mug Shots' }).click();
  await expect(page).toHaveURL(/mugshots\/all$/);
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.hero-snow i').first()).toHaveCSS('animation-name', 'none');
  expect(errors).toEqual([]);
});

test('mugshot search, load more and detail routes survive redesign', async ({ page }) => {
  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  await expect(cards).toHaveCount(48);
  await page.getByRole('button', { name: /Load More/i }).click();
  await expect(cards).toHaveCount(96);
  await page.locator('.mugshots-search').fill('Lisa Maxwell');
  await expect(cards).toHaveCount(1);
  await cards.first().click();
  await expect(page).toHaveURL(/mugshots\/lisa-maxwell/);
  await expect(page.locator('h1')).toContainText('Lisa Maxwell');
  await page.goto('/mugshots/all');
  await page.locator('.mugshots-search').fill('zzzznocelebrity');
  await expect(page.getByText(/No celebrities found/)).toBeVisible();
});

test('radio shares one audio instance across navigation, supports volume, errors and retry', async ({ page }) => {
  // Deterministic media controls: this checks UI/state, not upstream stream availability.
  await page.addInitScript(() => {
    window.mediaMode = 'success';
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.play = function () {
      if (window.mediaMode === 'failure') return Promise.reject(new Error('Test stream failure'));
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.goto('/');
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live' }).click();
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.evaluate(() => { window.stationAudio = document.querySelector('audio'); });
  await page.getByRole('navigation').getByRole('link', { name: 'Music', exact: true }).click();
  expect(await page.evaluate(() => window.stationAudio === document.querySelector('audio'))).toBe(true);
  await expect(page.locator('audio')).toHaveCount(1);
  await page.getByRole('slider', { name: 'Radio volume' }).fill('0.25');
  expect(await page.locator('audio').evaluate(audio => audio.volume)).toBe(.25);
  await page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' }).click();
  await page.evaluate(() => { window.mediaMode = 'failure'; });
  await page.locator('.radio-dock').getByRole('button', { name: 'Listen Live' }).click();
  await expect(page.locator('.radio-dock')).toContainText('stream is unavailable');
  await page.evaluate(() => { window.mediaMode = 'success'; });
  await page.locator('.radio-dock').getByRole('button', { name: 'Try Again' }).click();
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' })).toBeVisible();
});

test('all primary routes render and the soundboard retains working controls', async ({ page }) => {
  await page.addInitScript(() => {
    window.speechSynthesis.speak = utterance => { window.spokenText = utterance.text; };
    window.speechSynthesis.cancel = () => {};
  });
  for (const path of ['/apps', '/christmas-music', '/free-santa-message', '/santa-stories', '/submit-a-song', '/links']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  }
  await page.goto('/');
  const phrase = page.getByRole('button', { name: 'Cookies', exact: true });
  await phrase.click();
  await expect(phrase).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.spokenText)).toContain('I love cookies');
  await phrase.click();
  await expect(phrase).toHaveAttribute('aria-pressed', 'false');
});
