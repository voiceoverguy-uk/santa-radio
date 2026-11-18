import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameRequestsOpen } from '../src/lib/nameRequestSeason.js';
import { createNameRequestHandler } from '../server/name-requests.js';

test('requests open November 1 and close Christmas Day at UK midnight every year', () => {
  for (const year of [2026, 2027, 2028]) {
    for (const [date, open] of [
      [`${year}-10-31T23:59:59Z`, false],
      [`${year}-11-01T00:00:00Z`, true],
      [`${year}-12-24T23:59:59Z`, true],
      [`${year}-12-25T00:00:00Z`, false],
      [`${year}-01-01T12:00:00Z`, false],
      [`${year}-07-01T12:00:00Z`, false],
    ]) assert.equal(nameRequestsOpen(new Date(date)), open, date);
  }
});

test('closed season refuses submissions before storage or request limits are touched', async () => {
  const unexpected = () => { throw new Error('Should not reach storage or limits'); };
  const handler = createNameRequestHandler({ now: () => new Date('2026-12-25T00:00:00Z'), save: unexpected, limit: unexpected });
  const res = { set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', headers: {}, body: { name: 'Example' } }, res);
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'NAME_REQUESTS_CLOSED');
});
