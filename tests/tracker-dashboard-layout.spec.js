import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
    version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
  })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const cardFor = (page, label) => page.locator('.tracker-card').filter({
  has: page.locator('span', { hasText: new RegExp(`^${label}$`) }),
});
const cards = page => page.locator('.tracker-card').filter({ has: page.locator('.tracker-card-value') });

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const card of await cards(page).all()) {
    expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
}

test('desktop shows one set of four dashboard cards on each side of the map', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T14:00:00Z'));
  await page.goto('/santa-tracker');
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(cards(page)).toHaveCount(8);
    const map = await page.locator('.tracker-map').boundingBox();
    expect(map.width).toBeGreaterThan(600);
    for (const [side, labels] of [
      ['left', ['Current Location', 'Next Stop', 'ETA']],
      ['right', ['Estimated Gifts', 'Estimated Distance', 'Route Stops', 'Estimated Speed']],
    ]) {
      for (const label of labels) {
        const box = await cardFor(page, label).boundingBox();
        if (side === 'left') expect(box.x + box.width).toBeLessThanOrEqual(map.x + .5);
        else expect(box.x).toBeGreaterThanOrEqual(map.x + map.width - .5);
        expect(box.y).toBeGreaterThanOrEqual(map.y - .5);
        expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height + 20);
        expect(box.y + box.height).toBeLessThanOrEqual(900);
      }
    }
    await fits(page);
    if (width === 1440) await page.screenshot({ path: 'generated-artifacts/tracker-dashboard-desktop.png' });
  }
});

test('phone and tablet keep a single readable dashboard below the map', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T14:00:00Z'));
  await page.goto('/santa-tracker');
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(cards(page)).toHaveCount(8);
    const map = await page.locator('.tracker-map').boundingBox();
    for (const card of await cards(page).all()) {
      const box = await card.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(map.y + map.height);
    }
    await fits(page);
    if (width === 390) await page.locator('.tracker-stage-stats').screenshot({
      path: 'generated-artifacts/tracker-dashboard-phone.png',
    });
  }
});

test('desktop side cards keep seasonal details and the conditional UK arrival card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  for (const [date, count, expected] of [
    ['2026-11-09T12:00:00Z', 8, 'Research from 10 November'],
    ['2026-11-10T12:00:00Z', 8, 'Research, not deliveries'],
    ['2026-12-23T12:00:00Z', 8, '0 / 290'],
    ['2026-12-24T23:30:00Z', 9, null],
    ['2026-12-25T11:21:00Z', 8, '290 / 290'],
  ]) {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/santa-tracker');
    await expect(cards(page)).toHaveCount(count);
    if (expected) await expect(cardFor(page, 'Route Stops')).toContainText(expected);
    if (count === 9) await expect(cardFor(page, 'UK Arrival')).toBeVisible();
    await fits(page);
  }
});

test('preview side cards update together and remain readable with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));
  await page.addInitScript(() => localStorage.setItem('santa-tracker-preview', JSON.stringify({
    enabled: true, activatedAtRealMs: Date.now(), simulatedStartMs: Date.UTC(2026, 11, 24, 14),
    speedMultiplier: 300, jumpTarget: null,
  })));
  await page.goto('/santa-tracker/preview');
  await expect(cards(page)).toHaveCount(8);
  const before = await cardFor(page, 'Route Stops').locator('.tracker-card-value').textContent();
  await page.clock.runFor(6000);
  await expect(cardFor(page, 'Route Stops').locator('.tracker-card-value')).not.toHaveText(before);
  await expect(cards(page)).toHaveCount(8);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await fits(page);
});
