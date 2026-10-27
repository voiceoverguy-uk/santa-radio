import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNameRequestHandler } from '../server/name-requests.js';

const response = () => ({ code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; },
  status(v) { this.code = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } });
const recording = { id: 'kelley', name: 'Kelley', file: 'kelley3.wav', source: 'hosted' };
const request = body => ({ method: 'POST', headers: { host: 'site.test', origin: 'https://site.test' }, body });
const body = { name: 'Kellllie', recordingId: 'kelley', requestId: '12345678-1234-4123-8123-123456789abc' };
const defaults = {
  identify: () => ({ visitorKey: 'visitor', bucketKey: 'bucket' }),
  library: { catalogue: async () => [recording] },
};

test('optional suggestion validates hosted identity and saves canonical source, not client labels or other choices', async () => {
  const old = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET ||= 'synthetic-unit-test-key';
  try {
    let saved;
    const handler = createNameRequestHandler({ ...defaults, save: async name => { saved = name; return { duplicate: false }; } });
    const res = response();
    await handler(request({ ...body, recordedName: 'Spoofed', file: '../../elsewhere', age: 8, email: 'not-saved@example.test' }), res);
    assert.equal(res.code, 200); assert.equal(res.body.saved, true);
    assert.deepEqual(saved.sourceRecording, { id: 'kelley', name: 'Kelley', file: 'kelley3.wav' });
    assert.equal(saved.name, 'Kellllie');
    assert.equal(saved.age, undefined); assert.equal(saved.email, undefined);
    assert.match(res.body.message, /private list for review/);
  } finally {
    if (old === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old;
  }
});

test('invalid, unchanged, unknown and local-only identities cannot save a suggestion', async () => {
  let writes = 0;
  const handler = createNameRequestHandler({ ...defaults, save: async () => { writes++; } });
  for (const data of [
    { ...body, recordingId: '../../secret' }, { ...body, recordingId: 'missing' },
    { ...body, requestId: undefined }, { ...body, name: 'Kelley' }, { ...body, name: '<script>' },
  ]) {
    const res = response(); await handler(request(data), res); assert.equal(res.code, 400);
  }
  const localHandler = createNameRequestHandler({ ...defaults,
    library: { catalogue: async () => [{ ...recording, source: 'local' }] }, save: async () => { writes++; } });
  const local = response(); await localHandler(request(body), local); assert.equal(local.code, 400);
  const crossSite = response();
  await handler({ ...request(body), headers: { origin: 'https://other.test', host: 'site.test' } }, crossSite);
  assert.equal(crossSite.code, 403); assert.equal(writes, 0);
});

test('hosted-list errors fail honestly before database save and log no name', async () => {
  const original = console.error, logs = [];
  console.error = (...values) => logs.push(values);
  try {
    let writes = 0;
    const handler = createNameRequestHandler({ ...defaults,
      library: { catalogue: async () => { throw new Error('private upstream details'); } }, save: async () => { writes++; } });
    const res = response(); await handler(request(body), res);
    assert.equal(res.code, 503); assert.equal(res.body.saved, undefined); assert.equal(writes, 0);
    assert.equal(JSON.stringify(logs).includes('Kellllie'), false);
    assert.equal(JSON.stringify(logs).includes('private upstream'), false);
  } finally { console.error = original; }
});

test('staff TXT export includes the exact source recording and count', async () => {
  const handler = createNameRequestHandler({ checkAdmin: async () => 200,
    list: async () => ({ requests: [{ name: 'Kellllie', count: 2,
      firstRequestedAt: '2026-10-26', lastRequestedAt: '2026-10-26',
      recordingSuggestions: [{ ...recording, count: 2 }] }] }) });
  const res = response(); await handler({ method: 'GET', headers: {}, url: '/api/name-requests?download=txt' }, res);
  assert.equal(res.code, 200);
  assert.match(res.body, /Kelley \[kelley3\.wav; kelley\] \(2\)/);
});
