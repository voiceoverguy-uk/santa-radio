import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRequestedName, nameRequestConfirmation } from '../src/lib/santaNameRequests.js';
import { approvedAdmin, createNameRequestHandler } from '../server/name-requests.js';

test('name validation preserves legitimate names and refuses markup and personal-data fields', () => {
  assert.deepEqual(normaliseRequestedName('  Mary   Jane '), { name: 'Mary Jane', key: 'mary jane' });
  assert.deepEqual(normaliseRequestedName('D’Arcy'), { name: "D'Arcy", key: "d'arcy" });
  assert.equal(normaliseRequestedName('Émile').key, 'émile');
  for (const name of [null, {}, '', '  ', '<script>alert</script>', 'name@example.com', 'a'.repeat(81), '1980-12-01']) assert.equal(normaliseRequestedName(name), null);
});
test('London seasonal confirmations change on December 1 and reset in January', () => {
  for (const date of ['2026-01-01T00:00:00Z', '2026-11-30T23:59:59Z']) assert.match(nameRequestConfirmation(new Date(date)), /in a week/);
  for (const date of ['2026-12-01T00:00:00Z', '2026-12-31T23:59:59Z']) assert.match(nameRequestConfirmation(new Date(date)), /in a couple of days/);
  assert.match(nameRequestConfirmation(new Date('2027-01-01T00:00:00Z')), /in a week/);
  assert.match(nameRequestConfirmation(new Date('2026-10-01T00:00:00Z')), /to see if Santa has added it/);
});
test('admin authorization requires exactly the verified primary owner address regardless of env allowlists', () => {
  const user = { primaryEmailAddressId: 'email-1', emailAddresses: [{ id: 'email-1', emailAddress: 'ADMIN@SANTARADIO.CO.UK', verification: { status: 'verified' } }] };
  assert.equal(approvedAdmin(user), true);
  assert.equal(approvedAdmin({}), false);
  user.emailAddresses[0].verification.status = 'unverified';
  assert.equal(approvedAdmin(user), false);
  user.emailAddresses[0].verification.status = 'verified';
  user.primaryEmailAddressId = 'unrelated';
  assert.equal(approvedAdmin(user), false);
  user.primaryEmailAddressId = 'email-1';
  user.emailAddresses[0].emailAddress = 'other@example.test';
  assert.equal(approvedAdmin(user, 'other@example.test'), false);
});
function response() {
  return { code: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
}
test('unauthenticated and unapproved users never reach the database listing', async () => {
  for (const status of [401, 403]) {
    let reads = 0;
    const handler = createNameRequestHandler({ checkAdmin: async () => status, list: async () => { reads++; } });
    const res = response();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.code, status); assert.equal(reads, 0);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});
test('only approved admins can paginate and search real request records', async () => {
  let query;
  const handler = createNameRequestHandler({ checkAdmin: async () => 200, list: async (page, q) => {
    query = { page, q }; return { requests: [{ name: 'Example', count: 3 }], total: 1, page };
  } });
  const res = response();
  await handler({ method: 'GET', url: '/api/name-requests?page=2&q=EXAMPLE', headers: {} }, res);
  assert.deepEqual(query, { page: 2, q: 'example' }); assert.equal(res.body.requests[0].count, 3);
});
test('public submission saves only the validated name and confirms only after storage', async () => {
  let captured;
  const handler = createNameRequestHandler({ identify: () => ({ visitorKey: 'anonymous', bucketKey: 'hour' }),
    save: async (...args) => { captured = args; return { duplicate: false }; } });
  const res = response();
  await handler({ method: 'POST', headers: { host: 'site.example' }, body: { name: 'Mary Jane', email: 'ignored@example.test', dob: 'ignored' } }, res);
  assert.deepEqual(captured, [{ name: 'Mary Jane', key: 'mary jane' }, 'anonymous', 'hour']);
  assert.match(res.body.message, /request has been saved/);
  assert.equal(res.body.email, undefined);
});
test('invalid names and cross-origin submissions cannot create records', async () => {
  let writes = 0;
  const handler = createNameRequestHandler({ save: async () => { writes++; } });
  for (const req of [
    { method: 'POST', headers: {}, body: { name: '<script>' } },
    { method: 'POST', headers: { host: 'site.example', origin: 'https://evil.example' }, body: { name: 'Example' } },
  ]) { const res = response(); await handler(req, res); assert.ok([400, 403].includes(res.code)); }
  assert.equal(writes, 0);
});
test('rate limiting provides retry timing instead of a false saved confirmation', async () => {
  const handler = createNameRequestHandler({ identify: () => ({}), save: async () => { throw Object.assign(new Error('Please wait.'), { status: 429, retryAfter: 60 }); } });
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { name: 'Example' } }, res);
  assert.equal(res.code, 429); assert.equal(res.headers['Retry-After'], '60'); assert.equal(res.body.message, undefined);
});
