import { test, expect } from '@playwright/test';
import { createMetadataService } from '../server/radio-metadata.js';

const leona = { artist: 'Leona Lewis', title: 'One More Sleep' };
const bryan = { artist: 'Bryan Adams', title: 'Christmas Time' };
const previous = { artist: 'Previous Artist', title: 'Previous Song' };
const queueText = 'Leona Lewis - One More Sleep\n - Santa Radio Announcement\nBryan Adams - Christmas Time\nLeona Lewis - One More Sleep';
const text = value => new Response(value, { headers: { 'content-type': 'text/plain' } });
const line = track => `${track.artist} - ${track.title}`;
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('current-first Leona transition corrects all and upcoming without mutating the raw queue or later repeats', async () => {
  let time = 100000, now = previous;
  const calls = { current: 0, upcoming: 0 };
  const service = createMetadataService(async url => {
    const part = url.pathname.endsWith('Nowplaying.txt') ? 'current' : 'upcoming';
    calls[part]++;
    return text(part === 'current' ? line(now) : queueText);
  }, undefined, { clock: () => time });
  const before = await service();
  expect(before.upcoming).toEqual([leona, bryan, leona]);
  time += 1000;
  now = { artist: '  LEONA   LEWIS ', title: 'one more   sleep ' };
  await service('current');
  expect((await service('upcoming')).upcoming).toEqual([bryan, leona]);
  expect((await service()).upcoming).toEqual([bryan, leona]);
  expect(before.upcoming).toEqual([leona, bryan, leona]);
  expect(calls).toEqual({ current: 2, upcoming: 2 });
  // Same raw queue can be interpreted again when current data changes.
  time += 1000;
  now = previous;
  expect((await service()).upcoming).toEqual([leona, bryan, leona]);
});

test('queue-first transition keeps broadcast order, only matches both fields and leaves unavailable current alone', async () => {
  let time = 100000, now = previous, queue = queueText;
  const service = createMetadataService(async url => text(url.pathname.endsWith('Nowplaying.txt')
    ? now ? line(now) : ' - Station announcement' : queue),
  undefined, { clock: () => time });
  await service();
  time += 1000;
  queue = `${line(bryan)}\n${line(leona)}`;
  expect((await service('upcoming')).upcoming).toEqual([bryan, leona]);
  time += 1000;
  now = leona;
  expect((await service()).upcoming).toEqual([bryan, leona]);
  time += 1000;
  queue = 'Other Artist - One More Sleep\nLeona Lewis - Other Song\nLeona Lewis - One More Sleep';
  expect((await service()).upcoming).toHaveLength(3);
  time += 1000;
  now = null;
  queue = queueText;
  expect(await service()).toMatchObject({ current: null, currentStatus: 'unavailable', upcoming: [leona, bryan, leona] });
});

test('upcoming-only cold consumers read current, while current failures retain an unaltered queue', async () => {
  let time = 100000, fail = false;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Nowplaying.txt')) {
      if (fail) throw new Error('Offline');
      return text(line(leona));
    }
    return text(queueText);
  }, undefined, { clock: () => time });
  expect(await service('upcoming')).toMatchObject({ upcoming: [bryan, leona] });
  time += 1000; fail = true;
  const next = await service('upcoming');
  expect(next.upcoming).toEqual([leona, bryan, leona]);
  expect(next).not.toHaveProperty('current');
});

test('retained stale queue is reconciled against new current and expires at the original deadline', async () => {
  let time = 100000, now = previous, fail = false, attempts = 0;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Nowplaying.txt')) return text(line(now));
    attempts++;
    if (fail) throw new Error('Queue offline');
    return text(queueText);
  }, undefined, { clock: () => time, retryDelay: 0 });
  await service();
  time += 1000; now = leona; fail = true;
  const retained = await service('upcoming');
  expect(retained).toEqual({ upcoming: [bryan, leona], upcomingStatus: 'stale', upcomingUpdatedAt: 100000 });
  expect(attempts).toBe(3);
  expect(await service('upcoming')).toBe(retained);
  time = 145000;
  expect(await service()).toMatchObject({ current: leona, upcoming: [], upcomingStatus: 'unavailable', upcomingUpdatedAt: 100000 });
  expect(attempts).toBe(5);
  fail = false; time += 1000;
  expect(await service('upcoming')).toMatchObject({ upcoming: [bryan, leona], upcomingStatus: 'ready', upcomingUpdatedAt: 146000 });
});

test('late queue and combined responses use the latest completed current read, not their original snapshot', async () => {
  let time = 100000, now = previous, queueCalls = 0;
  const gate = deferred();
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Nowplaying.txt')) return text(line(now));
    queueCalls++;
    await gate.promise;
    return text(queueText);
  }, undefined, { clock: () => time });
  const combined = service();
  const upcoming = service('upcoming');
  expect((await service('current')).current).toEqual(previous);
  time += 1000; now = leona;
  expect((await service('current')).current).toEqual(leona);
  gate.resolve();
  expect(await combined).toMatchObject({ current: leona, upcoming: [bryan, leona] });
  expect((await upcoming).upcoming).toEqual([bryan, leona]);
  expect(queueCalls).toBe(1);
});

test('late current completion reconciles an already completed queue with deduplicated reads', async () => {
  const gate = deferred();
  let currentCalls = 0, queueCalls = 0;
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Nowplaying.txt')) {
      currentCalls++;
      await gate.promise;
      return text(line(leona));
    }
    queueCalls++;
    return text(queueText);
  });
  const all = service();
  const next = service('upcoming');
  const now = service('current');
  gate.resolve();
  expect((await all).upcoming).toEqual([bryan, leona]);
  expect((await next).upcoming).toEqual([bryan, leona]);
  expect((await now).current).toEqual(leona);
  expect({ currentCalls, queueCalls }).toEqual({ currentCalls: 1, queueCalls: 1 });
});

test('stale expiry during a slow current read cannot extend retention', async () => {
  let time = 100000, fail = false, hold = false;
  const gate = deferred();
  const service = createMetadataService(async url => {
    if (url.pathname.endsWith('Nowplaying.txt')) {
      if (hold) await gate.promise;
      return text(line(leona));
    }
    if (fail) throw new Error('Queue offline');
    return text(queueText);
  }, undefined, { clock: () => time, retryDelay: 0 });
  await service();
  time = 143900;
  await service('current'); // Current cache expires at 144900.
  time = 144800; fail = true;
  expect((await service('upcoming')).upcomingStatus).toBe('stale');
  time = 144950; hold = true;
  // Current is expired, but the stale queue cache is still valid. Its original
  // retention deadline (145000) passes while awaiting the current read.
  const response = service();
  time = 145010;
  gate.resolve();
  expect(await response).toMatchObject({ upcoming: [], upcomingStatus: 'unavailable' });
});
