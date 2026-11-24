import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUkDate, formatUkDateTime, formatUtcDateTime } from '../src/lib/ukDates.js';

test('report dates keep their original calendar day and are zero-padded', () => {
  assert.equal(formatUkDate('2026-11-24'), '24/11/2026');
  assert.equal(formatUkDate('2028-02-29'), '29/02/2028');
  assert.equal(formatUkDate('2027-01-02'), '02/01/2027');
  assert.equal(formatUkDate(null), '');
  assert.equal(formatUkDateTime('invalid'), '');
});

test('London deadlines use British Summer Time and the tracker keeps UTC', () => {
  const instant = '2026-07-01T23:30:00Z';
  assert.equal(formatUkDate(instant), '02/07/2026');
  assert.equal(formatUkDateTime(instant), '02/07/2026, 00:30');
  assert.equal(formatUtcDateTime(instant), '01/07/2026, 23:30:00');
  assert.equal(formatUkDateTime('2026-12-01T00:00:00Z'), '01/12/2026, 00:00');
});
