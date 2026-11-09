import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })));
  // The bug is hidden when reduced motion disables the old marker transition.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

async function watchAnchor(page, milliseconds = 2500) {
  return page.evaluate(duration => new Promise(resolve => {
    const end = performance.now() + duration;
    const result = { frames: 0, maxError: 0, dwellFrames: 0, maxDotError: 0, moved: false, visited: [], views: [] };
    let previous = null;
    const stops = new Set();
    const views = new Set();
    function frame() {
      const marker = document.querySelector('.tj-santa');
      const camera = document.querySelector('.tj-camera');
      if (marker && camera) {
        // Compare the painted anchor against the requested coordinate in the
        // SAME animated camera. Camera panning must not create relative drift.
        const target = marker.style.transform
          ? new DOMMatrix(marker.style.transform)
          : marker.transform.baseVal.consolidate().matrix;
        const point = new DOMPoint(target.e, target.f);
        const expected = point.matrixTransform(camera.getScreenCTM());
        const actual = new DOMPoint(0, 0).matrixTransform(marker.getScreenCTM());
        result.maxError = Math.max(result.maxError, Math.hypot(actual.x - expected.x, actual.y - expected.y));
        result.frames++;
        if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) > .001) result.moved = true;
        previous = point;
        const active = camera.querySelector('[data-active="true"]');
        if (active) {
          stops.add(active.getAttribute('data-stop-id'));
          const dot = active.querySelector('circle');
          if (dot) {
            const location = new DOMPoint(dot.cx.baseVal.value, dot.cy.baseVal.value);
            if (Math.hypot(location.x - point.x, location.y - point.y) < .001) {
              const paintedDot = location.matrixTransform(dot.getScreenCTM());
              result.dwellFrames++;
              result.maxDotError = Math.max(result.maxDotError, Math.hypot(actual.x - paintedDot.x, actual.y - paintedDot.y));
            }
          }
        }
        views.add(camera.getAttribute('data-map-view'));
      }
      if (performance.now() < end) requestAnimationFrame(frame);
      else {
        result.visited = [...stops];
        result.views = [...views];
        resolve(result);
      }
    }
    requestAnimationFrame(frame);
  }), milliseconds);
}

async function startPreview(page, startMs, speed = 300) {
  await page.evaluate(startMs => localStorage.setItem('santa-tracker-preview', JSON.stringify({
    enabled: true, activatedAtRealMs: Date.now(), simulatedStartMs: startMs,
    speedMultiplier: 1, jumpTarget: null,
  })), startMs);
  await page.reload();
  await expect(page.locator('.tj-santa')).toBeVisible();
  await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
  const previewControls = page.getByRole('button', { name: 'Preview Controls', exact: true });
  await previewControls.click();
  await page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true }).click();
  await previewControls.click();
  // Start acceleration after loading, so slow navigation cannot skip the dwell.
  await page.getByRole('button', { name: `${speed}×`, exact: true }).click();
}

for (const width of [1440, 390]) {
  test(`300x preview keeps Santa attached to route coordinates during normal-motion camera changes at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/santa-tracker/preview');
    const scenarios = await page.evaluate(async () => {
      const { getScheduledStops } = await import('/src/tracker/data/santaRouteStops.ts');
      const schedule = getScheduledStops(2026);
      const anchorage = schedule.find(entry => entry.stop.id === 'anchorage');
      const crossing = schedule.find((entry, i) => i < schedule.length - 1 &&
        Math.abs(schedule[i + 1].stop.lng - entry.stop.lng) > 180);
      return [
        { name: 'Anchorage arrival and departure', time: anchorage.arrival.getTime() - 30000 },
        { name: 'date-line crossing', time: crossing.departure.getTime() - 5000 },
      ];
    });
    for (const scenario of scenarios) {
      await startPreview(page, scenario.time);
      expect(await page.locator('.tj-camera').evaluate(node => getComputedStyle(node).transitionDuration)).not.toBe('0s');
      const follow = await watchAnchor(page);
      expect(follow.frames, scenario.name).toBeGreaterThan(10);
      expect(follow.moved, scenario.name).toBe(true);
      expect(follow.maxError, `${scenario.name}: ${JSON.stringify(follow)}`).toBeLessThan(1);
      if (scenario.name.startsWith('Anchorage')) {
        expect(follow.dwellFrames, JSON.stringify(follow)).toBeGreaterThan(0);
        expect(follow.maxDotError, JSON.stringify(follow)).toBeLessThan(1);
      }
      console.log(`${width}px ${scenario.name}: ${JSON.stringify(follow)}`);

      await page.getByRole('button', { name: 'Preview Controls', exact: true }).click();
      await page.locator('.tj-toolbar').getByRole('button', { name: 'World', exact: true }).click();
      const world = await watchAnchor(page, 1300);
      expect(world.maxError, `World camera: ${JSON.stringify(world)}`).toBeLessThan(1);
      await page.locator('.tj-toolbar').getByRole('button', { name: 'Follow Santa', exact: true }).click();
      const returning = await watchAnchor(page, 1300);
      expect(returning.maxError, `Follow camera: ${JSON.stringify(returning)}`).toBeLessThan(1);
    }
  });
}
