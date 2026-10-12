import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databasePool, saveNameRequest, listNameRequests } from '../server/name-request-store.js';

test('real database persists requests, groups names and deduplicates repeat submissions', async () => {
  const id = randomUUID().replace(/-/g, '').replace(/\d/g, digit => String.fromCharCode(65 + Number(digit)));
  const name = { name: `StorageTest${id}`, key: `storagetest${id.toLowerCase()}` };
  const visitors = [`test-first-${id}`, `test-second-${id}`], buckets = [`test-hour-first-${id}`, `test-hour-second-${id}`];
  const pool = databasePool();
  try {
    assert.equal((await saveNameRequest(name, visitors[0], buckets[0])).duplicate, false);
    assert.equal((await saveNameRequest(name, visitors[0], buckets[0])).duplicate, true);
    assert.equal((await saveNameRequest(name, visitors[1], buckets[1])).duplicate, false);
    const saved = await listNameRequests(1, name.key);
    assert.equal(saved.total, 1);
    assert.equal(saved.requests[0].name, name.name);
    assert.equal(saved.requests[0].count, 2);
    assert.ok(saved.requests[0].firstRequestedAt instanceof Date);
  } finally {
    // Remove only the synthetic rows created by this check, never visitor data.
    await pool.query('DELETE FROM santa_name_request_submissions WHERE visitor_key=ANY($1::text[])', [visitors]);
    await pool.query('DELETE FROM santa_name_request_limits WHERE bucket_key=ANY($1::text[])', [buckets]);
    await pool.query('DELETE FROM santa_name_requests WHERE request_key=$1', [name.key]);
    await pool.end();
  }
});
