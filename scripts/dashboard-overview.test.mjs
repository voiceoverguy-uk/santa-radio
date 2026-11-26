import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyMetric, storeMetric, sumField } from '../src/lib/dashboardOverview.js';

const rows = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 10, i + 1)).toISOString().slice(0, 10), count: i + 1,
}));

test('uses the selected calendar window regardless of the source order', () => {
  assert.equal(dailyMetric(rows, 'count', 7).value, 189);
  assert.equal(dailyMetric([...rows].reverse(), 'count', 30).value, 465);
  assert.equal(dailyMetric(rows.map(({day, count}) => ({ date: day, count })), 'count', 7, { average: true }).value, 27);
});

test('does not fill gaps or pre-tracking dates with zero', () => {
  assert.equal(dailyMetric(rows.filter(r => r.count !== 27), 'count', 7), null);
  assert.equal(dailyMetric([...rows.slice(0, -1), { ...rows.at(-1), count: null }], 'count', 7), null);
  const tracked = dailyMetric(rows, 'count', 7, { firstTracked: '2026-11-29' });
  assert.equal(tracked.value, 59);
  assert.equal(tracked.partial, true);
  assert.equal(tracked.start, '2026-11-29');
  assert.equal(dailyMetric(rows.map(r => ({ ...r, count: 0 })), 'count', 7).value, 0);
  assert.equal(sumField([], 'votes'), 0);
  assert.equal(sumField(null, 'votes'), null);
});

test('store totals count only reporting apps and disclose partial coverage', () => {
  const apps = [
    { last7Days: 0, last30Days: 19, endDate: '2026-11-22' },
    { last7Days: 8, last30Days: null, endDate: '2026-11-22' },
    { status: 'pending', last7Days: 99, last30Days: 300 },
  ];
  assert.deepEqual(storeMetric({ apps }, 7), { value: 8, count: 2, total: 2, end: '2026-11-22' });
  assert.deepEqual(storeMetric({ apps }, 30), { value: 19, count: 1, total: 2, end: '2026-11-22' });
  assert.equal(storeMetric({ apps: [{ last30Days: null }] }, 30), null);
  assert.equal(storeMetric(null, 7), null);
});
