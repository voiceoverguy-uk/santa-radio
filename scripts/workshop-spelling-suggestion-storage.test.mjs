import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databasePool, saveNameRequest, listNameRequests, recordNameRequest } from '../server/name-request-store.js';

test('real database groups recording pairs, deduplicates retries and preserves completed snapshots', async () => {
  const prefix = `suggestiontest${randomUUID().replace(/-/g, '')}`;
  const pool = databasePool();
  const source = { id: 'fixture-kelley', name: 'Kelley', file: 'kelley3.wav' };
  const name = { name: 'Kellllie', key: prefix, sourceRecording: source, submissionKey: `${prefix}-token` };
  const visitor = `${prefix}-visitor`, bucket = `${prefix}-bucket`;
  try {
    // An earlier ordinary name request must not silently suppress the pairing.
    assert.equal((await saveNameRequest({ name: name.name, key: prefix }, visitor, bucket)).duplicate, false);
    assert.equal((await saveNameRequest(name, visitor, bucket)).duplicate, false);
    assert.equal((await saveNameRequest(name, visitor, bucket)).duplicate, true);
    const race = await Promise.all([
      saveNameRequest(name, `${prefix}-lost-cookie-one`, bucket),
      saveNameRequest(name, `${prefix}-lost-cookie-two`, bucket),
    ]);
    assert.equal(race.every(result => result.duplicate), true);
    await saveNameRequest({ ...name, submissionKey: `${prefix}-token-two` }, `${prefix}-second-visitor`, bucket);
    const saved = (await listNameRequests(1, prefix)).requests[0];
    assert.equal(saved.count, 3);
    assert.deepEqual(saved.recordingSuggestions, [{ ...source, count: 2 }]);
    await recordNameRequest(prefix);
    assert.deepEqual((await listNameRequests(1, prefix, 'completed')).requests[0].recordingSuggestions, saved.recordingSuggestions);
    // Different source for the same requested spelling is a separately counted pair.
    const other = { id: 'fixture-kelly', name: 'Kelly', file: 'kelly.mp3' };
    await saveNameRequest({ ...name, sourceRecording: other, submissionKey: `${prefix}-third-token` }, visitor, bucket);
    const reopened = (await listNameRequests(1, prefix)).requests[0];
    assert.equal(reopened.count, 4); assert.equal(reopened.recordingSuggestions.length, 2);
    assert.equal((await listNameRequests(1, prefix, 'completed')).requests[0].recordingSuggestions.length, 1);
    await recordNameRequest(prefix);
    assert.equal((await listNameRequests(1, prefix, 'completed')).total, 2);
  } finally {
    await pool.query('DELETE FROM santa_name_recording_suggestions WHERE request_key=$1', [prefix]);
    await pool.query('DELETE FROM santa_name_request_submissions WHERE strpos(request_key,$1)=1', [prefix]);
    await pool.query('DELETE FROM santa_name_request_limits WHERE bucket_key=$1', [bucket]);
    await pool.query('DELETE FROM santa_name_request_history WHERE request_key=$1', [prefix]);
    await pool.query('DELETE FROM santa_name_requests WHERE request_key=$1', [prefix]);
    await pool.end();
  }
});
