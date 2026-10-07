import { test, expect } from '@playwright/test';

const primaryNavigation = [
  ['Home', '/'], ['Apps', '/apps'], ['FREE Audio Message', '/free-santa-message'],
  ['Music', '/christmas-music'], ['Mug Shots', '/mugshots/all'], ['Santa Tracker', '/santa-tracker'],
];

async function expectNavigationFits(page, mobile, checkPageOverflow = true) {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  if (mobile) {
    await expect(nav.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await nav.getByRole('button', { name: 'Open menu' }).click();
  } else {
    await expect(nav.locator('.hamburger')).toBeHidden();
  }
  for (const [label, href] of primaryNavigation) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  }
  const layout = await nav.evaluate(element => {
    const bounds = node => {
      const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const menu = element.querySelector('.navbar-links');
    return {
      logo: bounds(element.querySelector('.navbar-logo')),
      items: [...menu.querySelectorAll('a, button')].map(bounds),
      menuOverflows: menu.scrollWidth > menu.clientWidth,
      pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
      viewport: window.innerWidth,
    };
  });
  if (checkPageOverflow) expect(layout.pageOverflows).toBe(false);
  expect(layout.menuOverflows).toBe(false);
  for (const [index, item] of layout.items.entries()) {
    expect(item.left).toBeGreaterThanOrEqual(0);
    expect(item.right).toBeLessThanOrEqual(layout.viewport);
    expect(item.top >= layout.logo.bottom || item.left >= layout.logo.right).toBe(true);
    if (!mobile) {
      if (index) expect(item.left).toBeGreaterThanOrEqual(layout.items[index - 1].right);
      // Each label stays on one line, including the longer Santa Tracker link.
      const previous = layout.items[0];
      expect(Math.abs(item.top + item.height / 2 - (previous.top + previous.height / 2))).toBeLessThan(1);
    }
  }
  if (mobile) {
    await page.keyboard.press('Escape');
    await expect(nav.locator('.navbar-links')).toBeHidden();
  }
}

for (const path of ['/', '/apps']) {
  test(`larger shared navigation fits desktop, tablet, mobile and enlarged text on ${path}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveCSS('font-size', '15.2px');
    await expect(nav.locator('.effects-toggle')).toHaveCSS('font-size', '13.6px');
    await expect(nav.locator('.nav-listen button')).toHaveCSS('font-size', '14.4px');
    for (const width of [1440, 1280, 1201, 1200, 1199, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNavigationFits(page, width <= 1200);
    }
    // Text-only enlargement: the header must switch menus rather than clip labels.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await expectNavigationFits(page, true);
    await page.setViewportSize({ width: 390, height: 844 });
    // Existing homepage countdown overflow at 200% text is separate from the header.
    // Still verify every menu item's bounds and the menu's own overflow at this size.
    await expectNavigationFits(page, true, path !== '/');
  });
}

test('larger navigation preserves keyboard, active routes, snow and shared radio controls', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Snow On' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-effects', 'off');
  await nav.getByRole('button', { name: 'Listen Live' }).click();
  await expect(nav.getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.evaluate(() => { window.navigationAudio = document.querySelector('audio'); });
  await nav.getByRole('link', { name: 'Apps', exact: true }).click();
  await expect(nav.getByRole('link', { name: 'Apps', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = nav.getByRole('button', { name: 'Open menu' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(nav.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
  await nav.getByRole('button', { name: 'Snow Off' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-effects', 'on');
  await nav.getByRole('button', { name: 'Pause Radio' }).click();
  await expect(nav.getByRole('button', { name: 'Listen Live' })).toBeVisible();
  await nav.getByRole('button', { name: 'Listen Live' }).click();
  await nav.getByRole('link', { name: 'Music', exact: true }).click();
  await expect(page).toHaveURL(/christmas-music$/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => window.navigationAudio === document.querySelector('audio'))).toBe(true);
  await toggle.click();
  await expect(nav.getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('responsive homepage, matching typography, effects and mobile navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('North Pole');
  await expect(page.locator('h1')).toHaveCSS('font-family', /Cinzel/);
  await expect(page.locator('.hero-actions .btn-red')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.hero-picture img')).toHaveJSProperty('complete', true);
  expect(await page.locator('.hero-picture img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Snow On' }).click();
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
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Snow Off' }).click();
  await expect(page.locator('.site-snow')).toBeHidden();
  expect(errors).toEqual([]);
});

test('mugshot search, load more and detail routes survive redesign', async ({ page }) => {
  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  await expect(cards).toHaveCount(100);
  await page.getByRole('button', { name: /Load More/i }).click();
  await expect(cards).toHaveCount(200);
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
    const NativeAudio = window.Audio;
    window.Audio = function (src) {
      const audio = new NativeAudio(src);
      window.lastSoundboardAudio = audio;
      return audio;
    };
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
  await page.waitForFunction(() => window.lastSoundboardAudio?.currentTime > 0);
  expect(await page.evaluate(() => window.lastSoundboardAudio.src)).toContain('/audio/soundboard/cookies.mp3');
  await phrase.click();
  await expect(phrase).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.lastSoundboardAudio.paused)).toBe(true);
});
