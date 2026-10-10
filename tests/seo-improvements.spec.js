import { test, expect } from '@playwright/test';
import { songRedirects } from '../src/seo/catalogue.js';

test('initial response has recording content and complete route-specific metadata', async ({ request }) => {
  const response = await request.get('/christmas-artist/3-waitresses-christmas-wrapping');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Christmas Wrapping — Waitresses');
  expect(html).toContain('Artist background');
  expect(html).toContain('id="song-lyrics"');
  expect(html).toContain('"@type":"MusicRecording"');
  expect(html).toContain('https://www.santaradio.co.uk/christmas-artist/3-waitresses-christmas-wrapping');
});
test('pages and native lyrics work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/christmas-artist/3-waitresses-christmas-wrapping');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Christmas Wrapping');
  await page.locator('details summary').click();
  await expect(page.locator('#song-lyrics pre')).toBeVisible();
  await page.goto('/mugshots/all');
  await expect(page.locator('.seo-directory a')).toHaveCount(636);
  await page.goto('/santa-tracker');
  await expect(page.getByRole('heading', { name: 'Your Santa Tracker questions' })).toBeVisible();
  await expect(page.getByText('Is this real GPS tracking?')).toBeVisible();
  await context.close();
});
test('rendered mobile pages retain navigation, gallery controls and compact player', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/christmas-artist/3-waitresses-christmas-wrapping');
  await expect(page).toHaveTitle(/Christmas Wrapping.*Waitresses/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/christmas-artist/3-waitresses-christmas-wrapping');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#main-menu')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.locator('.radio-dock')).toHaveClass(/minimized/);
  await page.goto('/mugshots/all');
  await expect(page.locator('.mugshot-card')).toHaveCount(100);
  await page.getByRole('button', { name: /Load More/ }).click();
  await expect(page.locator('.mugshot-card')).toHaveCount(200);
  await expect(page.locator('.seo-directory a')).toHaveCount(636);
  const width = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(width).toBe(true); expect(errors).toEqual([]);
});
test('HTTP redirects, robots, sitemap, real images, errors and preview exclusion', async ({ request }) => {
  for (const [path, destination] of [
    ['/music', '/christmas-music'],
    ['/artist?s=3', '/christmas-artist/420-pat-benatar-please-come-home-for-christmas'],
    [...songRedirects].find(([path]) => path.startsWith('/christmas-artist/233-')),
    ['/santa-tracker/', '/santa-tracker'],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(308); expect(response.headers().location).toBe(destination);
  }
  for (const path of ['/no-such-page', '/mugshots/unknown', '/christmas-artist/unknown', '/images/no-such-image.png'])
    expect((await request.get(path)).status()).toBe(404);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  const xml = await sitemap.text();
  expect((xml.match(/<loc>/g) || []).length).toBe(1546);
  expect(xml).not.toContain('/preview');
  expect(await (await request.get('/robots.txt')).text()).toContain('https://www.santaradio.co.uk/sitemap.xml');
  for (const [path, type] of [
    ['/images/santa-radio-logo.png', 'image/png'],
    ['/images/santa-tracker-share.png', 'image/png'],
    ['/mugshot-thumbnails/a1-singers-320.webp', 'image/webp'],
  ]) {
    const image = await request.get(path);
    expect(image.status()).toBe(200); expect(image.headers()['content-type']).toContain(type);
  }
  const preview = await request.get('/santa-tracker/preview');
  expect(preview.headers()['x-robots-tag']).toContain('noindex');
  expect(await preview.text()).not.toContain('application/ld+json');
});
test('rendered artist and group-photo schema uses correct subjects and images', async ({ page }) => {
  for (const path of ['/christmas-artist/3-waitresses-christmas-wrapping', '/mugshots/a1-singers', '/santa-tracker']) {
    await page.goto(path);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    const graph = await page.locator('script[type="application/ld+json"]').evaluate(script => JSON.parse(script.textContent)['@graph']);
    expect(graph.some(n => n['@type'] === 'WebSite')).toBe(true);
    expect(graph.some(n => n['@type'] === 'BreadcrumbList')).toBe(true);
    expect(JSON.stringify(graph)).not.toMatch(/ProfilePage|aggregateRating|uploadDate|sameAs/);
    if (path.includes('a1-singers')) {
      expect(graph.some(n => n['@type'] === 'MusicGroup' && n.name === 'A1')).toBe(true);
      expect(graph.some(n => n['@type'] === 'ImageObject' && n.creditText === 'Photo credit: Bruce Davis')).toBe(true);
      const ratio = await page.locator('.mugshot-detail-photo').evaluate(image => {
        const { width, height } = image.getBoundingClientRect();
        return width / height / (image.naturalWidth / image.naturalHeight);
      });
      expect(ratio).toBeGreaterThan(0.97); expect(ratio).toBeLessThan(1.03);
    }
  }
});
