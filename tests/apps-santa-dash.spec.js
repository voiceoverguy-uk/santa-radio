import { test, expect } from './fixtures/apps-test.js';

async function open(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const phone = page.getByRole('region', { name: 'Santa Dash promotional artwork', exact: true });
  await expect.poll(() => phone.locator('img').evaluateAll(images => images.every(el => el.complete && el.naturalWidth > 0))).toBe(true);
  await phone.locator('img').evaluateAll(images => Promise.all(images.map(el => el.decode())));
  await phone.scrollIntoViewIfNeeded();
  await expect.poll(() => phone.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await page.mouse.move(0, 0);
  return phone;
}

test('Santa Dash uses the approved complete rooftop artwork inside a dark landscape phone and preserves its listing', async ({ page }) => {
  const phone = await open(page);
  await expect(phone).toHaveClass(/app-screenshots-device.*app-screenshots-landscape.*app-screenshots-dark-landscape/);
  await expect(phone.locator('.app-screenshot-slide')).toHaveCount(6);
  await expect(phone.locator('img')).toHaveCount(6);
  await expect(phone).toHaveAttribute('aria-roledescription', 'carousel');
  await expect(phone.locator('figcaption')).toHaveText('Santa Dash promotional artwork');
  await expect(phone.locator('.app-screenshots-note')).toHaveCount(0);
  const image = phone.locator('img').first();
  for (const screenshot of await phone.locator('img').all()) {
    const response = await page.request.get(await screenshot.getAttribute('src'));
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
  }
  for (const screenshot of (await phone.locator('img').all()).slice(1, 5)) {
    expect(await screenshot.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([2622, 1206]);
    await expect(screenshot).toHaveAttribute('alt', /Santa Dash title screen|Santa’s Shop/);
  }
  expect(await image.getAttribute('src')).toMatch(/^\/.*santa-dash-screen.*\.webp/);
  expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([1488, 676]);
  await expect(image).toHaveAttribute('width', '1488');
  await expect(image).toHaveAttribute('height', '676');
  await expect(image).toHaveAttribute('alt', /Back to the Grotto promotional artwork.*caption: Leap rooftops/);
  await expect(image).not.toHaveAttribute('alt', /gameplay/);
  const response = await page.request.get(await image.getAttribute('src'));
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/image\/webp/);
  expect((await response.body()).length).toBeLessThan(400000);
  const section = page.locator('#santadash');
  await expect(section.locator('.app-section-title')).toHaveText('Santa Dash');
  await expect(section.locator('.app-section-sub')).toHaveText('How far can you go while collecting mince pies?');
  await expect(section.getByRole('link')).toHaveCount(1);
  await expect(section.getByRole('link')).toHaveAttribute('href', 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397');
  await expect(section.locator('.feature-label')).toHaveText(['Fun Game', 'How far can you go?', 'Collect the pies', 'Links to other apps', 'Play with friends', 'Download price']);
  await expect(section.locator('.feature-desc')).toHaveText([
    'A festive jumping game.\nGreat for all ages over Christmas.',
    'See how far you can get,\nthen post your score on Twitter.',
    'Jump over the buildings\nand collect the mince pies. Easy?',
    'It also links out to our other apps.\nHave you got them all yet?',
    'Login to Game Centre and play with friends.\nWhy not send a challenge to others?',
    'Check the linked App Store\nfor current pricing.',
  ]);
});

test('Santa Dash randomly dissolves every five seconds without repeating the active image', async ({ page }) => {
  const phone = await open(page);
  const slides = phone.locator('img');
  const initial = await phone.locator('.is-active').getAttribute('src');
  await page.clock.fastForward(4999);
  await expect(phone.locator('.is-active')).toHaveAttribute('src', initial);
  // Select each supplied screen with controlled randomness, not a fixed slideshow order.
  for (const [index, random] of [0, .3, .45, .65].entries()) {
    await page.evaluate(value => { Math.random = () => value; }, random);
    await page.clock.fastForward(index === 0 ? 1 : 5000);
    await expect(slides.nth(index + 1)).toHaveClass(/is-active/);
    await expect(phone.locator('.is-active')).toHaveCount(1);
    expect(await slides.nth(index + 1).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.65s');
  }
  await phone.getByRole('button', { name: 'Pause automatic screen previews' }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  const paused = await phone.locator('.is-active').getAttribute('src');
  await page.clock.fastForward(15000);
  await expect(phone.locator('.is-active')).toHaveAttribute('src', paused);
  await phone.getByRole('button', { name: 'Resume automatic screen previews' }).click();
  await page.evaluate(() => { Math.random = () => 0; });
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.fastForward(5000);
  await expect(phone.locator('.is-active')).not.toHaveAttribute('src', paused);
});

test('artwork failures are reported without silently loading an older substitute', async ({ page }) => {
  await page.route('**/santa-dash-screen*', route => route.request().resourceType() === 'image' ? route.abort() : route.continue());
  await page.goto('/apps');
  const phone = page.getByRole('region', { name: 'Santa Dash promotional artwork', exact: true });
  await expect(phone.getByRole('status')).toHaveText('Some images could not load. Please reload to try again.');
  await expect(phone.locator('img')).toHaveCount(6);
});

test('reduced motion preserves the complete landscape display beside or above the unchanged feature cards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const phone = await open(page);
  await page.clock.fastForward(20000);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const frame = await phone.boundingBox();
    expect(frame.width).toBeGreaterThan(width >= 768 ? 300 : 250);
    const image = await phone.locator('.is-active').evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { ratio: rect.width / rect.height, fit: style.objectFit, transition: style.transitionDuration, x: rect.x, right: rect.right, width: rect.width };
    });
    expect(image.ratio).toBeCloseTo(1488 / 676, 3);
    expect(image.fit).toBe('contain');
    expect(image.transition).toBe('0s');
    expect(image.x).toBeGreaterThan(frame.x);
    expect(image.right).toBeLessThan(frame.x + frame.width);
    expect(image.width / frame.width).toBeGreaterThan(.85);
    expect(image.width / frame.width).toBeLessThan(.99);
    const copy = await page.locator('#santadash .app-copy').boundingBox();
    if (width >= 768) expect(copy.x).toBeGreaterThanOrEqual(frame.x + frame.width + 20);
    else expect(copy.y).toBeGreaterThanOrEqual(frame.y + frame.height + 20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await phone.screenshot({
      path: `generated-artifacts/apps-santa-dash-${width}.jpg`,
      style: '.radio-dock, .navbar { visibility: hidden !important; }',
    });
  }
});

async function gameplay(page, phone) {
  await page.evaluate(() => { Math.random = () => .999; });
  await page.clock.fastForward(5000);
  const video = phone.locator('video');
  await expect(video).toHaveCount(1);
  await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(.1);
  return video;
}

test('decoded gameplay runs to its end before advancing and starts afresh on repeat visits', async ({ page }) => {
  test.setTimeout(60000);
  const phone = await open(page);
  await expect(phone.locator('video')).toHaveCount(0);
  const video = await gameplay(page, phone);
  await video.evaluate(el => el.addEventListener('ended', () => {
    window.dashPlaybackEnd = { time: el.currentTime, duration: el.duration };
  }, { once: true }));
  const info = await video.evaluate(el => ({
    width: el.videoWidth, height: el.videoHeight, duration: el.duration,
    muted: el.muted, inline: el.playsInline, loop: el.loop,
  }));
  expect(info).toEqual({ width: 1600, height: 736, duration: expect.any(Number), muted: true, inline: true, loop: false });
  expect(info.duration).toBeCloseTo(9.033, 2);
  await page.clock.fastForward(5000);
  await expect(video).toHaveCount(1); // image dwell must not truncate a clip
  await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(5);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await phone.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const geometry = await video.evaluate(el => {
      const frame = el.closest('.app-screenshots-stack').getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const control = el.closest('figure').querySelector('button').getBoundingClientRect();
      return { fit: getComputedStyle(el).objectFit, contained: rect.left >= frame.left && rect.right <= frame.right + 1,
        controlClear: control.top >= rect.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry).toEqual({ fit: 'contain', contained: true, controlClear: true, overflow: false });
  }
  await expect(phone.locator('.app-screenshot-slide').nth(4)).toHaveClass(/is-active/, { timeout: 12000 });
  const ended = await page.evaluate(() => window.dashPlaybackEnd);
  expect(ended.time).toBeCloseTo(ended.duration, 2);
  await expect(video).toHaveCount(0);
  await phone.scrollIntoViewIfNeeded();
  await gameplay(page, phone);
  expect(await video.evaluate(el => el.currentTime)).toBeLessThan(2);
});

test('video respects independent manual, hover, focus, hidden and offscreen holds', async ({ page }) => {
  test.setTimeout(60000);
  const phone = await open(page);
  const video = await gameplay(page, phone);
  const paused = async () => {
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
    const before = await video.evaluate(el => el.currentTime);
    await page.waitForTimeout(350);
    expect(await video.evaluate(el => el.currentTime)).toBeCloseTo(before, 1);
    await page.clock.fastForward(20000);
    await expect(video).toHaveCount(1);
  };
  await phone.hover();
  await paused();
  await page.mouse.move(0, 0);
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  const button = phone.getByRole('button');
  await button.focus();
  await paused();
  await button.click(); // independent manual pause survives blur/mouse leave
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  await paused();
  await button.click();
  await page.mouse.move(0, 0);
  await paused(); // focus still holds even after Resume
  await page.evaluate(() => document.activeElement.blur());
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await paused();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await paused();
  await phone.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(video).toHaveCount(0);
  await expect(phone.locator('.app-screenshot-slide').first()).toHaveClass(/is-active/);
  await page.clock.fastForward(20000);
  await expect(phone.locator('.app-screenshot-slide').first()).toHaveClass(/is-active/);
});

for (const failure of ['network', 'rejection', 'stalled']) {
  test(`gameplay ${failure} keeps a still preview and recovers the rotation`, async ({ page }) => {
    if (failure === 'network') await page.route('**/santa-dash-apps-gameplay-v1.mp4', route => route.abort());
    else await page.addInitScript(mode => {
      HTMLMediaElement.prototype.play = function () {
        return mode === 'rejection'
          ? Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'))
          : new Promise(() => {});
      };
    }, failure);
    const phone = await open(page);
    await page.evaluate(() => { Math.random = () => .999; });
    await page.clock.fastForward(5000);
    if (failure === 'stalled') await page.clock.fastForward(12000);
    await expect(phone.getByRole('status')).toHaveText('Gameplay could not play. Still previews remain available.');
    await expect(phone.locator('video')).toHaveCount(0);
    await expect(phone.locator('.is-active img')).toHaveAttribute('src', /gameplay-poster/);
    await page.clock.fastForward(5000);
    await expect(phone.locator('.app-screenshot-slide').nth(4)).toHaveClass(/is-active/);
    await page.clock.fastForward(5000);
    await expect(phone.locator('.app-screenshot-slide').nth(3)).toHaveClass(/is-active/);
  });
}

test('reduced motion and offscreen entry never request gameplay', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('santa-dash-apps-gameplay-v1.mp4')) requests.push(request.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const phone = await open(page);
  await page.clock.fastForward(30000);
  await expect(phone.locator('.app-screenshot-slide').first()).toHaveClass(/is-active/);
  expect(requests).toHaveLength(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(100);
  await page.clock.fastForward(30000);
  await expect(phone.locator('.app-screenshot-slide').first()).toHaveClass(/is-active/);
  expect(requests).toHaveLength(0);
});
