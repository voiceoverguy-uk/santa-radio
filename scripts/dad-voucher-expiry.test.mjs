import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStudioAllowanceStore } from '../server/dad-creation-allowance.js';
import { recordDadFailure } from '../server/dad-recording-support.js';

test('Dad voucher expiry is sent to Postgres as a timestamp', async () => {
  const expiresAt = Date.now() + 60_000;
  const identity = { key: 'test-voucher', expiresAt };
  const written = [];
  const client = {
    async query(sql, parameters) {
      if (sql.includes('INSERT INTO')) written.push(parameters[1]);
      return { rows: [{ operations: [], pending: false }] };
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async query(sql, parameters) {
      assert.match(sql, /INSERT INTO public.santa_dad_recording_support/);
      written.push(parameters[3]);
      return { rows: [{ reference: 'sample', failed_attempts: 1 }] };
    },
  };

  await createStudioAllowanceStore(pool).reserve(identity, 'operation');
  await recordDadFailure(identity, 'sample', { stage: 'render' }, pool);
  assert.deepEqual(written, [new Date(expiresAt), new Date(expiresAt)]);
});
