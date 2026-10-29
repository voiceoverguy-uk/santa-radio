import { test, expect } from '@playwright/test';

const privacySections = [
  ['Website & cookies', 'cookie-overview'],
  ['YouTube', 'youtube-privacy'],
  ['iPhone/iPad app', 'christmas-radio-privacy'],
  ['Android app', 'android-radio-privacy'],
  ['Choices & rights', 'privacy-choices'],
];

for (const width of [1440, 390, 320]) {
  test(`section navigation is keyboard accessible and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/privacy-policy');
    await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const consentBefore = await page.evaluate(() => localStorage.getItem('santaradio-cookie-consent-v2'));
    const nav = page.getByRole('navigation', { name: 'Privacy policy sections', exact: true });
    await expect(nav.getByRole('link')).toHaveCount(privacySections.length);
    for (const [label, id] of privacySections) {
      const link = nav.getByRole('link', { name: label, exact: true });
      await expect(link).toHaveAttribute('href', `#${id}`);
      await link.focus();
      // Use an actual keyboard transition to check the visible focus treatment.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      const box = await link.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(40);
      await page.keyboard.press('Enter');
      const heading = page.locator(`h2#${id}`);
      await expect(page).toHaveURL(new RegExp(`/privacy-policy#${id}$`));
      await expect(heading).toBeFocused();
      await expect(heading).toBeInViewport();
      await expect.poll(async () => {
        const target = await heading.boundingBox();
        const header = await page.locator('.navbar').boundingBox();
        const dock = await page.locator('.radio-dock').boundingBox();
        return target.y >= header.y + header.height && target.y + target.height <= dock.y;
      }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(await page.evaluate(() => localStorage.getItem('santaradio-cookie-consent-v2'))).toBe(consentBefore);
    await expect(page.locator('#santaradio-google-analytics, #santaradio-meta-pixel, article iframe')).toHaveCount(0);
    await page.locator('article').getByRole('button', { name: 'Cookie settings', exact: true }).click();
    await expect(page.locator('.marketing-consent').getByRole('button', { name: 'Save choices', exact: true })).toBeVisible();
  });
}

test('section links support direct visits, refresh and browser history', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/privacy-policy');
  await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  for (const [, id] of privacySections) {
    await page.goto(`/privacy-policy#${id}`);
    await page.reload();
    await expect(page.locator(`h2#${id}`)).toBeFocused();
    await expect(page.locator(`h2#${id}`)).toBeInViewport();
  }
  const nav = page.getByRole('navigation', { name: 'Privacy policy sections', exact: true });
  await nav.getByRole('link', { name: 'YouTube', exact: true }).click();
  await nav.getByRole('link', { name: 'Android app', exact: true }).click();
  await page.goBack();
  await expect(page.locator('#youtube-privacy')).toBeFocused();
  await expect(page.locator('#youtube-privacy')).toBeInViewport();
  await page.goForward();
  await expect(page.locator('#android-radio-privacy')).toBeFocused();
  await expect(page.locator('#android-radio-privacy')).toBeInViewport();
  // Unknown and malformed fragments must leave the policy usable.
  await page.goto('/privacy-policy#%invalid');
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
});

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
  await expect(article.locator('time')).toHaveAttribute('datetime', '2026-10-28');
  await expect(article.locator('time')).toHaveText('28 October 2026');
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

