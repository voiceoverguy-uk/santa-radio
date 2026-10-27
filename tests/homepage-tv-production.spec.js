import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';

// Exercise the real built Node document server and browser hydration, not
// Vite or a hand-made HTML fixture. Run npm run build before this spec.
let server;
let origin;
test.beforeAll(async () => {
  server = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Built server did not start')), 10000);
    server.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Built server exited: ${code}`));
    });
    server.stdout.on('data', data => {
      const port = data.toString().match(/listening on port (\d+)/)?.[1];
      if (port) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${port}`);
      }
    });
    server.stderr.on('data', data => console.error(data.toString()));
  });
});
test.afterAll(() => server?.kill('SIGTERM'));

for (const media of [null, false, true]) {
  test(`built homepage hydrates safely with ${media === null ? 'no saved choice' : `media=${media}`}`, async ({ page, request }) => {
    const response = await request.get(origin);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain('This homepage TV loads YouTube automatically');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('YouTube is off');
    const requests = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/https:\/\/(?:www\.youtube\.com\/embed\/|www\.googletagmanager\.com\/|connect\.facebook\.net\/|tunein\.com\/embed\/)/, route => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: 'Mock provider' });
    });
    await page.route('**/api/radio-metadata*', route => route.fulfill({
      json: { available: false, current: null, upcoming: [] },
    }));
    if (media !== null) await page.addInitScript(media => localStorage.setItem('santaradio-cookie-consent-v2',
      JSON.stringify({ version: 2, analytics: false, marketing: false, media, savedAt: Date.now() })), media);
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.tv-screen')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.youtube-section iframe')).toHaveCount(media === false ? 0 : 1);
    if (media !== false) await expect.poll(() => requests.length).toBe(1);
    else expect(requests).toHaveLength(0);
    await expect(page.locator('#santaradio-google-analytics, #santaradio-meta-pixel')).toHaveCount(0);
    if (media === null) {
      expect(await page.evaluate(() => localStorage.getItem('santaradio-cookie-consent-v2'))).toBeNull();
    }
    expect(errors).toEqual([]);
  });
}
