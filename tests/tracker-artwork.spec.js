import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function imageLoadedAndContained(image, { min = 20, max = 90 } = {}) {
  await expect(image).toBeVisible();
  const decoded = await image.evaluate(async node => {
    const img = new Image();
    img.src = node.getAttribute('href');
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
  expect(decoded.width).toBeGreaterThan(150);
  expect(decoded.height).toBeGreaterThan(150);
  await expect.poll(() => image.evaluate(node => {
    const a = node.getBoundingClientRect(), b = node.closest('svg').getBoundingClientRect();
    return a.left >= b.left - .5 && a.right <= b.right + .5 && a.top >= b.top - .5 && a.bottom <= b.bottom + .5;
  })).toBe(true);
  const bounds = await image.boundingBox();
  expect(Math.max(bounds.width, bounds.height)).toBeGreaterThanOrEqual(min);
  expect(Math.max(bounds.width, bounds.height)).toBeLessThanOrEqual(max);
}

async function expectCenteredOnAnchor(image) {
  await expect.poll(() => image.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const anchor = new DOMPoint(0, 0).matrixTransform(node.parentElement.getScreenCTM());
    return Math.max(
      Math.abs(rect.x + rect.width / 2 - anchor.x),
      Math.abs(rect.y + rect.height / 2 - anchor.y),
    );
  })).toBeLessThan(1.5);
}

