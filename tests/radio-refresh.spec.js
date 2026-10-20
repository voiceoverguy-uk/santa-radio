import { test, expect } from '@playwright/test';
import { createMetadataService } from '../server/radio-metadata.js';

const text = value => new Response(value, { headers: { 'content-type': 'text/plain' } });

test('independent current reads never wait for upcoming, and combined callers share both caches', async () => {
  let release, currentCalls = 0, upcomingCalls = 0;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Next3.txt')) {
      upcomingCalls++;
      await new Promise(resolve => { release = resolve; });
      return text('Next Artist - Next Song');
    }
    currentCalls++;
    return text('Current Artist - Current Song');
  });
  const next = service('upcoming');
  const combined = service();
  const [first, second] = await Promise.all([service('current'), service('current')]);
  expect(first).toEqual({ current: { artist: 'Current Artist', title: 'Current Song' }, currentStatus: 'ready' });
  expect(second).toBe(first);
  expect(currentCalls).toBe(1);
  expect(upcomingCalls).toBe(1);
  release();
  const queue = await next;
  const all = await combined;
  expect(all).toEqual({ ...first, ...queue });
  expect(await service()).toBe(all);
});

test('current failure and cache expiry do not refetch or erase the upcoming queue', async () => {
  let now = 100000, fail = false, nextCalls = 0;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Next3.txt')) {
      nextCalls++;
      return text('Next Artist - Next Song');
    }
    if (fail) throw new Error('Current offline');
    return text('Artist - Song');
  }, 3000, { clock: () => now, retryDelay: 0 });
  const next = await service('upcoming');
  expect((await service('current')).currentStatus).toBe('ready');
  now += 3000;
  fail = true;
  expect(await service('current')).toEqual({ current: null, currentStatus: 'unavailable' });
  expect(nextCalls).toBe(1);
  expect(next.upcoming[0].title).toBe('Next Song');
  fail = false;
  now += 2000;
  expect((await service('current')).currentStatus).toBe('ready');
});

test('upcoming failure retention expires at its original deadline without affecting current', async () => {
  let now = 100000, fail = false;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Next3.txt') && fail) throw new Error('Queue offline');
    return text('Artist - Song');
  }, 3000, { clock: () => now, retryDelay: 0 });
  await service('upcoming');
  now += 3000;
  fail = true;
  expect((await service('upcoming')).upcomingStatus).toBe('stale');
  expect((await service('current')).currentStatus).toBe('ready');
  now = 145000;
  expect(await service('upcoming')).toMatchObject({ upcomingStatus: 'unavailable', upcoming: [] });
});

