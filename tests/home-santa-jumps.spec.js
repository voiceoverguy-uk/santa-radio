import { test, expect } from '@playwright/test';

const strip = '**/images/santa-dash/classic-jump-strip.png';
const root = '.homepage-santa-runner';

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
});

async function openRunner(page, motion = 'no-preference') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(() => {
    window.jumpRandom = 0;
    Math.random = () => window.jumpRandom;
    window.jumpDocumentHidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true, get: () => window.jumpDocumentHidden,
    });
  });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const lane = page.locator(root);
  await lane.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(lane).toBeVisible();
  await expect(lane).toHaveAttribute('data-jump-enabled', motion === 'reduce' ? 'false' : 'true');
  return lane;
}

async function freezeAndReset(page, lane, requireReady = true) {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-05T12:00:10Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await expect(lane).toHaveAttribute('data-jump-enabled', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(lane).toHaveAttribute('data-jump-enabled', 'true');
  if (requireReady) await expect(lane).toHaveAttribute('data-jump-ready', 'true');
}

for (const width of [320, 1440]) {
  test(`homepage Santa hops in both directions and lands at the same floor at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    const lane = await openRunner(page);
    await expect(lane).toHaveAttribute('data-jump-ready', 'true');
    await freezeAndReset(page, lane);
    const delayBounds = await page.evaluate(async () => {
      const { nextJumpDelay } = await import('/src/components/HomepageSantaRunner.jsx');
      return [nextJumpDelay(() => 0), nextJumpDelay(() => .5), nextJumpDelay(() => .999999)];
    });
    expect(delayBounds).toEqual([5000, 8500, 12000]);
    await lane.evaluate(node => {
      const travel = node.querySelector('.studio-runner-travel').getAnimations()[0];
      const face = node.querySelector('.homepage-santa-facing').getAnimations()[0];
      travel.pause(); face.pause();
      window.runnerBeforeJumps = { travel, face, image: node.querySelector('img') };
    });
    const before = await lane.evaluate(node => {
      const image = node.querySelector('img').getBoundingClientRect();
      return { floorOffset: image.bottom - node.getBoundingClientRect().bottom, height: image.height };
    });
    const geometry = await lane.evaluate(node => {
      const section = node.closest('section');
      const box = section.getBoundingClientRect();
      return { sectionHeight: box.height,
        buttonGap: node.getBoundingClientRect().bottom -
          section.querySelector('.santa-dash-promo__download').getBoundingClientRect().bottom,
        floorGap: box.bottom - node.getBoundingClientRect().bottom };
    });
    for (const [index, directionTime] of [1000, 8000].entries()) {
      await lane.evaluate((node, time) => {
        node.querySelector('.studio-runner-travel').getAnimations()[0].currentTime = time;
        node.querySelector('.homepage-santa-facing').getAnimations()[0].currentTime = time;
      }, directionTime);
      // Skip unrelated snow/video RAF work while checking real timer bounds.
      // The actual CSS arc and all sprite frames are sampled below.
      await page.clock.fastForward(index === 0 ? 4999 : 11999);
      await expect(lane).toHaveAttribute('data-jumping', 'false');
      await page.clock.runFor(1);
      await expect(lane).toHaveAttribute('data-jumping', 'true');
      await expect(lane.locator('.homepage-santa-sprite')).toHaveCount(1);
      await expect(lane.locator('picture')).toHaveCSS('visibility', 'hidden');
      const samples = await lane.evaluate(node => {
        const hopNode = node.querySelector('.homepage-santa-hop');
        const hop = hopNode.getAnimations()[0];
        const spriteNode = node.querySelector('.homepage-santa-sprite');
        const sprite = spriteNode.getAnimations()[0];
        hop.pause(); sprite.pause();
        const result = [0, 100, 200, 275, 300, 400, 500, 550].map(time => {
          hop.currentTime = sprite.currentTime = time;
          const box = spriteNode.getBoundingClientRect(), lane = node.getBoundingClientRect();
          return { time, y: new DOMMatrix(getComputedStyle(hopNode).transform).m42,
            frame: parseFloat(getComputedStyle(spriteNode).backgroundPositionX),
            face: new DOMMatrix(getComputedStyle(node.querySelector('.homepage-santa-facing')).transform).a,
            fits: box.left >= lane.left && box.right <= lane.right && box.top >= lane.top,
            width: box.width, height: box.height };
        });
        hop.currentTime = sprite.currentTime = 275;
        return result;
      });
      expect(samples.filter(sample => sample.time !== 275).slice(0, 6).map(sample => sample.frame))
        .toEqual([0, 20, 40, 60, 80, 100]);
      for (const sample of samples) {
        expect(sample.face).toBe(index === 0 ? 1 : -1);
        expect(sample.fits).toBe(true);
        expect(sample.height).toBe(64);
        expect(sample.width).toBeCloseTo(64 * 136 / 163, 1);
      }
      expect(samples.find(sample => sample.time === 0).y).toBeCloseTo(0);
      expect(samples.find(sample => sample.time === 275).y).toBeCloseTo(-20);
      expect(samples.find(sample => sample.time === 550).y).toBeCloseTo(0);
      await page.locator('.santa-dash-promo').screenshot({
        path: `generated-artifacts/santa-jump-${width}-${index === 0 ? 'right' : 'left'}.png`,
      });
      // Select a fresh maximum-length delay at landing, not at take-off.
      await page.evaluate(() => { window.jumpRandom = .999999; });
      await page.clock.fastForward(550);
      await expect(lane).toHaveAttribute('data-jumping', 'false');
      await expect(lane.locator('.homepage-santa-sprite')).toHaveCount(0);
      await expect(lane.locator('picture')).toHaveCSS('visibility', 'visible');
      const after = await lane.evaluate(node => {
        const image = node.querySelector('img').getBoundingClientRect();
        return { floorOffset: image.bottom - node.getBoundingClientRect().bottom, height: image.height };
      });
      expect(after.floorOffset).toBeCloseTo(before.floorOffset, 1);
      expect(after.height).toBe(before.height);
      expect(await lane.evaluate(node => {
        const original = window.runnerBeforeJumps;
        return node.querySelector('img') === original.image &&
          node.querySelector('.studio-runner-travel').getAnimations()[0] === original.travel &&
          node.querySelector('.homepage-santa-facing').getAnimations()[0] === original.face;
      })).toBe(true);
      expect(await lane.evaluate(node => ({
        sectionHeight: node.closest('section').getBoundingClientRect().height,
        buttonGap: node.getBoundingClientRect().bottom -
          node.closest('section').querySelector('.santa-dash-promo__download').getBoundingClientRect().bottom,
        floorGap: node.closest('section').getBoundingClientRect().bottom - node.getBoundingClientRect().bottom,
      }))).toEqual(geometry);
    }
  });
}

test('hidden, offscreen, reduced motion and unmount cancel pending and active homepage jumps', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const lane = await openRunner(page);
  await expect(lane).toHaveAttribute('data-jump-ready', 'true');
  await freezeAndReset(page, lane);
  await page.clock.fastForward(5000);
  await expect(lane).toHaveAttribute('data-jumping', 'true');
  await page.evaluate(() => {
    window.jumpDocumentHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await expect(lane).toHaveAttribute('data-jump-enabled', 'false');
  await page.clock.fastForward(30000);
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await page.evaluate(() => {
    window.jumpDocumentHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(lane).toHaveAttribute('data-jump-enabled', 'true');
  await page.clock.fastForward(5000);
  await expect(lane).toHaveAttribute('data-jumping', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(lane).toHaveAttribute('data-jump-enabled', 'false');
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await page.clock.fastForward(30000);
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await lane.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(lane).toHaveAttribute('data-jump-enabled', 'true');
  await page.clock.fastForward(5000);
  await expect(lane).toHaveAttribute('data-jumping', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await expect(lane).toHaveAttribute('data-jump-enabled', 'false');
  await expect.poll(() => lane.locator('img').evaluate(node => node.currentSrc)).toContain('classic-still.png');
  expect(await lane.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.clock.fastForward(30000);
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(lane).toHaveAttribute('data-jump-enabled', 'true');
  await page.clock.fastForward(5000);
  await expect(lane).toHaveAttribute('data-jumping', 'true');
  await page.getByRole('link', { name: 'Apps', exact: true }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(page.locator(root)).toHaveCount(0);
  await page.clock.fastForward(30000);
  expect(errors).toEqual([]);
});

test('reduced motion never loads the jump strip or animated running image', async ({ page }) => {
  const images = [];
  page.on('request', request => {
    if (/classic(?:-jump-strip\.png|-still\.png|\.webp)/.test(request.url())) images.push(request.url());
  });
  const lane = await openRunner(page, 'reduce');
  await expect.poll(() => lane.locator('img').evaluate(node => node.currentSrc)).toContain('classic-still.png');
  await expect(lane).toHaveAttribute('data-jump-ready', 'false');
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  expect(images.some(url => url.includes('classic-still.png'))).toBe(true);
  expect(images.some(url => url.includes('classic-jump-strip.png') || url.endsWith('classic.webp'))).toBe(false);
  expect(await lane.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test('missing jump artwork leaves the original running Santa working', async ({ page }) => {
  await page.route(strip, route => route.abort());
  const lane = await openRunner(page);
  await freezeAndReset(page, lane, false);
  await expect(lane).toHaveAttribute('data-jump-ready', 'false');
  await page.clock.fastForward(30000);
  await expect(lane).toHaveAttribute('data-jumping', 'false');
  await expect(lane.locator('img')).toBeVisible();
  await expect(lane.locator('.studio-runner-travel')).toHaveCSS('animation-name', 'studio-runner-cross');
  await expect(lane.locator('.homepage-santa-facing')).toHaveCSS('animation-name', 'studio-runner-face');
});
