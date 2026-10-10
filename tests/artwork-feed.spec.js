import { test, expect } from '@playwright/test';

test('development feed is public JSON and its versioned images load cross-origin', async ({ page, request }) => {
  const response = await request.get('/artist-artwork/catalogue.json', {
    headers: { Origin: 'https://mobile.example.test' },
  });
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(response.headers()['access-control-allow-origin']).toBe('*');
  expect(response.headers()['cache-control']).toBe('no-cache');
  const feed = await response.json();
  expect(feed.artists['chris kamara'].path).toBe('/artist-artwork/chris-kamara.webp');
  expect(feed.artists['george michael'].path).toBe('/artist-artwork/george-michael.webp');
  expect(feed.fallback.path).toBe('/artist-artwork/santa-fallback.webp');
  expect(feed.artists['meghan trainor']).toBeUndefined();
  expect(feed.schemaVersion).toBe(1);
  expect(feed.version).toMatch(/^[a-f0-9]{64}$/);
  const origin = new URL(response.url()).origin;
  await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
  // An opaque-origin frame emulates a separately hosted preview. A real browser fetch
  // and crossOrigin image load enforce CORS, unlike request-only tests.
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'external-client';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.srcdoc = '<!doctype html><body>Mobile feed check</body>';
    document.body.append(iframe);
  });
  const frame = page.frameLocator('#external-client');
  await expect(frame.locator('body')).toContainText('Mobile feed check');
  const browserFrame = await (await page.locator('#external-client').elementHandle()).contentFrame();
  const result = await browserFrame.evaluate(async base => {
    const feed = await (await fetch(`${base}/artist-artwork/catalogue.json`)).json();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = new URL(feed.artists['chris kamara'].url, base).href;
    await image.decode();
    return { width: image.naturalWidth, version: feed.version };
  }, origin);
  expect(result.width).toBe(512);
  expect(result.version).toBe(feed.version);
});
