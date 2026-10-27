import { test, expect } from '@playwright/test';

test('shared contact privacy describes both modes without claiming inbox delivery or consent', async ({ page }) => {
  await page.goto('/privacy-policy');
  const article = page.locator('article');
  for (const text of [
    'General enquiry or Song submission',
    'a message of up to 500 characters',
    'separate dedicated Brevo forms',
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
  await expect(article.locator('time')).toHaveAttribute('datetime', '2026-10-26');
  await expect(article).toContainText('The homepage YouTube TV loads automatically on a first visit');
  await expect(article).toContainText('turning it off cannot erase data already sent or third-party cookies');
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
  await expect(article).toContainText('Older Santa Radio iPhone or iPad apps, older Android app versions, tvOS apps');
  await expect(article).toContainText('not a microphone recording made by you or your child');
  await expect(article).toContainText('The current website does not offer microphone recording');
  await expect(article).toContainText('normally respond within one month');
  await expect(article).toContainText('We do not sell personal data.');
});

test('policy describes the confirmed Android app without borrowing unverified iOS or provider claims', async ({ page }) => {
  await page.goto('/privacy-policy');
  const app = page.getByRole('region', { name: 'Christmas Radio UK — Android app' });
  await expect(app).toBeVisible();
  for (const text of [
    'without creating an account',
    'uses HTTPS connections',
    'receive live audio from Citrus3 at global.citrus3.com:8164',
    'separately requests current and upcoming song information and artist artwork from Santa Radio at www.santaradio.co.uk over HTTPS',
    'your IP address',
    'App preferences and cached content are stored on your device and are not uploaded to us',
    'does not include advertising or analytics SDKs',
    'programming is broadcast without adverts',
    'The Tracker is optional and opens in your external browser',
    'intended for listeners of all ages',
    'may maintain connection logs or listener statistics',
    'do not specify a fixed retention period where it has not been confirmed',
    'rights and complaints information elsewhere',
  ]) await expect(app).toContainText(text);
  await expect(app).not.toContainText('AirPlay and CarPlay');
  await expect(app).not.toContainText('microphone, camera, contacts');
  await expect(app).not.toContainText('Vercel and Citrus3');
  await expect(app).toContainText('not a claim of compliance with children’s privacy laws or Google Play Families requirements');
  await expect(app.getByRole('link', { name: 'email us about app privacy' }))
    .toHaveAttribute('href', 'mailto:santa@santaradio.co.uk');
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

test('policy YouTube disclosure matches the homepage wording and safe direct link', async ({ page }) => {
  await page.goto('/');
  const homepageLink = page.locator('.video-disclosure').getByRole('link', { name: 'Watch directly on YouTube', exact: true });
  const destination = await homepageLink.getAttribute('href');
  const target = await homepageLink.getAttribute('target');
  const rel = await homepageLink.getAttribute('rel');
  expect(destination).toBe('https://www.youtube.com/watch?v=mMrHniQJNCM');
  await page.goto('/privacy-policy');
  const youtube = page.getByRole('region', { name: 'YouTube', exact: true });
  await expect(youtube.locator('p')).toHaveText('This homepage TV loads YouTube automatically unless a saved preference keeps it off. YouTube may use cookies and device information for playback, analytics and advertising. Turn it off in Cookie settings or choose Decline optional cookies. It attempts muted inline autoplay, subject to your browser. Use Listen Live for sound. Watch directly on YouTube.');
  const link = youtube.getByRole('link', { name: 'Watch directly on YouTube', exact: true });
  await expect(link).toHaveAttribute('href', destination);
  await expect(link).toHaveAttribute('target', target);
  await expect(link).toHaveAttribute('rel', rel);
  expect(target).toBe('_blank');
  expect(rel.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
  await expect(youtube.locator('xpath=ancestor::details')).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`cookie external-media link reaches YouTube by keyboard without changing choices at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const providerRequests = [];
    await page.route(/https:\/\/(?:www\.youtube\.com\/embed\/|tunein\.com\/embed\/|www\.googletagmanager\.com\/|connect\.facebook\.net\/)/, route => {
      providerRequests.push(route.request().url());
      return route.fulfill({ body: '' });
    });
    await page.goto('/privacy-policy');
    await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const choices = await page.evaluate(() => localStorage.getItem('santaradio-cookie-consent-v2'));
    const summary = page.locator('.cookie-details summary').filter({ hasText: 'External media — YouTube and TuneIn' });
    await summary.focus();
    await page.keyboard.press('Enter');
    const link = page.getByRole('link', { name: 'Read the YouTube section of this Privacy Policy', exact: true });
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveAttribute('href', '#youtube-privacy');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/privacy-policy#youtube-privacy$/);
    const heading = page.getByRole('heading', { name: 'YouTube', exact: true });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    expect(await heading.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(100);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('region', { name: 'YouTube', exact: true })
      .getByRole('link', { name: 'Watch directly on YouTube', exact: true })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('santaradio-cookie-consent-v2'))).toBe(choices);
    expect(providerRequests).toEqual([]);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test(`YouTube privacy fragment works on direct navigation and refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/privacy-policy#youtube-privacy');
    const heading = page.getByRole('heading', { name: 'YouTube', exact: true });
    for (const refresh of [false, true]) {
      if (refresh) await page.reload();
      await expect(heading).toBeInViewport();
      expect(await heading.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(100);
      await expect(page.getByRole('region', { name: 'YouTube', exact: true })).toContainText('Turn it off in Cookie settings');
      expect(await page.evaluate(() => localStorage.getItem('santaradio-cookie-consent-v2'))).toBeNull();
      await expect(page.locator('iframe')).toHaveCount(0);
    }
  });
}

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
    const youtube = page.getByRole('region', { name: 'YouTube', exact: true });
    const heading = youtube.getByRole('heading', { name: 'YouTube', exact: true, level: 2 });
    await expect(heading).toBeVisible();
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeInViewport();
    await expect(youtube.locator('p')).toBeVisible();
    await expect(youtube.getByRole('link', { name: 'Watch directly on YouTube', exact: true }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=mMrHniQJNCM');
    expect(await youtube.locator('p').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
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
