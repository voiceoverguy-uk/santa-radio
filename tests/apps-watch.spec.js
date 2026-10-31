import { test, expect } from './fixtures/apps-test.js';

const regionName = 'Santa Radio Apple Watch promotional images';

async function openWatch(page, waitUntil = 'load') {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps', { waitUntil });
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.mouse.move(0, 0);
  return page.getByRole('region', { name: regionName });
}

async function ready(carousel) {
  await expect.poll(() => carousel.locator('img').evaluateAll(images =>
    images.every(image => image.complete && image.naturalWidth > 0)
  )).toBe(true);
  await carousel.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
}

async function expectSlide(carousel, index) {
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await expect(carousel.locator('img').nth(index)).toHaveClass(/is-active/);
  await expect(carousel.locator('.is-active')).toHaveAttribute('aria-hidden', 'false');
  await expect(carousel.locator('.app-screenshots-caption, .app-screenshots-controls, .app-screenshots-dots, .app-screenshots-toggle')).toHaveCount(0);
  await expect(carousel.getByRole('button')).toHaveCount(0);
}

test('Watch follows iOS, precedes TV/Mac and explains paired-iPhone playback without unsupported claims', async ({ page }) => {
  const carousel = await openWatch(page);
  await ready(carousel);
  const section = page.getByRole('region', { name: 'Now available on Apple Watch', exact: true });
  await expect(section).toContainText('View the current song, artist and artwork, then start or pause playback on your paired iPhone.');
  await expect(section).toContainText('Music plays on your paired iPhone, not as standalone streaming from Apple Watch.');
  await expect(section).toContainText('not live website controls');
  await expect(section).not.toContainText(/Amazon|iOS screenshots|watchOS|FREE/);
  await expect(section.getByRole('link')).toHaveCount(0);
  await expect(carousel.getByRole('button')).toHaveCount(0);
  expect(await page.locator('#santaradio').evaluate(el => el.nextElementSibling.className)).toBe('apple-watch-showcase');
  expect(await section.evaluate(el => el.nextElementSibling.className)).toBe('apple-tv-showcase');
  await expect(page.locator('.app-section')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Santa Radio for Mac', exact: true })).toContainText('Coming soon');
  await expect(page.locator('.radio-dock')).toBeVisible();

  const images = carousel.locator('img');
  await expect(images).toHaveCount(2);
  for (let index = 0; index < 2; index++) {
    const image = images.nth(index);
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`^/.*santa-radio-watch-${index ? 'artwork' : 'controls'}.*\\.webp`));
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([1800, 2600]);
    await expect(image).toHaveAttribute('width', '1800');
    await expect(image).toHaveAttribute('height', '2600');
    await expect(image).toHaveAttribute('alt', /Apple Watch.*White December/);
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeLessThan(250000);
  }
  const ios = page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' });
  await expect(ios.locator('.app-screenshots-note')).toHaveCount(0);
  await expect(ios.getByRole('button')).toHaveCount(0);
});

test('Watch gently crossfades every five seconds and loops independently of iOS', async ({ page }) => {
  const carousel = await openWatch(page);
  await ready(carousel);
  // Reset elapsed time after both images decode.
  await carousel.hover();
  await page.mouse.move(0, 0);
  await expectSlide(carousel, 0);
  expect(await carousel.locator('.is-active').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.65s');
  await page.clock.fastForward(4999);
  await expectSlide(carousel, 0);
  await page.clock.fastForward(1);
  await expectSlide(carousel, 1);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 0);
});

test('Watch hover and tab visibility suspend automatic rotation', async ({ page }) => {
  const carousel = await openWatch(page);
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
  await expectSlide(carousel, 0);
});

test('Watch reduced motion is static and uncropped at desktop and phone sizes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await openWatch(page);
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
    expect(image.ratio).toBeCloseTo(1800 / 2600, 3);
    expect(image.fit).toBe('contain');
    expect(image.transition).toBe('0s');
    expect(image.x).toBeGreaterThanOrEqual(0);
    expect(image.right).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.apple-watch-showcase').screenshot({ path: `generated-artifacts/apps-watch-${width}.jpg` });
  }
});

test('Watch waits for the next image to decode before enabling or rotating to it', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/santa-radio-watch-artwork*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue();
    await held;
    await route.continue();
  });
  const carousel = await openWatch(page, 'domcontentloaded');
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 0);
  release();
  await ready(carousel);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 1);
});

test('Watch image failures are announced without replacing the ready image or shifting its frame', async ({ page }) => {
  await page.route('**/santa-radio-watch-artwork*', route => (
    route.request().resourceType() === 'image' ? route.abort() : route.continue()
  ));
  const carousel = await openWatch(page);
  await expect.poll(() => carousel.locator('img').nth(0).evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(carousel.getByRole('status')).toContainText('Some screenshots could not load.');
  const before = await carousel.locator('.app-screenshots-frame').boundingBox();
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 0);
  const after = await carousel.locator('.app-screenshots-frame').boundingBox();
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
});
