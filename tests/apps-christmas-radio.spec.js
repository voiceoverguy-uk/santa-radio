import { test, expect } from './fixtures/apps-test.js';

const regionName = 'Christmas Radio promotional images';

async function open(page, waitUntil = 'load') {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps', { waitUntil });
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.mouse.move(0, 0);
  return page.getByRole('region', { name: regionName, exact: true });
}

async function ready(carousel) {
  await expect.poll(() => carousel.locator('img').evaluateAll(images =>
    images.every(image => image.complete && image.naturalWidth > 0)
  )).toBe(true);
  await carousel.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
}

async function expectSlide(carousel, index) {
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await expect(carousel.locator('.is-active')).toHaveAttribute('aria-hidden', 'false');
  await expect(carousel.locator('img').nth(index)).toHaveClass(/is-active/);
  await expect(carousel.locator('.app-screenshots-caption, .app-screenshots-controls, .app-screenshots-dots, .app-screenshots-toggle')).toHaveCount(0);
  await expect(carousel.getByRole('button')).toHaveCount(0);
}

test('Christmas Radio delivers four ordered approved display extractions with unchanged listing', async ({ page }) => {
  const carousel = await open(page);
  await ready(carousel);
  await expect(carousel.locator('figcaption')).toHaveText(regionName);
  await expect(carousel.locator('.app-screenshots-note')).toHaveCount(0);
  await expect(carousel).not.toContainText('iOS screenshots only');
  await expect(carousel.getByRole('button')).toHaveCount(0);
  for (let index = 0; index < 4; index++) {
    const image = carousel.locator('img').nth(index);
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`^/.*christmas-radio-screen-${index + 1}.*\\.webp`));
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([520, 1130]);
    await expect(image).toHaveAttribute('width', '520');
    await expect(image).toHaveAttribute('height', '1130');
    await expect(image).toHaveAttribute('alt', /^Christmas Radio app/);
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
    expect((await response.body()).length).toBeLessThan(400000);
  }
  const section = page.locator('#christmasradio');
  await expect(section.getByRole('link', { name: /Download on the App Store/ })).toHaveAttribute('href', 'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613');
  await expect(section.getByRole('link', { name: /Download on Amazon Appstore/ })).toHaveAttribute('href', 'https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV');
  await expect(section.locator('.app-store-card, .app-store-details')).toHaveCount(0);
  await expect(section.locator('.feature-label')).toHaveText(['Christmas Music 24/7', 'Record a Message', 'Share', 'Send a message', 'Download price', 'Background player']);
  await expect(page.locator('.app-store-notice')).toHaveCount(0);
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
  const ios = page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' });
  const watch = page.getByRole('region', { name: 'Santa Radio Apple Watch promotional images' });
  for (const other of [ios, watch]) await ready(other);
  const before = await Promise.all([ios, watch].map(other => other.locator('.is-active').getAttribute('src')));
  await carousel.hover();
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 0);
  for (const [index, other] of [ios, watch].entries())
    await expect(other.locator('.is-active')).not.toHaveAttribute('src', before[index]);
});

test('Christmas Radio hover and hidden-tab safeguards suspend automatic rotation', async ({ page }) => {
  const carousel = await open(page);
  await ready(carousel);
  await carousel.hover();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 0);
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 1);
  await carousel.hover();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.mouse.move(0, 0);
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
  await expect(carousel.getByRole('button')).toHaveCount(0);
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 0);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await carousel.boundingBox();
    const after = await carousel.boundingBox();
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
    const image = await carousel.locator('.is-active').evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { ratio: rect.width / rect.height, fit: style.objectFit, transition: style.transitionDuration, x: rect.x, right: rect.right };
    });
    expect(image.ratio).toBeCloseTo(520 / 1130, 3);
    expect(image.fit).toBe('contain');
    expect(image.transition).toBe('0s');
    expect(image.x).toBeGreaterThanOrEqual(0);
    expect(image.right).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await carousel.screenshot({ path: `generated-artifacts/apps-christmas-radio-${width}.jpg` });
  }
});

test('Christmas Radio waits for decoded artwork before automatic rotation', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/christmas-radio-screen-2*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue();
    await held;
    await route.continue();
  });
  const carousel = await open(page, 'domcontentloaded');
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 0);
  release();
  await ready(carousel);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 1);
});

test('Christmas Radio image failures keep the ready display and report a screenshot error', async ({ page }) => {
  await page.route('**/christmas-radio-screen-2*', route => (
    route.request().resourceType() === 'image' ? route.abort() : route.continue()
  ));
  const carousel = await open(page);
  await expect(carousel.getByRole('status')).toHaveText('Some screenshots could not load. Please reload to try again.');
  const before = await carousel.locator('.app-screenshots-frame').boundingBox();
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 0);
  expect(await carousel.locator('.app-screenshots-frame').boundingBox()).toEqual(before);
});