test('policy describes the Android release, embedded Tracker and unconfirmed provider arrangements', async ({ page }) => {
  await page.goto('/privacy-policy');
  const app = page.getByRole('region', { name: 'Santa Radio for Android — version 35.0' });
  await expect(app).toBeVisible();
  for (const text of [
    'operated by VoiceoverGuy Ltd',
    'without creating an account',
    'does not create an account-based listening-history profile',
    'native listening does not subscribe you to marketing',
    'native app has no advertising or analytics SDKs',
    'stream and Santa Tracker contain no adverts or sponsorship messages',
    'does not mean that no data is collected',
    'signed Android version 35.0 release requests no microphone, camera, contacts, location, photo-library or physical-activity recognition permissions',
    'Santa’s route, not the listener’s GPS location',
    'Optional foreground shake and tilt effects process motion readings locally',
    'System reduced-motion and low-power settings',
    'display and sound preferences',
    'Present Stack best score and game settings',
    'catalogue information and cached artwork locally',
    'does not upload preferences, scores or motion readings to station servers',
    'Android backup and device-transfer settings can separately copy eligible app data',
    'does not necessarily erase existing backups, browser storage or records held by service providers',
    'uses HTTPS connections',
    'receive live audio from Citrus3 at global.citrus3.com:8164',
    'Current and upcoming song feeds come from stagcommunications.com',
    'Catalogue information, artwork and the Tracker come from the Vercel-hosted Santa Radio website at santa-radio-three.vercel.app',
    'fonts.googleapis.com and fonts.gstatic.com',
    'website, social network or app store you select',
    'your IP address',
    'ordinary request, device and network information',
    'Requests can indicate listening times or the content you request',
    'approximate location from an IP address',
    'different from accessing your device’s GPS location',
    'can be embedded in the Android app or opened in an external browser',
    'JavaScript and incognito mode, with DOM storage and shared and third-party cookies disabled',
    'do not eliminate network requests or server processing',
    'not proof that the shipped WebView can never load tracking',
    'optional Google Analytics and Meta integrations',
    'conditional on Analytics and Marketing choices respectively, with both defaults off',
    'a choice can apply to the current website visit even if it cannot be saved',
    'Google Fonts requests are separate from those optional tracking choices',
    'ordinary external browser has its own settings and storage',
    'may maintain connection and error logs or listener statistics',
    'owner does not know the actual station and feed logging arrangements, retention periods, processing locations or international-transfer safeguards',
    'do not state precise periods or assume particular provider contracts or legal bases',
    'intended audience includes all ages, including children',
    'Parents or carers should handle external forms involving children',
    'COPPA, GDPR and Google Play Families requirements, remains open',
    'not a claim of compliance or certification',
    'coordinate requests with providers where appropriate',
  ]) await expect(app).toContainText(text);
  await expect(app).not.toContainText('AirPlay and CarPlay');
  await expect(app).not.toContainText('www.santaradio.co.uk over HTTPS');
  await expect(app).not.toContainText('The Tracker is optional and opens in your external browser');
  await expect(app.getByRole('link', { name: 'email us about app privacy' }))
    .toHaveAttribute('href', 'mailto:santa@santaradio.co.uk');
  await expect(app.getByRole('link', { name: 'Your choices and rights', exact: true }))
    .toHaveAttribute('href', '#privacy-choices');
  await expect(app.getByRole('link', { name: 'cookie choices and third-party disclosures', exact: true }))
    .toHaveAttribute('href', '#cookie-overview');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/privacy-policy');
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
  for (const contact of await article.getByRole('link', { name: 'santa@santaradio.co.uk', exact: true }).all()) {
    await expect(contact).toHaveAttribute('href', 'mailto:santa@santaradio.co.uk');
  }
  await expect(article.locator('form, input')).toHaveCount(0);
  expect(await page.evaluate(() => window.originalAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(article).toContainText('Your choices and rights');
});

test('YouTube privacy wording remains in the policy without repeating beneath the homepage player', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.youtube-section .video-disclosure')).toHaveCount(0);
  await page.goto('/privacy-policy');
  const youtube = page.getByRole('region', { name: 'YouTube', exact: true });
  await expect(youtube.locator('p')).toHaveText('This homepage TV loads YouTube automatically unless a saved preference keeps it off. YouTube may use cookies and device information for playback, analytics and advertising. Turn it off in Cookie settings or choose Decline optional cookies. It attempts muted inline autoplay, subject to your browser. Use Listen Live for sound. Watch directly on YouTube.');
  const link = youtube.getByRole('link', { name: 'Watch directly on YouTube', exact: true });
  await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=mMrHniQJNCM');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
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
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Santa Radio for Android.*iPhone and iPad.*embedded content/);
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
  await expect(page.locator('footer').getByRole('link', { name: 'Voice of Santa', exact: true }))
    .toHaveAttribute('href', 'https://www.santaguy.co.uk');
  await expect(page.locator('footer').getByRole('link', { name: 'Questions? Email us', exact: true })).toHaveCount(0);
  await expect(page.locator('.footer-links > :last-child')).toHaveText('Cookie settings');
  await expect(page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true })).toBeVisible();
  await expect(page.locator('.footer-links a')).toHaveCount(9);
  await page.goto('/santa-stories');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Santa Text Secret Code Words' })).toBeVisible();
});

for (const width of [1440, 390, 320]) {
  test(`footer has one standard keyboard-accessible voice credit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/privacy-policy');
    await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const footer = page.locator('footer');
    const links = footer.locator('.footer-links');
    const credit = links.getByRole('link', { name: 'Voice of Santa', exact: true });
    await expect(credit).toHaveCount(1);
    await expect(footer.locator('a[href="https://www.santaguy.co.uk"]')).toHaveCount(1);
    await expect(credit).toHaveAttribute('href', 'https://www.santaguy.co.uk');
    await expect(credit).toHaveAttribute('target', '_blank');
    await expect(credit).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(footer.locator('.footer-attribution')).toHaveCount(0);
    await expect(footer).not.toContainText(/Brought to life|British Voiceover Artist|Guy Harris|SantaGuy\.co\.uk/);
    expect(await credit.evaluate(el => {
      const own = getComputedStyle(el);
      const standard = getComputedStyle(el.parentElement.querySelector('a'));
      return ['fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'color'].every(key => own[key] === standard[key]);
    })).toBe(true);
    await expect(links.getByRole('link')).toHaveText([
      'News', 'Playlist', 'Voice of Santa', 'Submit your song',
      'Personalised Santa Video Message', 'Download the app', 'Links',
      'Privacy Policy', 'Photo usage and licensing',
    ]);
    await links.getByRole('link', { name: 'Playlist', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(credit).toBeFocused();
    expect(await credit.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    for (const link of await links.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
    const before = await snow.getAttribute('aria-checked');
    await snow.focus();
    await page.keyboard.press('Space');
    await expect(snow).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    for (const social of ['Instagram', 'Facebook']) {
      await expect(footer.getByRole('link', { name: social, exact: true })).toBeVisible();
    }
    await expect(footer.locator('.footer-copy')).toHaveText('© 2026 Santa Radio. All Rights Reserved.');
    await footer.getByRole('button', { name: 'Cookie settings', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.marketing-consent').getByRole('button', { name: 'Save choices', exact: true })).toBeVisible();
  });
}

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
