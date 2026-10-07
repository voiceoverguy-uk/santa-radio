import { test, expect } from '@playwright/test';

test('video loads muted without a click and cannot be unmuted through the page', async ({ page }) => {
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: 'Mock video provider' }));
  await page.goto('/');
  const video = page.locator('.tv-screen iframe');
  await expect(video).toHaveCount(1);
  const url = new URL(await video.getAttribute('src'));
  for (const [name, value] of Object.entries({ autoplay: '1', mute: '1', controls: '0', disablekb: '1', playsinline: '1' })) {
    expect(url.searchParams.get(name)).toBe(value);
  }
  await expect(video).toHaveAttribute('inert', '');
  await expect(video).toHaveAttribute('tabindex', '-1');
  await expect(video).toHaveCSS('pointer-events', 'none');
  await page.evaluate(() => window.originalRadioAudio = document.querySelector('audio'));
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await expect(video).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume muted video' }).click();
  await expect(video).toHaveAttribute('src', url.href);
  expect(await page.evaluate(() => window.originalRadioAudio === document.querySelector('audio'))).toBe(true);
});