async function setup(page, handler) {
  const time = new Date('2026-10-14T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  });
  await page.route('**/api/radio-metadata*', handler);
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
  return page.locator('.radio-dock');
}
const partOf = route => new URL(route.request().url()).searchParams.get('part');
const currentData = title => ({ currentStatus: 'ready', current: { artist: 'Test Artist', title } });
const nextData = title => ({ upcomingStatus: 'ready', upcoming: [{ artist: 'Next Artist', title }] });
async function hide(page, hidden) {
  await page.evaluate(value => {
    window.radioHidden = value;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.radioHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('slow upcoming request cannot block changing current title; its failure cannot erase current', async ({ page }) => {
  let title = 'Initial Song', held = [];
  const dock = await setup(page, route => {
    if (partOf(route) === 'upcoming') { held.push(route); return; }
    return route.fulfill({ json: currentData(title) });
  });
  await expect(dock).toContainText(title);
  title = 'New Song';
  await page.clock.runFor(5000);
  await expect(dock).toContainText(title);
  for (const route of held) await route.abort().catch(() => {});
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('unavailable');
  await expect(dock).toContainText(title);
});

test('five-second current and queue polling follow playback and visibility independently', async ({ page }) => {
  let title = 'Initial Song';
  const requests = { current: 0, upcoming: 0 };
  const dock = await setup(page, route => {
    const part = partOf(route);
    requests[part]++;
    return route.fulfill({ json: part === 'current' ? currentData(title) : nextData('Next Song') });
  });
  await expect(dock).toContainText(title);
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Next Song');
  const initial = { ...requests };
  await page.clock.runFor(4999);
  expect(requests).toEqual(initial);
  await page.clock.runFor(1);
  await expect(dock).toContainText(title);
  await expect.poll(() => requests.upcoming).toBe(initial.upcoming + 1);
  expect(requests.current).toBe(initial.current + 1);
  await page.clock.runFor(5000);
  await expect.poll(() => requests.upcoming).toBe(initial.upcoming + 2);
  await hide(page, true);
  const hidden = { ...requests };
  await page.clock.runFor(10000);
  expect(requests).toEqual(hidden);
  title = 'Playback Start Song';
  await dock.locator('.radio-play').click();
  await expect(dock).toContainText(title);
  expect(requests.current).toBe(hidden.current + 1);
  expect(requests.upcoming).toBe(hidden.upcoming);
  title = 'Background Song';
  await page.clock.runFor(5000);
  await expect(dock).toContainText(title);
  expect(requests.current).toBe(hidden.current + 2);
  expect(requests.upcoming).toBe(hidden.upcoming);
  await dock.locator('.radio-play').click();
  const paused = { ...requests };
  await page.clock.runFor(20000);
  expect(requests).toEqual(paused);
  title = 'Returned Song';
  await hide(page, false);
  await expect(dock).toContainText(title);
  // Return refresh and a changed-current follow-up can share an active queue
  // read, then perform one bounded follow-up rather than aborting it.
  await expect.poll(() => requests.upcoming).toBe(paused.upcoming + 2);
});

test('return clears expired values while fresh reads are pending and canceled reads cannot win', async ({ page }) => {
  let hold = false, held = [];
  const dock = await setup(page, route => {
    if (hold) { held.push(route); return; }
    return route.fulfill({ json: partOf(route) === 'current' ? currentData('Old Song') : nextData('Old Queue') });
  });
  await expect(dock).toContainText('Old Song');
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Old Queue');
  await hide(page, true);
  await page.clock.runFor(60000);
  hold = true;
  await hide(page, false);
  await expect(dock).not.toContainText('Old Song');
  await expect(dock).not.toContainText('Old Queue');
  await expect.poll(() => held.filter(route => partOf(route) === 'current').length).toBeGreaterThan(0);
  hold = false;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(dock).toContainText('Old Song');
  for (const route of held) {
    await route.fulfill({ json: partOf(route) === 'current' ? currentData('Canceled Song') : nextData('Canceled Queue') }).catch(() => {});
  }
  await expect(dock).not.toContainText('Canceled Song');
  await expect(dock).not.toContainText('Canceled Queue');
});

test('current network failures do not erase ready upcoming and recover after three seconds', async ({ page }) => {
  let fail = false;
  const dock = await setup(page, route => {
    if (partOf(route) === 'current' && fail) return route.abort();
    return route.fulfill({ json: partOf(route) === 'current' ? currentData('Current Song') : nextData('Next Song') });
  });
  await expect(dock).toContainText('Current Song');
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Next Song');
  fail = true;
  await page.clock.runFor(5000);
  await expect(dock).not.toContainText('Current Song');
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Next Song');
  fail = false;
  await page.clock.runFor(3000);
  await expect(dock).toContainText('Current Song');
});

test('current changes promptly refresh a queue whose five-second timer is not yet due', async ({ page }) => {
  let title = 'Previous Song', queueCalls = 0, held, hold = false;
  const dock = await setup(page, route => {
    if (partOf(route) === 'current') return route.fulfill({ json: currentData(title) });
    queueCalls++;
    if (hold) { held = route; return; }
    return route.fulfill({ json: nextData('Bryan Adams Next') });
  });
  await expect(dock).toContainText(title);
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Bryan Adams Next');
  const initial = queueCalls;
  hold = true;
  await page.clock.runFor(5000);
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.clock.runFor(2000);
  await held.fulfill({ json: nextData('One More Sleep') });
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('One More Sleep');
  hold = false;
  title = 'One More Sleep';
  await page.clock.runFor(3000);
  await expect(dock).toContainText(title);
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Bryan Adams Next');
  expect(queueCalls).toBe(initial + 2); // Normal queue timer was due at twelve seconds.
});

test('multiple current transitions coalesce behind a slow queue instead of aborting or overlapping it', async ({ page }) => {
  let title = 'Previous Song', queueCalls = 0, held, hold = false;
  const dock = await setup(page, route => {
    if (partOf(route) === 'current') return route.fulfill({ json: currentData(title) });
    queueCalls++;
    if (hold) { held = route; return; }
    return route.fulfill({ json: nextData('Fresh Queue') });
  });
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Fresh Queue');
  const initial = queueCalls;
  hold = true;
  await page.clock.runFor(5000);
  await expect.poll(() => Boolean(held)).toBe(true);
  title = 'One More Sleep';
  await dock.locator('.radio-play').click();
  await expect(dock).toContainText(title);
  expect(queueCalls).toBe(initial + 1);
  title = 'Christmas Time';
  await dock.locator('.radio-play').click();
  await expect(dock).toContainText(title);
  expect(queueCalls).toBe(initial + 1);
  hold = false;
  await held.fulfill({ json: nextData('Late Queue') });
  await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Fresh Queue');
  expect(queueCalls).toBe(initial + 2);
  await page.clock.runFor(4999);
  expect(queueCalls).toBe(initial + 2);
});

for (const order of ['current-first', 'queue-first']) {
  test(`website consumes reconciled shared Leona transition (${order})`, async ({ page }) => {
    let time = Date.parse('2026-10-14T12:00:00Z'), now = 'Previous Artist - Previous Song';
    let queue = 'Leona Lewis - One More Sleep\n - Santa Radio Announcement\nBryan Adams - Christmas Time\nLeona Lewis - One More Sleep';
    let fail = false;
    const service = createMetadataService(async url => {
      if (url.pathname.endsWith('Nowplaying.txt')) return text(now);
      if (fail) throw new Error('Queue offline');
      return text(queue);
    }, undefined, { clock: () => time, retryDelay: 0 });
    const dock = await setup(page, async route => route.fulfill({ json: await service(partOf(route)) }));
    const list = dock.locator('.radio-tracks-upcoming li');
    await expect(dock.locator('.radio-tracks-current')).toContainText('Previous Song');
    await expect(list.first()).toContainText('One More Sleep');
    if (order === 'queue-first') {
      queue = 'Bryan Adams - Christmas Time\nLeona Lewis - One More Sleep';
      time += 5000;
      await page.clock.runFor(5000);
      await expect(list.first()).toContainText('Christmas Time');
      await expect(dock.locator('.radio-tracks-current')).toContainText('Previous Song');
    } else fail = true; // Retained raw queue must also receive the shared correction.
    now = 'Leona Lewis - One More Sleep';
    time += 5000;
    await page.clock.runFor(5000);
    await expect(dock.locator('.radio-tracks-current')).toContainText('One More Sleep');
    await expect(list.first()).toContainText('Christmas Time');
    await expect(list).toHaveCount(2);
    await expect(list.nth(1)).toContainText('One More Sleep'); // Valid later repeat.
    if (order === 'current-first') {
      await expect(dock.locator('.radio-tracks-upcoming')).toContainText('Updating…');
      fail = false;
      queue = 'Bryan Adams - Christmas Time\nLeona Lewis - One More Sleep';
      time += 5000;
      await page.clock.runFor(5000);
      await expect(dock.locator('.radio-tracks-upcoming')).not.toContainText('Updating…');
    }
  });
}

test('separate API modes and invalid requests preserve no-store HTTP behavior', async ({ request }) => {
  for (const part of ['current', 'upcoming']) {
    const response = await request.get(`/api/radio-metadata?part=${part}`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toBe('no-store');
    const data = await response.json();
    expect(data).toHaveProperty(`${part}Status`);
    expect(data).not.toHaveProperty(part === 'current' ? 'upcomingStatus' : 'currentStatus');
  }
  expect((await request.get('/api/radio-metadata?part=wrong')).status()).toBe(400);
  expect((await request.post('/api/radio-metadata?part=current')).status()).toBe(405);
});
