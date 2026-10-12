import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNameRequestHandler } from '../server/name-requests.js';
import { databasePool, listNameRequests } from '../server/name-request-store.js';
import { randomUUID } from 'node:crypto';

const response = () => ({ code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; },
  status(v) { this.code = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } });

test('every private operation refuses anonymous and unapproved access without reading or writing', async () => {
  for (const allowed of [401, 403]) for (const req of [
    { method: 'GET', url: '/api/name-requests?download=txt&status=completed' },
    { method: 'PATCH', body: { action: 'recorded', name: 'Replit' } },
  ]) {
    let touched = false;
    const handler = createNameRequestHandler({ checkAdmin: async () => allowed,
      list: async () => { touched = true; }, record: async () => { touched = true; } });
    const res = response(); await handler({ ...req, headers: {} }, res);
    assert.equal(res.code, allowed); assert.equal(touched, false);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.headers['X-Robots-Tag'], 'noindex, nofollow');
  }
});
test('private Recorded is authorized, same-origin and confirms only after successful storage', async () => {
  let writes = 0;
  const handler = createNameRequestHandler({ checkAdmin: async () => 200,
    record: async key => { writes++; assert.equal(key, 'éranes'); return { recorded: true }; } });
  let res = response();
  await handler({ method: 'PATCH', headers: { origin: 'https://evil.test', host: 'site.test' },
    body: { name: 'Éranes', action: 'recorded' } }, res);
  assert.equal(res.code, 403); assert.equal(writes, 0);
  res = response();
  await handler({ method: 'PATCH', headers: { origin: 'https://site.test', host: 'site.test' },
    body: { name: 'Éranes', action: 'recorded' } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.recorded, true); assert.equal(writes, 1);
});
test('a failed save stays 503, logs only safe stage/code and can be retried', async () => {
  const original = console.error, logs = [];
  console.error = (...values) => logs.push(values);
  try {
    let attempts = 0;
    const handler = createNameRequestHandler({ identify: () => ({}),
      save: async () => { if (++attempts === 1) throw Object.assign(new Error('private detail'), { code: '42P01' }); return { duplicate: false }; } });
    let res = response(); const req = { method: 'POST', headers: {}, body: { name: 'Eranes' } };
    await handler(req, res);
    assert.equal(res.code, 503); assert.equal(res.body.saved, undefined);
    assert.deepEqual(logs[0], ['Name request service unavailable', { stage: 'save', code: '42P01' }]);
    res = response(); await handler(req, res);
    assert.equal(res.body.saved, true);
  } finally { console.error = original; }
});
test('full real database export exceeds one page and preserves Unicode, ordering and dates', async () => {
  const prefix = 'exporttest' + randomUUID().replace(/-/g, '');
  const pool = databasePool();
  try {
    await pool.query(`INSERT INTO santa_name_requests(request_key,name,request_count,first_requested_at,last_requested_at)
      SELECT $1 || i::text, CASE WHEN i=103 THEN 'Émile' ELSE 'Example' || i::text END,
      i,now(),now() FROM generate_series(1,103) i`, [prefix]);
    const first = await listNameRequests(1, prefix);
    assert.equal(first.total, 103); assert.equal(first.requests.length, 100);
    assert.equal(first.requests[0].count, 103);
    const handler = createNameRequestHandler({ checkAdmin: async () => 200 });
    const res = response();
    await handler({ method: 'GET', url: `/api/name-requests?download=txt&q=${prefix}`, headers: {} }, res);
    assert.equal(res.code, 200); assert.match(res.headers['Content-Disposition'], /outstanding\.txt/);
    assert.match(res.body, /Émile\t103\t\d{4}-/);
    assert.equal(res.body.trim().split('\r\n').length, 104);
    const invalid = response();
    await handler({ method: 'GET', url: '/api/name-requests?status=invalid', headers: {} }, invalid);
    assert.equal(invalid.code, 400);
  } finally {
    await pool.query('DELETE FROM santa_name_requests WHERE strpos(request_key,$1)=1', [prefix]);
    await pool.end();
  }
});
