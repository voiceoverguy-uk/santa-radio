import { test, expect } from '@playwright/test';

test('song and karaoke videos grant fullscreen only after media consent and unload on withdrawal', async ({ page }) => {
  let embedRequests = 0;
  await page.route('https://www.youtube.com/embed/**', route => {
    embedRequests++;
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test provider</title>' });
  });
  for (const path of [
    '/christmas-artist/60-chris-rea-driving-home-for-christmas',
    '/christmas-karaoke-lyrics/60-chris-rea-driving-home-for-christmas',
  ]) {
    const before = embedRequests;
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const video = page.locator('iframe[src^="https://www.youtube.com/embed/"]');
    await expect(video).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable external media', exact: true })).toBeVisible();
    expect(embedRequests).toBe(before);
    await page.getByRole('button', { name: 'Enable external media', exact: true }).click();
    await expect(video).toHaveCount(1);
    await video.scrollIntoViewIfNeeded();
    await expect.poll(() => embedRequests).toBe(before + 1);
    await expect(video).toHaveAttribute('allowfullscreen', '');
    await expect(video).toHaveAttribute('allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
    expect(new URL(await video.getAttribute('src')).searchParams.has('autoplay')).toBe(false);
    expect(new URL(await video.getAttribute('src')).searchParams.has('fs')).toBe(false);
    expect(await video.evaluate(frame => frame.featurePolicy.allowsFeature('fullscreen'))).toBe(true);
    await page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true }).click();
    await page.locator('.marketing-consent').getByRole('button', {
      name: 'Decline optional cookies', exact: true,
    }).click();
    await expect(video).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable external media', exact: true })).toBeVisible();
    expect(embedRequests).toBe(before + 1);
  }
});

test('unreachable webcam can be enabled and unloaded without a disclosure below it', async ({ page }) => {
  let embedRequests = 0;
  await page.route('https://www.youtube.com/embed/**', route => {
    embedRequests++;
    return route.abort('failed');
  });
  await page.goto('/');
  await page.locator('.marketing-consent').getByRole('button', {
    name: 'Decline optional cookies', exact: true,
  }).click();
  const webcam = page.locator('.youtube-section');
  await expect(webcam.locator('.video-disclosure')).toHaveCount(0);
  await expect(webcam.locator('iframe')).toHaveCount(0);
  expect(embedRequests).toBe(1);
  await webcam.getByRole('button', { name: 'Enable external media' }).click();
  await expect.poll(() => embedRequests).toBe(2);
  await expect(webcam.getByRole('link', { name: 'Watch directly on YouTube', exact: true })).toHaveCount(0);
  await page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await page.locator('.marketing-consent').getByRole('button', {
    name: 'Decline optional cookies', exact: true,
  }).click();
  await expect(webcam.locator('iframe')).toHaveCount(0);
  await expect(webcam.getByRole('link', { name: 'Open on YouTube instead (new tab)' })).toBeVisible();
});

test('automatic webcam attempts muted inline autoplay and pause/resume leaves radio untouched', async ({ page }) => {
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: 'Mock video provider' }));
  await page.addInitScript(() => {
    window.radioCalls = { play: 0, pause: 0 };
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      window.radioCalls.play++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () { window.radioCalls.pause++; };
  });
  await page.goto('/');
  await expect(page.locator('.radio-dock')).toBeVisible();
  await page.evaluate(() => window.originalRadioAudio = document.querySelector('audio'));
  await page.locator('.radio-dock').getByRole('button', { name: 'Listen Live', exact: true }).click();
  const video = page.locator('.tv-screen iframe');
  await expect(video).toHaveCount(1);
  const url = new URL(await video.getAttribute('src'));
  expect(url.origin).toBe('https://www.youtube.com');
  expect(url.pathname).toBe('/embed/mMrHniQJNCM');
  for (const [name, value] of Object.entries({ si: 'O7nNcINykyWwgyXC', autoplay: '1', mute: '1', controls: '0', disablekb: '1', playsinline: '1', fs: '0' })) {
    expect(url.searchParams.get(name)).toBe(value);
  }
  await expect(video).toHaveAttribute('allow', 'autoplay; encrypted-media');
  await expect(video).not.toHaveAttribute('allowfullscreen');
  expect(await video.evaluate(frame => frame.featurePolicy.allowsFeature('fullscreen'))).toBe(false);
  await expect(video).toHaveAttribute('inert', '');
  await expect(video).toHaveAttribute('tabindex', '-1');
  await expect(video).toHaveCSS('pointer-events', 'none');
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await expect(video).toHaveCount(0);
  await expect(page.locator('.tv-screen')).toContainText('Live video paused');
  await page.getByRole('button', { name: 'Resume muted video' }).click();
  await expect(video).toHaveAttribute('src', url.href);
  await expect(video).toHaveAttribute('allow', 'autoplay; encrypted-media');
  await expect(video).not.toHaveAttribute('allowfullscreen');
  await expect(page.locator('.youtube-section .video-disclosure')).toHaveCount(0);
  await page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await page.locator('.marketing-consent').getByRole('button', {
    name: 'Decline optional cookies', exact: true,
  }).click();
  await expect(video).toHaveCount(0);
  await expect(page.locator('.youtube-section .video-disclosure')).toHaveCount(0);
  expect(await page.evaluate(() => window.originalRadioAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.radioCalls)).toEqual({ play: 1, pause: 0 });
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
});
