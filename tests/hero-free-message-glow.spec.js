import { test, expect } from '@playwright/test';

test('updated hero copy sits closely below its heading with and without radio artwork', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { artist: 'John Legend', title: 'Bring Me Love' }, currentStatus: 'ready',
    upcoming: [], upcomingStatus: 'ready',
  } }));
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(page.locator('.hero-title')).toHaveAccessibleName('Santa Radio MORE MAGIC FROM THE NORTH POLE');
    await expect(page.locator('.hero-description')).toHaveText(
      'Festive treats, free apps, games, a Naughty and Nice List checker, Santa Tracker and FREE personalised messages from Santa.');
    const radio = page.locator(width < 768 ? '.nav-radio-icon' : '.hero-actions button');
    for (const playing of [false, true]) {
      if (playing) {
        await radio.click();
        await expect(page.locator('.hero .now-playing-artwork')).toBeVisible();
      }
      const geometry = await page.locator('.hero-description').evaluate(node => ({
        gap: node.getBoundingClientRect().top - document.querySelector('.hero-title').getBoundingClientRect().bottom,
        fits: node.scrollWidth <= node.clientWidth + 1,
      }));
      expect(geometry.fits).toBe(true);
      if (width >= 768) {
        expect(geometry.gap).toBeGreaterThanOrEqual(12);
        expect(geometry.gap).toBeLessThanOrEqual(24);
      }
      if (playing) await radio.click();
    }
  }
});

test('only FREE MESSAGE pulses without shifting the heading and respects reduced motion', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.goto('/');
  const heading = page.locator('.hero-name-checker h2');
  const glow = heading.locator('.hero-name-checker__free-glow');
  await expect(heading).toHaveAccessibleName('A FREE MESSAGE FROM SANTA');
  await expect(glow).toHaveText('FREE MESSAGE');
  await expect(glow).toHaveCSS('animation-name', 'hero-free-message-glow');
  await expect(heading).toHaveCSS('animation-name', 'none');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const measured = await glow.evaluate(node => {
      const animation = node.getAnimations()[0];
      animation.pause();
      animation.currentTime = 0;
      const before = node.getBoundingClientRect().toJSON();
      const shadow = getComputedStyle(node).textShadow;
      animation.currentTime = 1400;
      return { before, after: node.getBoundingClientRect().toJSON(),
        shadow, peakShadow: getComputedStyle(node).textShadow };
    });
    expect(measured.after).toEqual(measured.before);
    expect(measured.peakShadow).not.toBe(measured.shadow);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(glow).toHaveCSS('animation-name', 'none');
  await expect(heading).toHaveAccessibleName('A FREE MESSAGE FROM SANTA');
});
