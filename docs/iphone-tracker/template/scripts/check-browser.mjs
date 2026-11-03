// Run against `npm run preview`, or file:///absolute/path/dist/index.html.
// Browser checks are not WKWebView, simulator or real-device certification.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
let cases = 0;
try {
  for (const width of [320, 375, 390]) for (const [iso, expected] of [
    ['2026-07-15T12:00:00Z', 'Christmas in July'],
    ['2026-11-30T23:59:59Z', 'On Holiday'],
    ['2026-12-01T00:00:00Z', 'At the North Pole'],
    ['2026-12-24T09:59:59Z', 'Preparing for Takeoff'],
    ['2026-12-24T10:00:00Z', 'Delivering Now'],
    ['2026-12-25T00:15:00Z', 'Delivering Now'],
    ['2026-12-25T11:20:00Z', 'Journey Complete'],
    ['2026-12-26T00:00:00Z', 'At the North Pole'],
    ['2027-01-01T00:00:00Z', 'At the North Pole'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const external = [], failed = [], errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.protocol !== 'file:' && url.origin !== new URL(base).origin) {
        external.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => failed.push(`${request.failure()?.errorText} ${request.url()}`));
    await page.clock.setFixedTime(new Date(iso));
    await page.goto(base);
    await page.locator('.tracker-status').filter({ hasText: expected }).waitFor();
    assert.equal(await page.locator('svg[role="img"]').isVisible(), true);
    await page.evaluate(() => document.fonts.ready);
    for (const spec of ['400 24px Cinzel', '500 16px Inter']) {
      assert.equal(await page.evaluate(spec => document.fonts.check(spec), spec), true);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await page.locator('.sm\\:hidden [data-santa-activity]').count(), 60);
    for (const img of await page.locator('img').all()) {
      assert.equal(await img.evaluate(el => el.complete && el.naturalWidth > 0), true);
    }
    if (iso.includes('12-01')) assert.match(await page.locator('main').innerText(), /Workshop Dispatch/i);
    if (iso.includes('00:15')) {
      assert.match(await page.locator('main').innerText(), /United Kingdom/);
      assert.match(await page.locator('main').innerText(), /Santa is here/);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    assert.deepEqual(external, []);
    console.log(`PASS ${width}px ${iso} ${expected}; all assets local`);
    cases++;
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 375, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'preview=1');
  const toggle = page.getByRole('switch', { name: 'Preview mode' });
  await toggle.click();
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await page.locator('.tracker-status').filter({ hasText: 'Journey Complete' }).waitFor();
  await page.getByRole('button', { name: '10×', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '10×', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Reset to Real Time' }).click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  assert.equal(await page.evaluate(() => localStorage.getItem('santa-tracker-preview')), null);
  await page.getByRole('button', { name: 'Preview Controls' }).click();
  assert.equal(await page.getByRole('region', { name: 'Preview controls' }).isVisible(), false);
  await page.close();
  console.log(`${cases}/${cases} seasonal phone renders + preview controls passed. No native-device claim.`);
} finally {
  await browser.close();
}
