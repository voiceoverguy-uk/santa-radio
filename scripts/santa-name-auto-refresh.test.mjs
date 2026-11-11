import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createNameSnapshotStore } from '../server/santa-name-snapshot.js';

test('old daily snapshot refreshes on first new feed request, then retains last good data on failure', async () => {
  let now = 1_800_000_000_000, calls = 0, broken = false;
  const payload = JSON.stringify([{ name: 'Old' }]);
  let row = { version: createHash('sha256').update(payload).digest('hex'), payload,
    record_count: 1, refreshed_at: new Date(now - 3600000), next_refresh_at: new Date(now + 23 * 3600000) };
  const pool = { async query(sql, values) {
    if (sql.startsWith('SELECT')) return { rows: [{ ...row }] };
    if (sql.includes('SET lease_token=$1')) return { rowCount: 1, rows: [{ lease_token: values[0] }] };
    if (sql.includes('payload=$1')) {
      row = { ...row, payload: values[0], version: values[1], record_count: values[2], refreshed_at: values[3], next_refresh_at: values[4] };
      return { rowCount: 1, rows: [{ version: row.version }] };
    }
    if (sql.includes('retry_after=$1')) { row.retry_after = values[0]; return { rowCount: 1 }; }
    throw new Error('Unexpected SQL');
  } };
  const store = createNameSnapshotStore({ pool: () => pool, now: () => now, parse: JSON.parse,
    fetchIndex: async () => { calls++; if (broken) throw new Error('offline'); return JSON.stringify([{ name: 'New' }]); } });
  assert.deepEqual(await store.load(), [{ name: 'New' }]);
  assert.equal(calls, 1);
  now += 239999;
  await store.load(); assert.equal(calls, 1);
  now += 2; broken = true;
  assert.deepEqual(await store.load(), [{ name: 'New' }]);
  assert.equal(calls, 2);
  await store.load(); assert.equal(calls, 2, 'failure backoff prevents repeated upstream calls');
});
