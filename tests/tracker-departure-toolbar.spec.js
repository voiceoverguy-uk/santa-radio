import { test, expect } from '@playwright/test';

const values = page => page.locator('.tj-departure-value');
const legend = page => page.locator('.tj-legend');

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2',
    JSON.stringify({ version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now() })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [date, countdown] of [
  ['2026-07-15T12:00:00Z', true],
  ['2026-11-10T00:00:00Z', true],
  ['2026-12-23T00:00:00Z', true],
  ['2026-12-24T09:59:59Z', true],
  ['2026-12-24T10:00:00Z', false],
  ['2026-12-24T14:00:00Z', false],
  ['2026-12-25T11:20:00Z', false],
  ['2026-12-25T23:59:59Z', false],
  ['2026-12-26T00:00:00Z', true],
  ['2027-01-01T00:00:00Z', true],
]) {
  test(`toolbar seasonal content at ${date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/santa-tracker');
    await expect(page.locator('.tj-toolbar')).toBeVisible();
    await expect(page.locator('.tj-departure')).toHaveCount(countdown ? 1 : 0);
    await expect(legend(page)).toHaveCount(countdown ? 0 : 1);
    await expect(page.locator('.tracker-stage-body .tracker-countdown-grid')).toHaveCount(0);
    if (countdown) {
      const now = Date.parse(date);
      const year = Number(date.slice(0, 4)) + (date.slice(5, 10) === '12-26' ? 1 : 0);
      const seconds = (Date.UTC(year, 11, 24, 10) - now) / 1000;
      await expect(values(page)).toHaveText([
        Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24,
        Math.floor(seconds / 60) % 60, seconds % 60,
      ].map(value => String(value).padStart(2, '0')));
      await expect(page.locator('.tj-departure')).toContainText('Estimated · 24 December, 10:00 UTC');
      await expect(page.getByRole('group', { name: "Countdown to Santa's Departure", exact: false })).toHaveAttribute('aria-live', 'off');
    } else {
      await expect(legend(page)).toHaveText('VisitedNowUpcoming');
    }
    await expect(page.locator('.tj-region-context')).toContainText('World');
    await expect(page.locator('.tracker-stats-grid .tracker-card')).toHaveCount(8);
  });
}

test('clock ticks switch departure and holiday rollover without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-24T09:59:57Z') });
  await page.clock.pauseAt(new Date('2026-12-24T09:59:58Z'));
  await page.goto('/santa-tracker');
  await expect(values(page)).toHaveText(['00', '00', '00', '02']);
  await page.clock.runFor(1000);
  await expect(values(page)).toHaveText(['00', '00', '00', '01']);
  await page.clock.runFor(1000);
  await expect(legend(page)).toBeVisible();
  await expect(page.locator('.tj-departure')).toHaveCount(0);
  await page.clock.setSystemTime(new Date('2026-12-25T23:59:59Z'));
  await page.clock.runFor(0);
  await page.clock.runFor(1000);
  await expect(values(page)).toHaveText(['363', '10', '00', '00']);
  await expect(legend(page)).toHaveCount(0);
});

test('preview countdown shares simulated time and preserves camera across forward and backward jumps', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-15T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-07-15T12:00:01Z'));
  await page.addInitScript(() => localStorage.setItem('santa-tracker-preview', JSON.stringify({
    enabled: true, activatedAtRealMs: Date.now(), simulatedStartMs: Date.UTC(2026, 11, 24, 9, 55),
    speedMultiplier: 60, jumpTarget: 'route-start',
  })));
  await page.goto('/santa-tracker/preview');
  await expect(values(page)).toHaveText(['00', '00', '05', '00']);
  await page.getByLabel('Browse a region', { exact: true }).selectOption('Europe');
  await page.clock.runFor(1000);
  await expect(values(page)).toHaveText(['00', '00', '04', '00']);
  await expect(page.locator('.tj-camera > [data-night-overlay]')).toHaveAttribute('data-solar-time', '2026-12-24T09:56:00.000Z');
  await page.clock.runFor(4000);
  await expect(legend(page)).toBeVisible();
  const panel = page.locator('.tracker-preview-panel');
  for (const [jump, countdown] of [['Complete', false], ['26 December', true], ['Route Start', true], ['Australia', false], ['10 November', true]]) {
    await panel.getByRole('button', { name: jump, exact: true }).click();
    await expect(page.locator('.tj-departure')).toHaveCount(countdown ? 1 : 0);
    await expect(legend(page)).toHaveCount(countdown ? 0 : 1);
    await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'Europe');
    await expect(page.locator('.tj-region-context')).toHaveText('Europe');
  }
  await panel.getByRole('button', { name: 'Preview Controls' }).click();
  await page.getByRole('button', { name: 'Follow Santa', exact: true }).click();
  await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
  await page.getByRole('button', { name: 'World', exact: true }).click();
  await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
});

for (const width of [320, 390, 1280, 1440]) {
  test(`toolbar fits at ${width}px with normal and doubled text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-12-26T00:00:00Z'));
    await page.goto('/santa-tracker');
    for (const zoom of [100, 200]) {
      await page.addStyleTag({ content: `html { font-size: ${zoom}% !important; }` });
      await expect(values(page)).toHaveText(['363', '10', '00', '00']);
      const bounds = await page.locator('.tj-toolbar').evaluate(toolbar => ({
        fits: toolbar.scrollWidth <= toolbar.clientWidth + 1,
        childrenFit: [...toolbar.querySelectorAll('button, select, .tj-departure, .tj-departure-unit, .tj-region-context')].every(node => {
          const box = node.getBoundingClientRect();
          const parent = toolbar.getBoundingClientRect();
          return box.left >= parent.left && box.right <= parent.right + 1 && node.scrollWidth <= node.clientWidth + 1;
        }),
        textFits: [...toolbar.querySelectorAll('.tj-departure-label, .tj-departure-heading, .tj-departure-value')].every(node => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const parent = node.getBoundingClientRect();
          return [...range.getClientRects()].every(box => box.left >= parent.left - .5 && box.right <= parent.right + .5);
        }),
      }));
      expect(bounds).toEqual({ fits: true, childrenFit: true, textFits: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.clock.setFixedTime(new Date('2026-12-24T14:00:00Z'));
    await page.reload();
    await expect(legend(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'World', exact: true })).toBeVisible();
    await expect(page.getByLabel('Browse a region', { exact: true })).toBeVisible();
  });
}

test('homepage keeps its independent Christmas Day countdown and mini-map', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T09:59:59Z'));
  await page.goto('/');
  const countdown = page.getByLabel('Countdown to Christmas Day', { exact: true });
  await expect(countdown).toBeVisible();
  await expect(countdown.locator('.countdown-unit span')).toHaveText(['days', 'hours', 'minutes', 'seconds']);
  await expect(countdown.locator('.countdown-unit strong').first()).toHaveText('00');
  await expect(page.locator('.tracker-banner-map')).toBeVisible();
  await expect(page.locator('.tj-departure, .tj-toolbar')).toHaveCount(0);
});
