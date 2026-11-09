import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

let child;
let base;
test.beforeAll(async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['index.js', `--port=${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Built server did not start')), 15000);
    child.stdout.on('data', chunk => {
      if (chunk.toString().includes('listening')) { clearTimeout(timeout); resolve(); }
    });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Built server exited ${code}`)); });
  });
});
test.afterAll(() => child?.kill('SIGTERM'));

test('built direct page starts the real map cleanly, loads artwork and survives refresh', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assets = [];
  page.on('response', response => {
    if (response.url().includes('/assets/') || response.url().includes('/images/tracker/')) {
      assets.push({ url: response.url(), status: response.status() });
    }
  });
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00Z'));
  const response = await page.goto(`${base}/styt`);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('tracker-capture');
  await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
  const marker = page.locator('[data-santa-artwork]');
  await expect(marker).toHaveAttribute('href', '/images/tracker/santa-route-scout.png');
  expect(await marker.evaluate(async node => {
    const image = new Image();
    image.src = node.getAttribute('href');
    await image.decode();
    return image.naturalWidth;
  })).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Follow Santa', exact: true }).click();
  await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'follow');
  await page.reload();
  await expect(page.locator('.tj-camera')).toHaveAttribute('data-map-view', 'world');
  await expect(page.locator('.navbar, footer, .radio-dock, .marketing-consent, .santa-offer')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(assets.length).toBeGreaterThan(2);
  expect(assets.filter(asset => asset.status >= 400)).toEqual([]);
});
