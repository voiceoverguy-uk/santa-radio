import { test, expect } from '@playwright/test';
import { parseTracks, createMetadataService } from '../server/radio-metadata.js';

test('feeds parse safely, preserve title hyphens and limit the queue', () => {
  expect(parseTracks('\uFEFFA - Title - Live\r\n\nB - Song\nC - Song\nD - Song')).toEqual([
    { artist: 'A', title: 'Title - Live' }, { artist: 'B', title: 'Song' }, { artist: 'C', title: 'Song' },
  ]);
  expect(() => parseTracks('<html>Homepage</html>')).toThrow();
  expect(() => parseTracks('no delimiter')).toThrow();
  expect(() => parseTracks('x'.repeat(9000))).toThrow();
});

test('metadata caches briefly, isolates failures and recovers', async () => {
  let calls = 0, fail = true;
  const service = createMetadataService(async url => {
    calls++;
    expect(url.searchParams.has('_')).toBe(true);
    if (url.pathname.endsWith('Next3.txt') && fail) return new Response('<html/>', { headers: { 'content-type': 'text/html' } });
    return new Response('Artist - Song', { headers: { 'content-type': 'text/plain' } });
  }, 30);
  expect(await service()).toMatchObject({ currentStatus: 'ready', upcomingStatus: 'unavailable' });
  await service();
  expect(calls).toBe(2);
  fail = false;
  await new Promise(resolve => setTimeout(resolve, 40));
  expect(await service()).toMatchObject({ upcomingStatus: 'ready', upcoming: [{ artist: 'Artist', title: 'Song' }] });
});

test('live metadata endpoint returns independent feed states', async ({ request }) => {
  const response = await request.get('/api/radio-metadata');
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toBe('no-store');
  const data = await response.json();
  expect(data.currentStatus).toBe('ready');
  expect(data.current.artist).toBeTruthy();
  expect(data.upcomingStatus).toBe('ready');
  expect(data.upcoming).toHaveLength(3);
});

test('tracks render, queue expands, refresh recovers and navigation keeps audio', async ({ page }) => {
  let failed = false, title = 'Christmas Song';
  await page.route('**/api/radio-metadata', route => route.fulfill({
    json: failed
      ? { current: null, upcoming: [], currentStatus: 'unavailable', upcomingStatus: 'unavailable' }
      : { current: { artist: 'Test Artist', title }, upcoming: [
        { artist: 'Next Artist', title: 'Upcoming Song' },
        { artist: 'Second Artist', title: 'Second Song' },
        { artist: 'Third Artist', title: 'Third Song' },
      ], currentStatus: 'ready', upcomingStatus: 'ready' },
  }));
  await page.goto('/');
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock).toContainText('Christmas Song');
  const toggle = dock.getByRole('button', { name: /coming up/i });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(dock).toContainText('Upcoming Song');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => { window.originalAudio = document.querySelector('audio'); document.dispatchEvent(new Event('visibilitychange')); });
  failed = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dock).not.toContainText('Christmas Song');
  failed = false;
  title = 'New Song';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dock).toContainText('New Song');
  await page.locator('.welcome-links').getByRole('link', { name: /Explore the music/ }).click();
  expect(await page.evaluate(() => window.originalAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
