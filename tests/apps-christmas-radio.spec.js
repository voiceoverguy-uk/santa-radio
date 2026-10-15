import { test, expect } from '@playwright/test';

const labels = ['From the makers of Santa Radio', 'Over 100k downloads', 'Christmas music 365 days a year', 'Make it feel like Christmas'];
const regionName = 'Christmas Radio promotional images';
const button = (carousel, index) => carousel.getByRole('button', { name: `Show ${labels[index]} promotional image`, exact: true });

async function open(page, waitUntil = 'load') {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps', { waitUntil });
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  await page.mouse.move(0, 0);
  return page.getByRole('region', { name: regionName, exact: true });
}

async function ready(carousel) {
  for (let index = 0; index < 4; index++) await expect(button(carousel, index)).toBeEnabled();
}

async function expectSlide(carousel, index) {
  await expect(button(carousel, index)).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await expect(carousel.locator('.is-active')).toHaveAttribute('aria-hidden', 'false');
  await expect(carousel.locator('.app-screenshots-caption')).toHaveText(`${labels[index]} · ${index + 1} of 4`);
}

test('Christmas Radio delivers four ordered full-size local promotions with app-specific labels and unchanged listing', async ({ page }) => {
  const carousel = await open(page);
  await ready(carousel);
  await expect(carousel.getByRole('group', { name: 'Choose a Christmas Radio promotional image' })).toBeVisible();
  await expect(carousel.locator('figcaption')).toHaveText(regionName);
  await expect(carousel).toContainText('not interactive website controls');
  await expect(carousel).not.toContainText('iOS screenshots only');
  await expect(carousel.getByRole('button')).toHaveCount(5);
  for (let index = 0; index < 4; index++) {
    const image = carousel.locator('img').nth(index);
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`^/.*christmas-radio-promo-${index + 1}.*\\.webp`));
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([851, 1849]);
    await expect(image).toHaveAttribute('width', '851');
    await expect(image).toHaveAttribute('height', '1849');
    await expect(image).toHaveAttribute('alt', /^Christmas Radio promotional image:/);
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
    expect((await response.body()).length).toBeLessThan(400000);
  }
  const section = page.locator('#christmasradio');
  await expect(section.getByRole('link', { name: /on iOS/ })).toHaveAttribute('href', 'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613');
  await expect(section.getByRole('link', { name: /on Amazon/ })).toHaveAttribute('href', 'https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV');
  await expect(section.locator('.app-store-card')).toHaveCount(2);
  await expect(section.locator('.feature-label')).toHaveText(['Christmas Music 24/7', 'Record a Message', 'Share', 'Send a message', 'Download price', 'Background player']);
  await expect(page.locator('.app-store-notice')).toContainText('Christmas Radio’s four promotional images were supplied by the owner');
  await expect(page.locator('.app-store-notice')).toContainText('Other app screenshots and catalogue feature descriptions are from the legacy catalogue');
});

test('Christmas Radio holds for five seconds, crossfades and wraps independently of the other slideshows', async ({ page }) => {
  const carousel = await open(page);
  await ready(carousel);
  // Reset the timer after decoding, without depending on network timing.
  await carousel.hover();
  await page.mouse.move(0, 0);
  expect(await carousel.locator('.is-active').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.65s');
  await page.clock.fastForward(4999);
  await expectSlide(carousel, 0);
  await page.clock.fastForward(1);
  await expectSlide(carousel, 1);
  for (const index of [2, 3, 0]) {
    await page.clock.fastForward(5000);
    await expectSlide(carousel, index);
  }
  await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
  await page.locator('h1').click();
  await page.mouse.move(0, 0);
  const ios = page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' });
  const watch = page.getByRole('region', { name: 'Santa Radio Apple Watch promotional images' });
  for (const other of [ios, watch]) {
    for (const control of await other.locator('.app-screenshots-dot').all()) await expect(control).toBeEnabled();
    await other.hover();
    await page.mouse.move(0, 0);
  }
  const before = await Promise.all([ios, watch].map(other => other.locator('.app-screenshots-caption').textContent()));
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 0);
  for (const [index, other] of [ios, watch].entries()) {
    await expect(other.locator('.app-screenshots-caption')).not.toHaveText(before[index]);
  }
});

test('Christmas Radio supports keyboard selection, pause/resume, focus, hover and hidden-tab safeguards', async ({ page }) => {
  const carousel = await open(page);
  await ready(carousel);
  await button(carousel, 0).focus();
  await page.keyboard.press('Tab');
  await expect(button(carousel, 1)).toBeFocused();
  expect(await button(carousel, 1).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expectSlide(carousel, 1);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
  await page.locator('h1').click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await carousel.getByRole('button', { name: 'Resume slideshow' }).click();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await page.locator('h1').click();
  await carousel.hover();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 2);
});

test('Christmas Radio reduced motion is static with a stable, uncropped frame on desktop and narrow phones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await open(page);
  await ready(carousel);
  await expect(carousel.getByRole('button', { name: 'Resume slideshow' })).toBeVisible();
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 0);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await carousel.boundingBox();
    for (let index = 0; index < 4; index++) {
      await button(carousel, index).click();
      await expectSlide(carousel, index);
      const after = await carousel.boundingBox();
      expect(after.width).toBeCloseTo(before.width, 1);
      expect(after.height).toBeCloseTo(before.height, 1);
      const image = await carousel.locator('.is-active').evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { ratio: rect.width / rect.height, fit: style.objectFit, transition: style.transitionDuration, x: rect.x, right: rect.right };
      });
      expect(image.ratio).toBeCloseTo(851 / 1849, 3);
      expect(image.fit).toBe('contain');
      expect(image.transition).toBe('0s');
      expect(image.x).toBeGreaterThanOrEqual(0);
      expect(image.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await carousel.screenshot({ path: `generated-artifacts/apps-christmas-radio-${width}.jpg` });
  }
});

test('Christmas Radio waits for decoded artwork before rotation or manual selection', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/christmas-radio-promo-2*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue();
    await held;
    await route.continue();
  });
  const carousel = await open(page, 'domcontentloaded');
  await expect(button(carousel, 0)).toBeEnabled();
  await expect(button(carousel, 1)).toBeDisabled();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 0);
  release();
  await ready(carousel);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 1);
});

test('Christmas Radio image failures keep the ready artwork and report a promotional-image error', async ({ page }) => {
  await page.route('**/christmas-radio-promo-2*', route => (
    route.request().resourceType() === 'image' ? route.abort() : route.continue()
  ));
  const carousel = await open(page);
  await expect(button(carousel, 0)).toBeEnabled();
  await expect(button(carousel, 1)).toBeDisabled();
  await expect(carousel.getByRole('status')).toHaveText('Some promotional images could not load. Please reload to try again.');
  const before = await carousel.locator('.app-screenshots-frame').boundingBox();
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 0);
  expect(await carousel.locator('.app-screenshots-frame').boundingBox()).toEqual(before);
});