for (const width of [1440, 390]) {
  test(`Follow Santa enlarges seasonal artwork only on the full map at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    // Fiji is close to the Pacific map edge, exercising enlarged edge clearance.
    await page.addInitScript(() => { Math.random = () => (25.1 / 91); });

    for (const [date, outfit] of [
      ['2026-11-09T12:00:00Z', 'holiday'],
      ['2026-11-10T12:00:00Z', 'route-scout'],
    ]) {
      await page.clock.setFixedTime(new Date(date));
      await page.goto('/santa-tracker');
      const toolbar = page.locator('.tj-toolbar');
      const marker = page.locator('.tj-santa [data-santa-artwork]');
      await expect(marker).toHaveAttribute('href', `/images/tracker/santa-${outfit}.png`);
      await expect(toolbar.getByRole('button', { name: 'Follow Santa', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await imageLoadedAndContained(marker);
      const followBounds = await marker.boundingBox();
      const mirrored = await marker.getAttribute('data-mirrored');
      await expectCenteredOnAnchor(marker);

      await toolbar.getByRole('button', { name: 'World', exact: true }).click();
      await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
      await imageLoadedAndContained(marker);
      const worldBounds = await marker.boundingBox();

      await page.getByLabel('Browse a region', { exact: true }).selectOption('Pacific');
      await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'Pacific');
      await imageLoadedAndContained(marker);
      const regionBounds = await marker.boundingBox();
      expect(regionBounds.width).toBeCloseTo(worldBounds.width, 1);
      expect(regionBounds.height).toBeCloseTo(worldBounds.height, 1);
      expect(await marker.getAttribute('data-mirrored')).toBe(mirrored);

      await toolbar.getByRole('button', { name: 'Follow Santa', exact: true }).click();
      await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
      await imageLoadedAndContained(marker);
      const restoredBounds = await marker.boundingBox();
      expect(followBounds).not.toBeNull();
      expect(restoredBounds.width).toBeGreaterThan(worldBounds.width * 1.4);
      expect(restoredBounds.height).toBeGreaterThan(worldBounds.height * 1.4);
      expect(restoredBounds.width).toBeCloseTo(followBounds.width, 1);
      expect(restoredBounds.height).toBeCloseTo(followBounds.height, 1);
      expect(await marker.getAttribute('data-mirrored')).toBe(mirrored);
    }
  });
}

for (const width of [1440, 390]) {
  test(`holiday/research artwork loads on both maps and is camera independent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    // Fiji is almost on the right map edge: exercise the mini-map's clearance.
    await page.addInitScript(() => { Math.random = () => (25.1 / 91); });
    for (const [date, outfit] of [
      ['2026-11-09T12:00:00Z', 'holiday'],
      ['2026-11-10T12:00:00Z', 'route-scout'],
    ]) {
      await page.clock.setFixedTime(new Date(date));
      await page.goto('/');
      const mini = page.locator('.tracker-banner [data-santa-artwork]');
      await expect(mini).toHaveAttribute('href', `/images/tracker/santa-${outfit}.png`);
      await expect(mini).toHaveAttribute('data-mirrored', 'true');
      await imageLoadedAndContained(mini);
      await expect(page.locator('.tracker-banner-map [data-route-stops] circle')).toHaveCount(290);
      await page.goto('/santa-tracker');
      const full = page.locator('.tj-santa [data-santa-artwork]');
      await expect(full).toHaveAttribute('href', `/images/tracker/santa-${outfit}.png`);
      await expect(full).toHaveAttribute('data-mirrored', 'true');
      await imageLoadedAndContained(full);
      await page.getByLabel('Browse a region', { exact: true }).selectOption('Pacific');
      await expect(full).toHaveAttribute('data-mirrored', 'true');
      await expect(page.locator('.tj-minimap circle')).toHaveCount(1);
      await page.locator('.tj-toolbar').getByRole('button', { name: 'World', exact: true }).click();
      await imageLoadedAndContained(full);
    }
  });

  test(`preview jumps keep chronological sleigh direction across cameras and polar edges at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00Z'));
    await page.goto('/santa-tracker/preview');
    const legs = await page.evaluate(async () => {
      const { getScheduledStops } = await import('/src/tracker/data/santaRouteStops.ts');
      const { shortestLongitudeDelta } = await import('/src/tracker/lib/santaRoute.ts');
      const schedule = getScheduledStops(2026);
      const selected = [];
      for (const right of [true, false]) {
        const i = schedule.findIndex((entry, index) => index > 0 &&
          (shortestLongitudeDelta(schedule[index - 1].stop.lng, entry.stop.lng) > 0) === right);
        selected.push({ city: schedule[i].stop.id, right });
      }
      const polarIndex = schedule.findIndex(entry => entry.stop.id === 'amundsenscottsouthpolestation');
      selected.push({
        city: schedule[polarIndex].stop.id,
        right: shortestLongitudeDelta(schedule[polarIndex - 1].stop.lng, schedule[polarIndex].stop.lng) > 0,
      });
      return selected;
    });
    await page.getByRole('switch', { name: 'Preview mode' }).click();
    for (const leg of legs) {
      await page.getByLabel('Jump to destination', { exact: true }).selectOption(`city:${leg.city}`);
      const image = page.locator('.tj-santa [data-santa-artwork]');
      const expected = `/images/tracker/santa-sleigh${leg.right ? '' : '-left'}.png`;
      await expect(image).toHaveAttribute('href', expected);
      await imageLoadedAndContained(image);
      await expectCenteredOnAnchor(image);
      await page.getByRole('button', { name: 'Preview Controls', exact: true }).click();
      await page.locator('.tj-toolbar').getByRole('button', { name: 'World', exact: true }).click();
      await expect(image).toHaveAttribute('href', expected);
      await imageLoadedAndContained(image);
      await expectCenteredOnAnchor(image);
      await page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true }).click();
      await expect(image).toHaveAttribute('href', expected);
      await imageLoadedAndContained(image);
      await expectCenteredOnAnchor(image);
      await page.getByRole('button', { name: 'Preview Controls', exact: true }).click();
    }
    // Non-sequential seasonal preview jumps must not retain the previous outfit.
    for (const [button, filename] of [
      ['10 November', 'route-scout'], ['9 November', 'holiday'],
      ['23 December', null], ['Complete', null], ['26 December', 'holiday'],
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      const image = page.locator('.tj-santa [data-santa-artwork]');
      if (filename) await expect(image).toHaveAttribute('href', new RegExp(`santa-${filename}(?:-front)?\\.png$`));
      else await expect(image).toHaveCount(0);
    }
  });
}

for (const path of ['/', '/santa-tracker']) {
  test(`open map at ${path} changes outfits at UTC boundary without moving the location`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-09T23:59:58Z') });
    await page.clock.pauseAt(new Date('2026-11-09T23:59:59Z'));
    await page.goto(path);
    const image = page.locator('[data-santa-artwork]');
    await expect(image).toHaveAttribute('href', /santa-holiday\.png$/);
    const anchor = await image.evaluate(node => node.parentElement.getAttribute('transform') || node.parentElement.style.transform);
    await page.clock.runFor(1000);
    await expect(image).toHaveAttribute('href', /santa-route-scout\.png$/);
    expect(await image.evaluate(node => node.parentElement.getAttribute('transform') || node.parentElement.style.transform)).toBe(anchor);
  });
}

test('every PNG decodes with transparent pixels and no added background', async ({ page }) => {
  await page.goto('/santa-tracker');
  const assets = ['holiday', 'holiday-front', 'route-scout', 'route-scout-front', 'sleigh', 'sleigh-left'];
  for (const asset of assets) {
    const alpha = await page.evaluate(async name => {
      const img = new Image();
      img.src = `/images/tracker/santa-${name}.png`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
      let transparent = 0, visible = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) transparent++;
        if (pixels[i] > 128) visible++;
      }
      return { transparent, visible };
    }, asset);
    expect(alpha.transparent).toBeGreaterThan(1000);
    expect(alpha.visible).toBeGreaterThan(1000);
  }
});

for (const width of [1440, 390]) {
  test(`full-map Santa artwork opens and dismisses by pointer in every camera at ${width}px`, async ({ page }) => {
    const height = width === 390 ? 844 : 1000;
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
    // Fiji keeps Santa visible while testing the Pacific region and world edge.
    await page.addInitScript(() => { Math.random = () => (25.1 / 91); });
    await page.goto('/santa-tracker');
    const toolbar = page.locator('.tj-toolbar');
    const trigger = page.getByRole('button', { name: "Enlarge Santa's current artwork" });
    const mapCamera = page.locator('.tj-camera');

    for (const view of ['follow', 'world', 'Pacific']) {
      if (view === 'world') await toolbar.getByRole('button', { name: 'World', exact: true }).click();
      if (view === 'Pacific') await page.getByLabel('Browse a region', { exact: true }).selectOption('Pacific');
      await expect(mapCamera).toHaveAttribute('data-map-view', view === 'Pacific' ? 'Pacific' : view);
      const mapTransform = await mapCamera.getAttribute('style');
      const marker = page.locator('.tj-santa [data-santa-artwork]');
      const expectedSrc = await marker.getAttribute('href');
      const expectedMirror = await marker.getAttribute('data-mirrored');

      await trigger.click();
      const dialog = page.getByRole('dialog', { name: /Tap or click anywhere, or press Escape, to close/ });
      const enlarged = dialog.locator('[data-santa-artwork-enlarged]');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(enlarged).toHaveAttribute('src', expectedSrc);
      await expect(enlarged).toHaveAttribute('data-mirrored', expectedMirror);
      await expect(enlarged).toHaveAttribute('alt', "Santa's current seasonal artwork");
      const alpha = await enlarged.evaluate(async image => {
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0;
        let opaque = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] === 0) transparent++;
          if (pixels[i] > 128) opaque++;
        }
        return { transparent, opaque };
      });
      expect(alpha.transparent).toBeGreaterThan(1000);
      expect(alpha.opaque).toBeGreaterThan(1000);

      const appearance = await dialog.evaluate(node => ({
        background: getComputedStyle(node).backgroundColor,
        imageBackground: getComputedStyle(node.querySelector('img')).backgroundColor,
      }));
      expect(appearance).toEqual({ background: 'rgba(0, 0, 0, 0)', imageBackground: 'rgba(0, 0, 0, 0)' });
      const bounds = await enlarged.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 0.5);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 0.5);
      expect(Math.max(bounds.width / width, bounds.height / height)).toBeGreaterThanOrEqual(0.9);
      expect(await mapCamera.getAttribute('style')).toBe(mapTransform);

      // A click anywhere on the transparent layer, including the artwork itself, dismisses it.
      await dialog.click({ position: { x: width - 12, y: height - 12 } });
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });

  test(`full-map artwork supports keyboard opening, Escape, focus return, and tap dismissal at ${width}px`, async ({ page }) => {
    const height = width === 390 ? 844 : 1000;
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00Z'));
    await page.addInitScript(() => { Math.random = () => (25.1 / 91); });
    await page.goto('/santa-tracker');

    const trigger = page.getByRole('button', { name: "Enlarge Santa's current artwork" });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: /Enlarged Santa artwork/ });
    const enlarged = dialog.locator('[data-santa-artwork-enlarged]');
    await expect(dialog).toBeVisible();
    await expect(enlarged).toHaveAttribute('src', '/images/tracker/santa-route-scout.png');
    await expect(enlarged).toHaveAttribute('data-mirrored', 'true');
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Space');
    await expect(dialog).toBeVisible();
    await expect(enlarged).toHaveAttribute('src', '/images/tracker/santa-route-scout.png');
    await dialog.click({ position: { x: width - 12, y: height - 12 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('western holiday markers keep the original orientation and radio playback survives map navigation', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
  await page.addInitScript(() => {
    Math.random = () => 0;
    window.playCalls = 0; window.pauseCalls = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { window.pauseCalls++; };
    HTMLMediaElement.prototype.play = function () {
      window.playCalls++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.goto('/');
  await expect(page.locator('.tracker-banner [data-santa-artwork]')).toHaveAttribute('data-mirrored', 'false');
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live' }).click();
  await page.getByRole('button', { name: 'Expand radio player' }).click();
  await page.getByRole('slider', { name: 'Radio volume' }).fill('0.25');
  await page.evaluate(() => {
    window.originalAudio = document.querySelector('audio');
    window.beforeNavigationPauses = window.pauseCalls;
  });
  await page.locator('.tracker-banner .tracker-action').click();
  await expect(page).toHaveURL(/\/santa-tracker$/);
  await expect(page.locator('.tj-santa [data-santa-artwork]')).toHaveAttribute('data-mirrored', 'false');
  await page.getByLabel('Browse a region', { exact: true }).selectOption('Europe');
  await expect(page.locator('.tj-santa [data-santa-artwork]')).toHaveAttribute('data-mirrored', 'false');
  expect(await page.evaluate(() => ({
    sameAudio: window.originalAudio === document.querySelector('audio'),
    count: document.querySelectorAll('audio').length,
    volume: document.querySelector('audio').volume,
    plays: window.playCalls, pauses: window.pauseCalls - window.beforeNavigationPauses,
  }))).toEqual({ sameAudio: true, count: 1, volume: 0.25, plays: 1, pauses: 0 });
});

test('Delivering Now stays inside the main map box at the bottom on desktop and phone', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T14:00:00Z'));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker');
    const map = page.locator('.tracker-map');
    const badge = map.locator('.tracker-map-status .tracker-status');
    await expect(badge).toHaveText(/Delivering Now/);
    await expect(badge).toHaveAttribute('role', 'status');
    await expect(page.locator('.tracker-hero .tracker-status')).toHaveCount(1);
    const box = await map.boundingBox();
    const status = await page.locator('.tracker-map-status').boundingBox();
    expect(status.y).toBeGreaterThan(box.y);
    expect(status.y + status.height).toBeLessThanOrEqual(box.y + box.height);
    expect(status.x).toBeGreaterThanOrEqual(box.x);
    expect(status.x + status.width).toBeLessThanOrEqual(box.x + box.width);
    await map.screenshot({ path: `generated-artifacts/tracker-delivering-now-${viewport.width}.png` });
  }

  await page.clock.setFixedTime(new Date('2026-12-24T09:00:00Z'));
  await page.goto('/santa-tracker');
  await expect(page.locator('.tracker-map-status')).toHaveCount(0);
  const preparing = page.locator('.tracker-hero .tracker-status');
  await expect(preparing).toBeVisible();
  expect(await preparing.evaluate(node => node.closest('.tracker-map') === null)).toBe(true);
});
