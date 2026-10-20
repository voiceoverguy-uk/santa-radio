import { test, expect } from '@playwright/test';
import fs from 'node:fs';

async function setup(page, { failPlayback = false } = {}) {
  // Exercise the real buttons/provider while avoiding live-stream timing in UI tests.
  await page.addInitScript(({ failPlayback }) => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () {
      return failPlayback ? Promise.reject(new Error('Test stream failure')) : Promise.resolve();
    };
  }, { failPlayback });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  const state = { artist: 'Cher', title: 'Christmas Song', unavailable: false };
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: {
      current: state.unavailable && !state.retainCurrent ? null : { artist: state.artist, title: state.title },
      currentStatus: state.unavailable ? 'unavailable' : 'ready',
      upcoming: [], upcomingStatus: 'ready',
    },
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rejectCookies = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await rejectCookies.isVisible()) await rejectCookies.click();
  return state;
}

for (const width of [1280, 390]) test(`artwork song info matches both fields, updates and navigates at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await setup(page);
  state.artist = 'John Legend';
  state.title = 'Bring Me Love';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const card = page.locator('.now-playing-artwork');
  const info = card.getByRole('link');
  await expect(info).toBeVisible();
  await expect(info).toHaveAttribute('href', '/christmas-artist/478-john-legend-bring-me-love');
  await expect(info).toHaveAttribute('aria-label', /Bring Me Love.*John Legend/);
  const frame = await card.locator('.now-playing-artwork__image').boundingBox();
  const button = await info.boundingBox();
  expect(button.width).toBeGreaterThanOrEqual(44);
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.x).toBeGreaterThan(frame.x + frame.width / 2);
  expect(button.y).toBeGreaterThan(frame.y + frame.height / 2);
  expect(button.x + button.width).toBeLessThanOrEqual(frame.x + frame.width);
  expect(button.y + button.height).toBeLessThanOrEqual(frame.y + frame.height);
  await info.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(info).toBeFocused();
  expect(await info.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await card.evaluate(el => el.scrollIntoView({ block: 'center' }));
  fs.mkdirSync('generated-artifacts', { recursive: true });
  await page.screenshot({ path: `generated-artifacts/artwork-song-info-${width}.jpg` });

  // Same artist, different song must change the destination.
  state.title = 'What A Wonderful World';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toHaveAttribute('href', '/christmas-artist/415-john-legend-what-a-wonderful-world');
  // A title belonging to another artist must never produce a link.
  state.artist = 'Cher';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toHaveCount(0);
  state.artist = 'John Legend';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(info).toBeVisible();
  await info.click();
  await expect(page).toHaveURL(/\/christmas-artist\/415-john-legend-what-a-wonderful-world$/);
  await expect(page.getByRole('heading', { name: 'What A Wonderful World — John Legend', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Santa Radio player' })
    .getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
});

test('artwork info is absent for unmatched or unavailable tracks', async ({ page }) => {
  const state = await setup(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const card = page.locator('.now-playing-artwork');
  await expect(card).toBeVisible();
  await expect(card.getByRole('link')).toHaveCount(0);
  state.title = 'DJ Play a Christmas Song';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByRole('link')).toHaveAttribute('href', '/christmas-artist/551-cher-dj-play-a-christmas-song');
  state.unavailable = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByRole('link')).toHaveCount(0);
});

test('desktop play reveals artwork on the right, updates artists and glows on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = await setup(page);
  const card = page.locator('.now-playing-artwork');
  await expect(card).toHaveCount(0);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/cher.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth === 512)).toBe(true);
  const content = await page.locator('.hero-content').boundingBox();
  const frame = await card.boundingBox();
  expect(frame.x).toBeGreaterThan(content.x + content.width);
  const baseShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
  await card.hover();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(230, 206, 134)');
  expect(await card.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe(baseShadow);
  fs.mkdirSync('generated-artifacts', { recursive: true });
  await page.screenshot({ path: 'generated-artifacts/home-live-artwork-desktop.jpg' });
  state.artist = 'Ava Max';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/ava-max.webp');
  state.artist = 'An artist without supplied artwork';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
  state.unavailable = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card).toHaveAttribute('aria-label', 'Santa Radio now-playing artwork');
  await page.locator('.hero-actions').getByRole('button', { name: 'Pause Radio' }).click();
  await expect(card).toHaveCount(0);
});

test('mobile play shows artwork below the countdown; tablets stay hidden and desktops keep the right-hand layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  const card = page.locator('.now-playing-artwork');
  await expect(card).toHaveCount(0);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/cher.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [667, 375], [767, 900]]) {
    await page.setViewportSize({ width, height });
    const frame = await card.boundingBox();
    const countdown = await page.locator('.hero-countdown').boundingBox();
    const tracker = await page.locator('.tracker-banner').boundingBox();
    expect(frame.y).toBeGreaterThan(countdown.y + countdown.height);
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(width);
    const picture = await card.locator('.now-playing-artwork__image').boundingBox();
    expect(picture.width).toBeCloseTo(picture.height, 1);
    expect(frame.height).toBeGreaterThan(picture.height);
    expect(frame.y + frame.height).toBeLessThan(tracker.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  fs.mkdirSync('generated-artifacts', { recursive: true });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'generated-artifacts/home-live-artwork-mobile.jpg' });
  state.artist = 'Ava Max';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/ava-max.webp');
  state.artist = 'An artist without supplied artwork';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
  await page.getByRole('complementary', { name: 'Santa Radio player' }).getByRole('button', { name: 'Pause Radio', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('complementary', { name: 'Santa Radio player' }).getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(card).toBeVisible();
  await page.setViewportSize({ width: 820, height: 900 });
  await expect(card).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(card).toBeVisible();
  const title = await page.locator('.hero-title').boundingBox();
  const frame = await card.boundingBox();
  expect(frame.x).toBeGreaterThan(title.x + title.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed artwork falls back safely; reduced motion disables transitions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/artist-artwork/cher.webp', route => route.abort());
  await setup(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const card = page.locator('.now-playing-artwork');
  await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await card.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});

for (const width of [390, 1280]) {
test(`unsuccessful playback does not show a playing-artist card at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page, { failPlayback: true });
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(page.locator('.hero-actions').getByRole('button', { name: 'Try Again' })).toBeVisible();
  await expect(page.locator('.now-playing-artwork')).toHaveCount(0);
});
}

