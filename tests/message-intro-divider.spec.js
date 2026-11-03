import { test, expect } from '@playwright/test';

test('message heading has a decorative gold star between two fading rules', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
  });
  await page.goto('/');
  const divider = page.locator('.message-intro-divider');
  await expect(divider).toHaveAttribute('aria-hidden', 'true');
  await expect(divider).toHaveText('★');
  await expect(page.locator('.message-intro > .eyebrow + .message-intro-divider + h2')).toHaveText('FREE Personalised message from Santa');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(divider).toBeVisible();
    expect(await divider.evaluate(el => {
      const box = el.getBoundingClientRect();
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      return box.width <= el.parentElement.clientWidth &&
        before.backgroundImage.includes('linear-gradient') &&
        after.backgroundImage.includes('linear-gradient');
    })).toBe(true);
  }
});
