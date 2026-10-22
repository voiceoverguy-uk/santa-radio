import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const destination = 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397';

test('homepage advert dissolves between both artworks every four seconds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const promo = page.getByRole('region', { name: 'Santa Dash — Back to the Grotto', exact: true });
  const slides = promo.locator('.santa-dash-promo__artwork');
  await promo.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(() => slides.nth(1).evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await slides.nth(0).evaluate(el => getComputedStyle(el).animationDuration)).toBe('8s');

  const opacityAt = async (time) => {
    await slides.evaluateAll((images, currentTime) => {
      for (const image of images) {
        const animation = image.getAnimations()[0];
        animation.pause();
        animation.currentTime = currentTime;
      }
    }, time);
    return Promise.all([0, 1].map(index => slides.nth(index).evaluate(el => Number(getComputedStyle(el).opacity))));
  };

  expect(await opacityAt(3500)).toEqual([1, 0]);
  const duringDissolve = await opacityAt(4000);
  expect(duringDissolve[0]).toBeGreaterThan(0);
  expect(duringDissolve[0]).toBeLessThan(1);
  expect(duringDissolve[1]).toBeGreaterThan(0);
  expect(duringDissolve[1]).toBeLessThan(1);
  expect(await opacityAt(4500)).toEqual([0, 1]);
  expect(await opacityAt(8000)).toEqual([1, 0]);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await slides.nth(0).evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await slides.nth(1).evaluate(el => getComputedStyle(el).display)).toBe('none');
});

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const host = new URL(test.info().project.use.baseURL).hostname;
    return new URL(route.request().url()).hostname === host ? route.continue() : route.abort();
  });
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('homepage advert remains complete, readable and keyboard accessible on desktop and phones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const promo = page.getByRole('region', { name: 'Santa Dash — Back to the Grotto', exact: true });
  const artwork = promo.locator('.santa-dash-promo__artwork').first();
  const artworkLink = promo.getByRole('link', { name: 'View Santa Dash — Back to the Grotto on the App Store (opens in a new tab)', exact: true });
  const download = promo.getByRole('link', { name: 'Download Santa Dash for iPhone and iPad (opens in a new tab)', exact: true });

  for (const width of [1440, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await promo.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(promo).toBeVisible();
    await expect(download).toBeVisible();
    await expect(artwork).toHaveAttribute('loading', 'lazy');
    await expect.poll(() => artwork.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    const geometry = await artwork.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight, left: rect.left, right: rect.right };
    });
    expect(geometry.naturalWidth).toBe(1600);
    expect(geometry.naturalHeight).toBe(554);
    expect(geometry.width / geometry.height).toBeCloseTo(1600 / 554, 2);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    const secondArtwork = promo.locator('.santa-dash-promo__artwork').nth(1);
    await expect(secondArtwork).toHaveAttribute('aria-hidden', 'true');
    expect(await secondArtwork.evaluate(el => [el.width, el.height])).toEqual([1600, 555]);
    expect(await artwork.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    expect(await secondArtwork.evaluate(el => getComputedStyle(el).display)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const button = await download.boundingBox();
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(await download.evaluate(el => getComputedStyle(el).fontSize)).not.toBe('0px');
    for (const link of [artworkLink, download]) {
      await expect(link).toHaveAttribute('href', destination);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await artworkLink.focus();
    await page.keyboard.press('Tab');
    await expect(download).toBeFocused();
    expect(await download.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    if (width === 1440 || width === 390) {
      mkdirSync('generated-artifacts/santa-dash-home', { recursive: true });
      await promo.screenshot({ path: `generated-artifacts/santa-dash-home/${width}.jpg` });
    }
  }

  // Activate both real links by keyboard without relying on external store availability.
  await page.context().route('https://itunes.apple.com/**', route => route.fulfill({
    contentType: 'text/html', body: '<title>App Store destination</title>',
  }));
  for (const link of [artworkLink, download]) {
    await link.focus();
    const popupPromise = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup = await popupPromise;
    await expect(popup).toHaveURL(destination);
    await popup.close();
  }
});
