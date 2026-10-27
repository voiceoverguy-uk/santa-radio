// node handover/check-browser.mjs https://your-development-host
// No radio playback, sharing, native-device or provider checks are implied.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const baseURL = process.argv[2];
if (!baseURL || !/^https?:\/\//.test(baseURL)) throw new Error('Pass the running web host URL.');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ||
    (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
let count = 0;
try {
  for (const [iso, expected] of [
    ['2026-11-30T23:59:59Z', 'On Holiday'],
    ['2026-12-01T00:00:00Z', 'At the North Pole'],
    ['2026-12-24T09:59:59Z', 'Preparing for Takeoff'],
    ['2026-12-24T10:00:00Z', 'Delivering Now'],
    ['2026-12-25T00:15:00Z', 'Delivering Now'],
    ['2026-12-25T10:00:00.001Z', 'Journey Complete'],
  ]) {
    const context = await browser.newContext();
    if (process.argv.includes('--local-only')) {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/')) return route.abort();
        return route.continue();
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(iso));
    await page.goto(new URL('/santa-tracker', baseURL).href);
    await page.locator('main .tracker-status').filter({ hasText: expected }).waitFor();
    assert.equal(await page.locator('main svg[role="img"]').isVisible(), true);
    if (iso === '2026-12-25T00:15:00Z') {
      assert.match(await page.locator('main').innerText(), /United Kingdom/);
      assert.match(await page.locator('main').innerText(), /Santa is here/);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS rendered boundary ${iso}: ${expected}`);
    count++;
    await context.close();
  }
  console.log(`${count}/${count} browser boundary checks passed`);
} finally {
  await browser.close();
}
