import { test, expect } from '@playwright/test';

test('shared contact privacy describes both modes without claiming inbox delivery or consent', async ({ page }) => {
  await page.goto('/privacy-policy');
  const article = page.locator('article');
  for (const text of [
    'General enquiry or Song submission',
    'a message of up to 500 characters',
    'same dedicated Brevo form',
    'General enquiries do not require these song criteria',
    'not sent as a separate Brevo attribute',
    'do not open the message maker or give consent for marketing',
    'not verified delivery to our inbox',
  ]) await expect(article).toContainText(text);
  await expect(article).not.toContainText('Song submissions use the separate form');
  await expect(article.getByRole('link', { name: 'shared contact form', exact: true }))
    .toHaveAttribute('href', '/submit-a-song');
  await expect(article.getByRole('link', { name: 'Song submission on the shared contact form', exact: true }))
    .toHaveAttribute('href', '/submit-a-song?mode=song');
});

test('policy covers the confirmed native app separately from website marketing', async ({ page }) => {
  await page.goto('/privacy-policy');
  const article = page.locator('article');
  const app = page.getByRole('region', { name: 'Christmas Radio UK — native iPhone and iPad app, version 35.0' });
  await expect(app).toBeVisible();
  await expect(article).not.toContainText('not separate apps');
  await expect(article.locator('time')).toHaveAttribute('datetime', '2026-10-20');
  for (const text of [
    'Now Playing, Up Next and artist artwork',
    'does not require a mandatory account',
    'Background audio',
    'AirPlay and CarPlay',
    'do not require microphone, camera, contacts, photo-library or location access for radio playback',
    'Snowfall, Blizzard and Festive lights',
    'does not upload these saved preferences or cached copies',
    'rather than offloading it',
    'does not necessarily remove existing backups',
    'global.citrus3.com',
    'www.santaradio.co.uk',
    'Vercel hosts',
    'your IP address',
    'connection logs or listener statistics',
    'Deleting the app does not delete information already retained',
    'using the app does not enrol you in marketing',
    'not a blanket statement about native-app SDKs',
    'does not automatically give consent for separate app tracking',
    'rights and complaints information elsewhere',
  ]) await expect(app).toContainText(text);
  await expect(app.getByRole('link', { name: 'email us about app privacy' }))
    .toHaveAttribute('href', 'mailto:santa@santaradio.co.uk');
  await expect(app.locator('a[href*="replit.com"]')).toHaveCount(0);
  await expect(app).not.toContainText('[Before publishing');
  await expect(app).not.toContainText('does not contain advertising or analytics SDKs');
  await expect(app).not.toContainText('no tracking');
  await expect(article).toContainText('Older Santa Radio iPhone or iPad apps, tvOS apps');
  await expect(article).toContainText('not a microphone recording made by you or your child');
  await expect(article).toContainText('The current website does not offer microphone recording');
  await expect(article).toContainText('normally respond within one month');
  await expect(article).toContainText('We do not sell personal data.');
});

test('footer opens a readable privacy policy with separate message access and news consent', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.originalAudio = document.querySelector('audio'));
  await page.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  const article = page.locator('article');
  await expect(article).toContainText('VoiceoverGuy Ltd');
  await expect(article).toContainText('News signup is not yet available here.');
  await expect(article).toContainText('until you unsubscribe');
  await expect(article).toContainText('These details are sent to Brevo for message access');
  await expect(article).toContainText('does not give consent for Santa Radio news or tracker reminders');
  await expect(article).not.toContainText('requests are not currently connected');
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
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/privacy-policy');
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
  await expect(page.locator('footer').getByRole('link', { name: 'SantaGuy.co.uk', exact: true }))
    .toHaveAttribute('href', 'https://www.santaguy.co.uk');
  await expect(page.locator('footer').getByRole('link', { name: 'Questions? Email us', exact: true })).toHaveCount(0);
  await expect(page.locator('.footer-links > :last-child')).toHaveText('Cookie settings');
  await expect(page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true })).toBeVisible();
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
  await page.locator('footer').getByRole('link', { name: 'News', exact: true }).click();
  await expect(page.locator('h1')).toContainText('North Pole');
  expect(await page.evaluate(() => ({
    sameAudio: window.originalAudio === document.querySelector('audio'),
    volume: document.querySelector('audio').volume,
    plays: window.playCalls,
    pauses: window.pauseCalls,
  }))).toEqual({ sameAudio: true, volume: 0.25, plays: 1, pauses: 0 });
});
