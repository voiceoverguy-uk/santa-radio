import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../lib/radio-state.ts';
import { getDashboardData, isHolidaySeason, isDecemberPrep } from '../lib/tracker-source/lib/santaRoute.ts';
test('radio current track validation handles missing artist and unavailable data without stale title', () => {
  assert.deepEqual(parseMetadata({ currentStatus: 'ready', current: { title: 'Santa Radio', artist: '' } }), { title: 'Santa Radio', artist: '' });
  assert.equal(parseMetadata({ currentStatus: 'unavailable' }), null);
  for (const data of [null, {}, { currentStatus: 'ready', current: { title: 12, artist: 'Santa' } }]) assert.throws(() => parseMetadata(data));
});
test('tracker preserves holiday end and preparation dates, and UTC journey milestones', () => {
  assert.equal(isHolidaySeason(new Date('2026-11-30T23:59:59Z')), true);
  assert.equal(isHolidaySeason(new Date('2026-12-01T00:00:00Z')), false);
  assert.equal(isDecemberPrep(new Date('2026-12-01T00:00:00Z')), true);
  assert.equal(getDashboardData(new Date('2026-12-24T09:59:59Z')).mode, 'PREPARING');
  assert.equal(getDashboardData(new Date('2026-12-24T10:00:00Z')).mode, 'LIVE');
  assert.equal(getDashboardData(new Date('2026-12-25T11:20:00Z')).mode, 'COMPLETE');
});
