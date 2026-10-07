import { test, expect } from '@playwright/test';

test('footer opens a readable privacy policy without adding signup functionality', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.originalAudio = document.querySelector('audio'));
  await page.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  const article = page.locator('article');
  await expect(article).toContainText('VoiceoverGuy Ltd');
  await expect(article).toContainText('News signup is not yet available here.');
  await expect(article).toContainText('until you unsubscribe');
  await expect(article.getByRole('link', { name: 'santa@santaradio.co.uk' })).toHaveAttribute('href', 'mailto:santa@santaradio.co.uk');
  await expect(article.locator('form, input')).toHaveCount(0);
  expect(await page.evaluate(() => window.originalAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(article).toContainText('Your choices and rights');
});

test('policy direct loads, refreshes and metadata work on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/privacy-policy');
    await page.reload();
    await expect(page).toHaveTitle('Privacy Policy — Santa Radio');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /browser preferences/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://santa-radio.replit.app/privacy-policy');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('article p').nth(2).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#page-content')).toBeFocused();
  }
});

test('homepage and footer omit the promotion while the separate stories route remains', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).not.toContainText(/Santa Text Secret Code Words|chance to win|fantastic prizes/i);
  await expect(page.locator('footer a[href="/santa-stories"]')).toHaveCount(0);
  await expect(page.locator('.footer-links > :last-child')).toHaveText('Privacy Policy');
  await expect(page.locator('.footer-links a')).toHaveCount(8);
  await page.goto('/santa-stories');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Santa Text Secret Code Words' })).toBeVisible();
});

test('keyboard footer navigation preserves active radio and volume in both directions', async ({ page }) => {
  // Test navigation continuity independently of upstream stream availability.
  await page.addInitScript(() => {
    window.playCalls = 0;
    window.pauseCalls = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { window.pauseCalls++; };
    HTMLMediaElement.prototype.play = function () {
      window.playCalls++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.goto('/');
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live' }).click();
  await page.getByRole('slider', { name: 'Radio volume' }).fill('0.25');
  await page.evaluate(() => { window.originalAudio = document.querySelector('audio'); });
  const privacyLink = page.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true });
  await privacyLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.locator('footer').getByRole('link', { name: 'Santa Radio home' }).click();
  await expect(page.locator('h1')).toContainText('North Pole');
  expect(await page.evaluate(() => ({
    sameAudio: window.originalAudio === document.querySelector('audio'),
    volume: document.querySelector('audio').volume,
    plays: window.playCalls,
    pauses: window.pauseCalls,
  }))).toEqual({ sameAudio: true, volume: 0.25, plays: 1, pauses: 0 });
});
