import { test, expect } from '@playwright/test';

test('permitted webcam autoplays muted and pause/resume leaves radio untouched', async ({ page }) => {
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
  await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await expect(page.locator('.radio-dock')).toBeVisible();
  await page.evaluate(() => window.originalRadioAudio = document.querySelector('audio'));
  await page.locator('.radio-dock').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await page.locator('.tv-screen').getByRole('button', { name: 'Enable external media' }).click();
  const video = page.locator('.tv-screen iframe');
  await expect(video).toHaveCount(1);
  const url = new URL(await video.getAttribute('src'));
  expect(url.origin).toBe('https://www.youtube.com');
  expect(url.pathname).toBe('/embed/mMrHniQJNCM');
  for (const [name, value] of Object.entries({ si: 'O7nNcINykyWwgyXC', autoplay: '1', mute: '1', controls: '0', disablekb: '1', playsinline: '1' })) {
    expect(url.searchParams.get(name)).toBe(value);
  }
  await expect(video).toHaveAttribute('allow', 'autoplay; encrypted-media');
  await expect(video).toHaveAttribute('inert', '');
  await expect(video).toHaveAttribute('tabindex', '-1');
  await expect(video).toHaveCSS('pointer-events', 'none');
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await expect(video).toHaveCount(0);
  await expect(page.locator('.tv-screen')).toContainText('Live video paused');
  await page.getByRole('button', { name: 'Resume muted video' }).click();
  await expect(video).toHaveAttribute('src', url.href);
  expect(await page.evaluate(() => window.originalRadioAudio === document.querySelector('audio'))).toBe(true);
  expect(await page.evaluate(() => window.radioCalls)).toEqual({ play: 1, pause: 0 });
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
});
