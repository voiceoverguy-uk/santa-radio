import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.addInitScript(() => localStorage.setItem('santaradio-cookie-consent-v2',
    JSON.stringify({ version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now() })));
});

for (const [iso, destination] of [
  ['2026-12-24T10:00:01Z', 'Kiritimati'],
  ['2026-12-24T13:30:01Z', 'Adelaide'],
  ['2026-12-24T14:30:01Z', 'Darwin'],
  ['2026-12-24T18:15:01Z', 'Kathmandu'],
  ['2026-12-24T19:30:01Z', 'Kabul'],
  ['2026-12-25T00:00:01Z', 'London'],
  ['2026-12-25T10:00:01Z', 'Honolulu'],
]) {
  test(`public live destination and humour agree at ${destination}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(iso));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/santa-tracker');
    await expect(page.locator('[data-live-activity]')).toContainText(destination);
    await expect(page.locator('[data-live-fact]')).toContainText(destination);
    await expect(page.locator('[data-stop-id]')).toHaveCount(290);
    await expect(page.locator('[data-santa-activity]')).toHaveCount(290);
    await expect(page.locator('.tracker-status')).toContainText('Delivering Now');
    const current = await page.locator('.tracker-map [data-active="true"]').getAttribute('data-stop-id');
    const activity = page.locator(`[data-santa-activity="${current}"]`);
    await expect(activity).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const bad = await page.locator('[data-santa-activity]:visible').evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth + 1));
    expect(bad).toBe(false);
  });
}

test('Honolulu and completion controls include the final delivery window', async ({ page }) => {
  await page.goto('/santa-tracker/preview');
  await page.getByRole('switch', { name: 'Preview mode' }).click();
  await page.getByRole('button', { name: 'Hawaii', exact: true }).click();
  await expect(page.locator('[data-live-activity]')).toContainText('Honolulu');
  await expect(page.locator('.tracker-status')).toContainText('Delivering Now');
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page.locator('.tracker-status')).toContainText('Journey Complete');
  await expect(page.locator('main')).toContainText('25 hours and 20 minutes');
  await expect(page.locator('main')).toContainText('290/290');
  await expect(page.locator('[data-live-activity]')).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('santa-tracker-preview')));
  expect(new Date(state.simulatedStartMs).toISOString()).toMatch(/12-25T11:20:00/);
  await page.goto('/santa-tracker');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  await expect(page.locator('.tracker-status')).not.toContainText('Journey Complete');
});

test('approaching UK copy does not claim UK delivery before midnight', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T23:30:00Z'));
  await page.goto('/santa-tracker');
  await expect(page.locator('[data-live-activity]')).toBeVisible();
  await expect(page.locator('main')).toContainText('estimated delivery window starts at midnight UTC');
  await expect(page.locator('main')).not.toContainText('This is it, Santa is here!');
  await page.goto('/');
  await expect(page.locator('.tracker-banner .tracker-status')).toContainText('Approaching the UK');
});

for (const [iso, firstLine, seasonalLabel] of [
  ['2026-11-08T12:00:00Z', 'I packed a travel iron.', 'Holiday Postcards'],
  ['2026-07-15T12:00:00Z', 'July rehearsal:', 'Christmas in July Postcards'],
]) {
  test(`mobile postcard rotation and PNG download in ${seasonalLabel}`, async ({ page }) => {
    await page.clock.install({ time: new Date(iso) });
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/santa-tracker');
    const card = page.locator('.tracker-postcard');
    await expect(card).toContainText(firstLine);
    await expect(page.locator('main')).toContainText(seasonalLabel);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Caveat' && font.status === 'loaded'))).toBe(true);
    for (let i = 0; i < 8; i++) {
      const fits = await card.evaluate(el => {
        const box = el.getBoundingClientRect();
        return [...el.querySelectorAll('p')].every(p => {
          const rect = p.getBoundingClientRect();
          return rect.left >= box.left && rect.right <= box.right + 1 && rect.top >= box.top && rect.bottom <= box.bottom + 1 && p.scrollWidth <= p.clientWidth + 1;
        });
      });
      expect(fits).toBe(true);
      if (i === 0) {
        const pending = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Share this postcard' }).click();
        const download = await pending;
        await download.saveAs(test.info().outputPath('postcard.png'));
        expect(download.suggestedFilename()).toBe('santa-postcard.png');
        const bytes = await readFile(await download.path());
        expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(bytes.readUInt32BE(16)).toBeGreaterThan(500);
        expect(bytes.readUInt32BE(20)).toBeGreaterThan(600);
      }
      await page.clock.runFor(15000);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('December uses workshop dispatches and retains the fifteen-second rotation', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-23T12:00:00Z') });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/santa-tracker');
  await expect(page.locator('main')).toContainText('Workshop Dispatch');
  await expect(page.locator('main')).toContainText('sticky-tape dispenser');
  await expect(page.locator('.tracker-postcard')).toHaveCount(0);
  await page.clock.runFor(15000);
  await expect(page.locator('main')).toContainText('label drawer');
});
