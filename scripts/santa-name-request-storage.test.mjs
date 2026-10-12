import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databasePool, saveNameRequest, listNameRequests, recordNameRequest } from '../server/name-request-store.js';

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
    const marked = await Promise.all([recordNameRequest(name.key), recordNameRequest(name.key)]);
    assert.equal(marked.filter(value => !value.duplicate).length, 1);
    assert.equal((await listNameRequests(1, name.key)).total, 0);
    let history = await listNameRequests(1, name.key, 'completed');
    assert.equal(history.total, 1); assert.equal(history.requests[0].count, 2);
    assert.deepEqual(history.requests[0].firstRequestedAt, saved.requests[0].firstRequestedAt);
    assert.deepEqual(history.requests[0].lastRequestedAt, saved.requests[0].lastRequestedAt);
    // An old visitor's duplicate retry cannot reopen a recorded name.
    assert.equal((await saveNameRequest(name, visitors[0], buckets[0])).duplicate, true);
    assert.equal((await listNameRequests(1, name.key)).total, 0);
    // Simulate a lost first response, with a new cookie but the same request token.
    const requestWithToken = { ...name, submissionKey: `test-token-${id}` };
    const race = await Promise.all([
      saveNameRequest(requestWithToken, `test-third-${id}`, buckets[0]),
      saveNameRequest(requestWithToken, `test-fourth-${id}`, buckets[1]),
    ]);
    assert.equal(race.filter(value => !value.duplicate).length, 1);
    assert.equal((await listNameRequests(1, name.key)).requests[0].count, 3);
    assert.equal((await listNameRequests(1, name.key, 'completed')).requests[0].count, 2);
    await recordNameRequest(name.key);
    history = await listNameRequests(1, name.key, 'completed', true);
    assert.equal(history.total, 2);
    assert.equal(history.requests[0].count, 3);
    assert.equal(history.requests[1].count, 2);
    // A genuinely failed transaction leaves neither a dedupe alias nor a count.
    const invalid = { name: null, key: `failed-${id}` };
    await assert.rejects(saveNameRequest(invalid, `failed-${id}`, `failed-bucket-${id}`));
    assert.equal((await pool.query('SELECT count(*) AS n FROM santa_name_request_submissions WHERE request_key=$1', [invalid.key])).rows[0].n, '0');
  } finally {
    // Remove only the synthetic rows created by this check, never visitor data.
    await pool.query('DELETE FROM santa_name_request_submissions WHERE request_key=$1', [name.key]);
    await pool.query('DELETE FROM santa_name_request_limits WHERE bucket_key=ANY($1::text[])', [buckets]);
    await pool.query('DELETE FROM santa_name_request_history WHERE request_key=$1', [name.key]);
    await pool.query('DELETE FROM santa_name_requests WHERE request_key=$1', [name.key]);
    await pool.end();
  }
});
