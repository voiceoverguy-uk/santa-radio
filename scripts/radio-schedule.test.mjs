import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeSong, upcomingSchedule, songDuration, formatPlayTime } from '../src/lib/radio-schedule.js';
const known = { artist: 'Coldplay', title: 'Christmas Lights' };
const unknown = { artist: 'New artist', title: 'New song' };
test('first observation waits; transitions anchor once; long gaps wait again', () => {
  const first = observeSong(null, known, 100000);
  assert.equal(first.startedAt, null);
  const next = observeSong(first, unknown, 105000);
  assert.equal(next.startedAt, 105000);
  assert.equal(observeSong(next, unknown, 110000).startedAt, 105000);
  assert.equal(observeSong(next, known, 140000).startedAt, null);
});
test('known durations and 3:30 fallback accumulate with five-second jingles', () => {
  const metadata = { current: known, currentStatus: 'ready', currentStartedAt: 100000,
    upcomingStatus: 'ready', upcoming: [unknown, known, unknown] };
  assert.equal(songDuration(known), 243);
  assert.equal(songDuration(unknown), 210);
  assert.deepEqual(upcomingSchedule(metadata, 100001).map(t => t.estimatedAt), [348000,563000,811000]);
  assert.equal(upcomingSchedule({ ...metadata, currentStartedAt: null }, 100001)[0].estimatedAt, null);
  assert.equal(upcomingSchedule(metadata, 348001)[0].estimatedAt, null);
  assert.deepEqual(upcomingSchedule({ ...metadata, upcomingStatus: 'stale' }), []);
});
test('times use UK daylight saving and midnight correctly', () => {
  assert.equal(formatPlayTime(Date.parse('2026-11-26T15:38:00Z')), '3:38pm');
  assert.equal(formatPlayTime(Date.parse('2026-06-26T15:38:00Z')), '4:38pm');
  assert.equal(formatPlayTime(Date.parse('2026-11-27T00:02:00Z')), '12:02am');
});
test('nine published times override calculated times, even without current metadata', () => {
  const upcoming = Array.from({ length: 9 }, (_, i) => ({ ...unknown, startedAt: 200000 + i * 100000 }));
  for (const currentStatus of ['ready', 'unavailable']) {
    const result = upcomingSchedule({ current: known, currentStatus, currentStartedAt: 100000,
      upcomingStatus: 'ready', upcoming }, 100001);
    assert.equal(result.length, 9);
    assert.deepEqual(result.map(t => t.estimatedAt), upcoming.map(t => t.startedAt));
  }
});
test('missing timestamps fall back from published starts; stale timestamps clear estimates', () => {
  const metadata = { upcomingStatus: 'ready', upcoming: [
    { ...unknown, startedAt: 200000 }, unknown,
    { ...known, startedAt: 90000 }, unknown,
    { ...known, startedAt: 900000 }, unknown,
  ] };
  assert.deepEqual(upcomingSchedule(metadata, 100000).map(t => t.estimatedAt),
    [200000, 415000, null, null, 900000, 1148000]);
});