for (const width of [1280, 390]) {
  test(`live caption updates, wraps and clears stale details at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
    const card = page.locator('.now-playing-artwork');
    const artist = card.locator('.now-playing-artwork__artist');
    const title = card.locator('.now-playing-artwork__title');
    const caption = card.locator('.now-playing-artwork__caption');
    const picture = card.locator('.now-playing-artwork__image');
    const refresh = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const assertLayout = async () => {
      const imageBox = await picture.boundingBox();
      const captionBox = await caption.boundingBox();
      const cardBox = await card.boundingBox();
      const heroBox = await page.locator('.hero').boundingBox();
      expect(imageBox.width).toBeCloseTo(imageBox.height, 1);
      expect(captionBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height);
      expect(captionBox.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(captionBox.x + captionBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
      expect(cardBox.y).toBeGreaterThanOrEqual(heroBox.y);
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(heroBox.y + heroBox.height + 0.5);
      expect(await caption.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    // Both live fields are displayed even though this recording is unmatched.
    await expect(artist).toHaveText('Cher');
    await expect(title).toHaveText('Christmas Song');
    await expect(card.getByRole('link')).toHaveCount(0);
    await assertLayout();
    state.artist = 'Ariana Grande';
    state.title = 'Last Christmas';
    await refresh();
    await expect(artist).toHaveText(state.artist);
    await expect(title).toHaveText(state.title);
    await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/ariana-grande-last-christmas.webp');
    const info = card.getByRole('link');
    await expect(info).toHaveAttribute('href', '/christmas-artist/75-ariana-grande-last-christmas');
    const imageBox = await picture.boundingBox();
    const infoBox = await info.boundingBox();
    expect(infoBox.y + infoBox.height).toBeLessThanOrEqual(imageBox.y + imageBox.height);
    expect(infoBox.x + infoBox.width).toBeLessThanOrEqual(imageBox.x + imageBox.width);
    await card.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (width < 768) {
      const visibleCaption = await caption.boundingBox();
      const dock = await page.getByRole('complementary', { name: 'Santa Radio player' }).boundingBox();
      expect(visibleCaption.y + visibleCaption.height).toBeLessThanOrEqual(dock.y);
    }
    fs.mkdirSync('generated-artifacts', { recursive: true });
    await page.screenshot({ path: `generated-artifacts/live-artwork-caption-${width}.jpg` });
    state.title = 'Winter Things';
    await refresh();
    await expect(title).toHaveText('Winter Things');
    await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/ariana-grande-winter-things.webp');
    state.title = 'A live recording without a catalogue page';
    await refresh();
    await expect(title).toHaveText(state.title);
    await expect(info).toHaveCount(0);
    state.artist = 'A long artist credit with featured singers '.repeat(2) + 'A'.repeat(100);
    state.title = 'An extended festive song title '.repeat(2) + 'T'.repeat(100);
    await refresh();
    await expect(artist).toHaveText(state.artist);
    await expect(title).toHaveText(state.title);
    await assertLayout();
    state.artist = '  Ariana Grande  ';
    state.title = '   ';
    await refresh();
    await expect(artist).toHaveText('Ariana Grande');
    await expect(title).toHaveCount(0);
    state.artist = ' ';
    state.title = '  Winter Things  ';
    await refresh();
    await expect(artist).toHaveCount(0);
    await expect(title).toHaveText('Winter Things');
    await expect(card.locator('img')).toHaveAttribute('src', '/artist-artwork/santa-fallback.webp');
    state.title = '';
    await refresh();
    await expect(card.locator('.now-playing-artwork__fallback')).toHaveText('Santa Radio live');
    await expect(artist).toHaveCount(0);
    await expect(title).toHaveCount(0);
    // An unavailable payload may still carry previous values; none may leak.
    state.artist = 'Ariana Grande';
    state.title = 'Last Christmas';
    state.retainCurrent = true;
    state.unavailable = true;
    await refresh();
    await expect(card.locator('.now-playing-artwork__fallback')).toHaveText('Santa Radio live');
    await expect(card).not.toContainText('Ariana Grande');
    await expect(card).not.toContainText('Last Christmas');
    await expect(card).toHaveAttribute('aria-label', 'Santa Radio now-playing artwork');
    const playButton = page.locator('.hero-actions').getByRole('button', { name: 'Pause Radio', exact: true });
    await playButton.click();
    await expect(card).toHaveCount(0);
    await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
    await expect(card.locator('.now-playing-artwork__fallback')).toHaveText('Santa Radio live');
    state.unavailable = false;
    await refresh();
    await expect(artist).toHaveText('Ariana Grande');
    await expect(title).toHaveText('Last Christmas');
  });
}
