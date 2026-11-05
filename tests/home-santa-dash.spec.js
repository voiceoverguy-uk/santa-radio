import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const destination = 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397';

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
});

for (const width of [320, 767, 768, 1440]) {
  for (const motion of ['no-preference', 'reduce']) {
    test(`Classic Santa runs below the homepage Dash banner at ${width}px with ${motion}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: motion });
      // Keep baseline measurements in the running pose; dedicated jump tests
      // exercise the supplied strip and its successful loading separately.
      await page.route('**/images/santa-dash/classic-jump-strip.png', route => route.abort());
      const assets = [];
      page.on('request', request => {
        if (request.url().includes('/images/studio-runners/')) assets.push(new URL(request.url()).pathname);
      });
      await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false } }));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      const promo = page.locator('.santa-dash-promo');
      const lane = promo.locator('.studio-runner-lane');
      await lane.scrollIntoViewIfNeeded();
      await expect(lane).toBeVisible();
      await expect(lane).toHaveAttribute('aria-hidden', 'true');
      await expect(lane).toHaveCSS('pointer-events', 'none');
      await expect(lane).toHaveCSS('overflow', 'hidden');
      const travel = lane.locator('.studio-runner-travel'), image = lane.locator('img');
      const facing = lane.locator('.homepage-santa-facing');
      await expect(image).toHaveAttribute('alt', '');
      await expect.poll(() => image.evaluate(node => node.currentSrc)).toContain(
        `/images/studio-runners/classic${motion === 'reduce' ? '-still.png' : '.webp'}`);
      await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
      await expect(travel).toHaveCSS('animation-name', motion === 'reduce' ? 'none' : 'studio-runner-cross');
      await expect(facing).toHaveCSS('animation-name', motion === 'reduce' ? 'none' : 'studio-runner-face');
      const bounds = await lane.evaluate(node => {
        const box = node.getBoundingClientRect();
        const section = node.closest('section');
        const link = section.querySelector('.santa-dash-promo__download').getBoundingClientRect();
        const resting = node.querySelector('.studio-runner-travel').getBoundingClientRect();
        const inner = section.querySelector('.santa-dash-promo__inner').getBoundingClientRect();
        const style = getComputedStyle(section);
        return { height: box.height, below: resting.top >= link.bottom - .1,
          bottomGap: section.getBoundingClientRect().bottom - parseFloat(style.borderBottomWidth) - box.bottom,
          controlGap: resting.top - link.bottom,
          paddingTop: parseFloat(style.paddingTop),
          paddingBottom: parseFloat(style.paddingBottom),
          width: box.width, expectedWidth: inner.width,
          fits: box.left >= 0 && box.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth };
      });
      expect(bounds).toMatchObject({ height: 88, below: true, fits: true });
      expect(Math.abs(bounds.bottomGap)).toBeLessThan(1);
      expect(bounds.controlGap).toBeCloseTo(0, 1);
      expect(bounds.paddingBottom).toBe(0);
      // Transfer the former bottom space and runner gap above all the content,
      // preserving section height while bringing the button close to his head.
      const previousPadding = Math.min(58, Math.max(32, width * .05));
      expect(bounds.paddingTop).toBeCloseTo(width <= 767 ? 84 : previousPadding * 2 + 12, 1);
      expect(bounds.width).toBeCloseTo(bounds.expectedWidth, 1);
      // The supplied artwork has transparent space below the visible boots.
      // Lower only the homepage image, not the shared lane or Studio runner.
      expect(await image.evaluate(node =>
        node.getBoundingClientRect().bottom - node.closest('.studio-runner-lane').getBoundingClientRect().bottom
      )).toBeCloseTo(5, 1);
      expect(await lane.locator('button, a, [tabindex]').count()).toBe(0);
      if (motion === 'no-preference') {
        const samples = await travel.evaluate(node => {
          const travel = node.getAnimations()[0], facing = node.querySelector('.homepage-santa-facing');
          const face = facing.getAnimations()[0];
          travel.pause(); face.pause();
          return [0, 3500, 6999, 7000, 10500, 13999, 14000, 17500].map(time => {
            travel.currentTime = face.currentTime = time;
            const box = node.getBoundingClientRect(), lane = node.parentElement.getBoundingClientRect();
            return { x: box.left - lane.left, right: box.right - lane.left, width: lane.width,
              facing: new DOMMatrix(getComputedStyle(facing).transform).a };
          });
        });
        for (const sample of samples) {
          expect(sample.x).toBeGreaterThanOrEqual(-.1);
          expect(sample.right).toBeLessThanOrEqual(sample.width + .1);
        }
        expect(samples.map(sample => sample.facing)).toEqual([1, 1, 1, -1, -1, -1, 1, 1]);
        expect(samples[1].x).toBeGreaterThan(samples[0].x);
        expect(samples[4].x).toBeLessThan(samples[3].x);
        expect(samples[6].x).toBeCloseTo(0, 1);
        expect(samples[7].x).toBeGreaterThan(samples[6].x);
      }
      await expect(promo.locator('.santa-dash-promo__download')).toHaveAttribute('href', destination);
      await expect(promo.locator('.santa-dash-promo__artwork')).toHaveCount(1);
      expect([...new Set(assets)]).toEqual([
        `/images/studio-runners/classic${motion === 'reduce' ? '-still.png' : '.webp'}`,
      ]);
      await promo.screenshot({ path: `generated-artifacts/santa-dash-runner-${width}-${motion}.png` });
    });
  }
}

test('homepage Santa Dash scenery is a separate half-opacity background at desktop and mobile widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  const promo = page.locator('.santa-dash-promo');
  const backgroundUrl = await promo.evaluate(node => {
    const style = getComputedStyle(node, '::before');
    if (style.opacity !== '0.5' || style.pointerEvents !== 'none') throw new Error('Incorrect scenery styling');
    return style.backgroundImage.slice(5, -2);
  });
  const response = await page.request.get(backgroundUrl);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/webp');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await promo.scrollIntoViewIfNeeded();
    const styling = await promo.evaluate(node => ({
      sectionOpacity: getComputedStyle(node).opacity,
      contentOpacity: getComputedStyle(node.querySelector('.santa-dash-promo__inner')).opacity,
      fits: document.documentElement.scrollWidth <= innerWidth,
    }));
    expect(styling).toEqual({ sectionOpacity: '1', contentOpacity: '1', fits: true });
    await expect(promo.getByRole('heading', { level: 2 })).toBeVisible();
    mkdirSync('generated-artifacts', { recursive: true });
    await promo.screenshot({ path: `generated-artifacts/santa-dash-scenery-${width}.jpg`, animations: 'disabled' });
  }
});

test('Santa Dash title keeps its intended two lines without overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  const promo = page.getByRole('region', { name: 'Santa Dash Back to the Grotto', exact: true });
  const title = promo.getByRole('heading', { level: 2, name: 'Santa Dash Back to the Grotto', exact: true });
  await expect(promo.getByRole('heading')).toHaveCount(1);
  await expect(title).toHaveCount(1);
  const lines = title.locator('.santa-dash-promo__title-line');
  await expect(lines).toHaveText(['Santa Dash', 'Back to the Grotto']);

  for (const width of [1440, 830, 768, 540, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await title.evaluate(element => {
      const heading = element.getBoundingClientRect();
      return {
        heading: heading.toJSON(),
        lineHeight: parseFloat(getComputedStyle(element).lineHeight),
        lines: [...element.querySelectorAll('span')].map(line => {
          const range = document.createRange();
          range.selectNodeContents(line);
          return {
            box: line.getBoundingClientRect().toJSON(),
            ink: [...range.getClientRects()].map(rect => rect.toJSON()),
          };
        }),
      };
    });
    expect(geometry.heading.height, `${width}px: exactly two lines`).toBeCloseTo(geometry.lineHeight * 2, 0);
    expect(geometry.lines[1].box.top - geometry.lines[0].box.top).toBeCloseTo(geometry.lineHeight, 0);
    for (const { box, ink } of geometry.lines) {
      expect(box.height).toBeCloseTo(geometry.lineHeight, 0);
      for (const rect of ink) {
        expect(rect.left).toBeGreaterThanOrEqual(geometry.heading.left - 1);
        expect(rect.right).toBeLessThanOrEqual(geometry.heading.right + 1);
        expect(Math.abs((rect.left + rect.right - geometry.heading.left - geometry.heading.right) / 2)).toBeLessThanOrEqual(1);
      }
    }
    expect(geometry.heading.left).toBeGreaterThanOrEqual(0);
    expect(geometry.heading.right).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('homepage advert keeps the Santa Radio artwork fixed during playback and over time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const promo = page.getByRole('region', { name: 'Santa Dash Back to the Grotto', exact: true });
  const artwork = promo.locator('.santa-dash-promo__artwork');
  await promo.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(promo).toHaveAttribute('data-preview-state', 'playing', { timeout: 15000 });
  const source = await artwork.getAttribute('src');
  const expectStableArtwork = async () => {
    await expect(artwork).toHaveCount(1);
    await expect(artwork).toHaveAttribute('src', source);
    await expect(artwork).toHaveAttribute('src', /santa-dash-wobbly-bob/);
    await expect(artwork).toHaveAttribute('alt', /Enjoy Santa Radio while you play/);
    expect(await artwork.evaluate(el => ({
      loaded: el.complete && el.naturalWidth > 0,
      opacity: getComputedStyle(el).opacity,
      animation: getComputedStyle(el).animationName,
      animations: el.getAnimations().length,
    }))).toEqual({ loaded: true, opacity: '1', animation: 'none', animations: 0 });
  };
  await expectStableArtwork();
  // Span the old four-second change and complete eight-second rotation.
  for (let interval = 0; interval < 2; interval += 1) {
    await page.waitForTimeout(4200);
    await expect(promo).toHaveAttribute('data-preview-state', 'playing');
    await expectStableArtwork();
  }
  await promo.getByRole('button', { name: 'Pause Santa Dash gameplay video' }).click();
  await expect(promo).toHaveAttribute('data-preview-state', 'manually-paused');
  await expectStableArtwork();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectStableArtwork();
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
  const promo = page.getByRole('region', { name: 'Santa Dash Back to the Grotto', exact: true });
  const artwork = promo.locator('.santa-dash-promo__artwork').first();
  const artworkLink = promo.getByRole('link', { name: 'View Santa Dash — Back to the Grotto on the App Store (opens in a new tab)', exact: true });
  const download = promo.getByRole('link', { name: 'Download Santa Dash for iPhone and iPad (opens in a new tab)', exact: true });

  for (const width of [1440, 768, 767, 541, 540, 390, 320]) {
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
    expect(geometry.naturalHeight).toBe(555);
    expect(geometry.width / geometry.height).toBeCloseTo(1600 / 554, 2);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    const inset = await promo.evaluate(el => {
      const artwork = el.querySelector('.santa-dash-promo__artwork-link').getBoundingClientRect();
      const visual = el.querySelector('.santa-dash-promo__visual').getBoundingClientRect();
      const phone = el.querySelector('.santa-dash-promo__handset').getBoundingClientRect();
      return { artwork: artwork.toJSON(), visual: visual.toJSON(), phone: phone.toJSON() };
    });
    // Two thirds of the original complete desktop handset, with a mobile
    // width cap to leave the baked-in right-side title and badge unobscured.
    const baseWidth = width <= 540
      ? Math.min(inset.visual.width * .72, 560)
      : Math.min(inset.visual.width * .5, 620);
    expect(inset.phone.width).toBeCloseTo(baseWidth * 2 / 3, 1);
    expect(inset.phone.width / inset.phone.height).toBeCloseTo(2.23, 2);
    expect(inset.visual.height).toBeCloseTo(inset.artwork.height, 1);
    const playback = await promo.locator('.santa-dash-promo__playback').boundingBox();
    expect(playback.y).toBeGreaterThanOrEqual(inset.phone.top);
    expect(playback.y + playback.height).toBeLessThanOrEqual(inset.phone.bottom + 1);
    expect(playback.x).toBeGreaterThanOrEqual(inset.phone.left);
    expect(playback.x + playback.width).toBeLessThanOrEqual(inset.phone.right);
    expect(playback.width).toBeGreaterThanOrEqual(44);
    expect(playback.height).toBeGreaterThanOrEqual(44);
    await expect(promo.locator('.santa-dash-promo__playback')).not.toContainText('preview');
    const leftGap = inset.phone.left - inset.artwork.left;
    const bottomGap = inset.artwork.bottom - inset.phone.bottom;
    expect(leftGap).toBeGreaterThanOrEqual(7);
    expect(leftGap).toBeLessThanOrEqual(19);
    expect(bottomGap).toBeGreaterThanOrEqual(7);
    expect(bottomGap).toBeLessThanOrEqual(19);
    expect(inset.phone.top).toBeGreaterThan(inset.artwork.top);
    expect(inset.phone.right).toBeLessThan(inset.artwork.left + inset.artwork.width * .53);
    expect(await promo.locator('.santa-dash-promo__handset').evaluate(el => getComputedStyle(el).opacity)).toBe('0.9');
    // Only the containing handset is translucent; nested media must not
    // compound it, and the separate control must not inherit it.
    expect(await promo.locator('.santa-dash-promo__handset *').evaluateAll(
      elements => elements.every(el => getComputedStyle(el).opacity === '1'),
    )).toBe(true);
    for (const element of [promo, promo.locator('.santa-dash-promo__visual'),
      promo.locator('.santa-dash-promo__title'), artwork, artworkLink, download,
      promo.locator('.santa-dash-promo__playback')]) {
      expect(await element.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
    }
    await expect(promo.locator('.santa-dash-promo__artwork')).toHaveCount(1);
    expect(await artwork.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
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
    await expect(promo.locator('.santa-dash-promo__playback')).toBeFocused();
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
