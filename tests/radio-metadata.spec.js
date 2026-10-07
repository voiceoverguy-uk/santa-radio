import { test, expect } from '@playwright/test';
import { parseTracks, createMetadataService } from '../server/radio-metadata.js';

test('feeds parse safely, preserve title hyphens and limit the queue', () => {
  expect(parseTracks('\uFEFFA - Title - Live\r\n\nB - Song\nC - Song\nD - Song')).toEqual([
    { artist: 'A', title: 'Title - Live' }, { artist: 'B', title: 'Song' }, { artist: 'C', title: 'Song' },
  ]);
  expect(() => parseTracks('<html>Homepage</html>')).toThrow();
  expect(() => parseTracks('no delimiter')).toThrow();
  expect(() => parseTracks('x'.repeat(9000))).toThrow();
  expect(parseTracks('Taylor Swift - Christmas Tree Farm\n - Santa Radio Free Message ID - VO\nBackstreet Boys - Christmas In New York')).toEqual([
    { artist: 'Taylor Swift', title: 'Christmas Tree Farm' },
    { artist: 'Backstreet Boys', title: 'Christmas In New York' },
  ]);
  expect(() => parseTracks('Artist - ')).toThrow();
  expect(parseTracks(' - Station ID\nSanta Radio - Jingle')).toEqual([]);
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
  expect(calls).toBe(3);
  fail = false;
  await new Promise(resolve => setTimeout(resolve, 40));
  expect(await service()).toMatchObject({ upcomingStatus: 'ready', upcoming: [{ artist: 'Artist', title: 'Song' }] });
});

test('all-jingle feeds are a valid empty queue, not stale song data', async () => {
  const service = createMetadataService(async () => new Response(' - Santa Radio Free Message ID - VO', {
    headers: { 'content-type': 'text/plain' },
  }));
  expect(await service()).toMatchObject({
    current: null, currentStatus: 'unavailable', upcoming: [], upcomingStatus: 'ready',
  });
});

test('live metadata endpoint returns independent feed states', async ({ request }) => {
  const response = await request.get('/api/radio-metadata');
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toBe('no-store');
  const data = await response.json();
  expect(['ready', 'unavailable']).toContain(data.currentStatus);
  if (data.currentStatus === 'ready') expect(data.current.title).toBeTruthy();
  expect(['ready', 'stale', 'unavailable']).toContain(data.upcomingStatus);
  expect(data.upcoming.length).toBeLessThanOrEqual(3);
  if (data.upcomingStatus !== 'unavailable') {
    for (const track of data.upcoming) expect(track.title).toBeTruthy();
  }
});

test('upcoming retries once, retains briefly, expires and recovers independently', async () => {
  let time = 100000, mode = 'retry', attempts = 0;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Next3.txt')) {
      attempts++;
      if (mode === 'fail' || (mode === 'retry' && attempts === 1)) {
        return new Response('', { headers: { 'content-type': 'text/plain' } });
      }
    }
    return new Response('Artist - Song', { headers: { 'content-type': 'text/plain' } });
  }, 10, { clock: () => time, retryDelay: 0 });
  expect(await service()).toMatchObject({ upcomingStatus: 'ready' });
  expect(attempts).toBe(2);
  mode = 'fail'; time += 20;
  expect(await service()).toMatchObject({ currentStatus: 'ready', upcomingStatus: 'stale', upcoming: [{ artist: 'Artist', title: 'Song' }] });
  time += 45000;
  expect(await service()).toMatchObject({ currentStatus: 'ready', upcomingStatus: 'unavailable', upcoming: [] });
  mode = 'ok'; time += 20;
  expect(await service()).toMatchObject({ upcomingStatus: 'ready' });
});

test('browser labels retained upcoming songs, expires them and recovers after network failure', async ({ page }) => {
  await page.clock.install();
  let fail = false;
  await page.route('**/api/radio-metadata', route => fail ? route.abort() : route.fulfill({
    json: { current: null, currentStatus: 'unavailable', upcomingStatus: 'ready',
      upcoming: [{ artist: 'Test Artist', title: 'Retained Song' }] },
  }));
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const dock = page.locator('.radio-dock');
  await dock.getByRole('button', { name: /coming up/i }).click();
  await expect(dock).toContainText('Retained Song');
  fail = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dock).toContainText('Updating… Showing the last received list.');
  await expect(dock).toContainText('Retained Song');
  await page.clock.runFor(46000);
  await expect(dock).not.toContainText('Retained Song');
  fail = false;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dock).toContainText('Retained Song');
  await expect(dock).not.toContainText('Updating…');
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
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Music', exact: true }).click();
  expect(await page.evaluate(() => window.originalAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
