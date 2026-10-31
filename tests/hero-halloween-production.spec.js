import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { render } from '../dist/server/entry-server.js';

// Run after npm run build. Verify the real built documents and local font,
// rather than relying only on Vite's client-rendered development page.
let server;
let origin;
test.beforeAll(async () => {
  server = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Built server did not start')), 10000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Built server exited: ${code}`)); });
    server.stdout.on('data', data => {
      const port = data.toString().match(/listening on port (\d+)/)?.[1];
      if (port) { clearTimeout(timeout); resolve(`http://127.0.0.1:${port}`); }
    });
  });
});
test.afterAll(() => server?.kill('SIGTERM'));

for (const route of ['/', '/preview/hero-name-checker']) {
  test(`built ${route} starts date-neutral and mounts the visitor-local greeting safely`, async ({ page, request }) => {
    const response = await request.get(origin + route);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain('A little magic from the North Pole.');
    expect(html).not.toContain('hero-halloween-greeting');
    // Direct server rendering is also date-neutral even on Halloween.
    const RealDate = Date;
    try {
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : ['2030-10-31T12:00:00Z'])); }
      };
      expect(render(route).markup).not.toContain('hero-halloween-greeting');
    } finally {
      globalThis.Date = RealDate;
    }
    await page.clock.install({ time: new Date('2027-10-31T12:00:00Z') });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/hydrat|did not match|server HTML|Minified React error/i.test(message.text())) errors.push(message.text());
    });
    await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
    await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
      current: null, upcoming: [], currentStatus: 'unavailable', upcomingStatus: 'unavailable',
    } }));
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      records: [{ id: 'arabella', name: 'Arabella' }], hostedCount: 1, warning: null,
    } }));
    await page.goto(origin + route);
    await expect(page.locator('.hero-halloween-greeting')).toHaveText('Happy Halloween');
    await expect(page.locator('.hero h1')).toHaveText('Santa Radio A little magic from the North Pole.');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some(face =>
      face.family.includes('Creepster') && face.status === 'loaded'))).toBe(true);
    await page.clock.setSystemTime(new Date('2027-11-01T12:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.hero-halloween-greeting')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('production serves the licensed self-hosted font as WOFF2', async ({ request }) => {
  const response = await request.get(origin + '/fonts/creepster-latin-400-normal.woff2');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('font/woff2');
  const bytes = await response.body();
  expect(bytes.subarray(0, 4).toString()).toBe('wOF2');
  expect(bytes.length).toBeLessThan(40000);
  const license = await request.get(origin + '/fonts/Creepster-OFL.txt');
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain('SIL OPEN FONT LICENSE');
});
