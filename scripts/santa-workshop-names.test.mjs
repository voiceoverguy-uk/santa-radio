import test from 'node:test';
import assert from 'node:assert/strict';
import { createSantaNamesHandler } from '../server/santa-names.js';

async function request(library, { url = '/api/santa-names', method = 'POST', query = 'Am' } = {}) {
  const result = { headers: {} };
  await createSantaNamesHandler(library, {
    limit: async () => {}, token: (id, scope) => `test-${scope}-${id}`,
  })({
    method, url, headers: { 'content-type': 'application/json' }, body: { query },
  }, {
    setHeader(key, value) { result.headers[key] = value; },
    writeHead(status) { result.status = status; },
    end(body) { result.data = JSON.parse(body); },
  });
  return result;
}

test('workshop public bulk inventory is closed for every inventory mode', async () => {
  for (const inventory of ['hosted', '', 'all', 'local']) {
    const result = await request({ catalogue: () => assert.fail('No public inventory access') }, {
      url: `/api/santa-names?inventory=${inventory}`, method: 'GET',
    });
    assert.equal(result.status, 403);
    assert.equal(result.data.records, undefined);
    assert.match(result.headers['Cache-Control'], /private.*no-store/);
  }
});

test('workshop search preserves labels and identities, but hides exact source filenames and totals', async () => {
  const result = await request({ search: async query => {
    assert.equal(query, 'Am');
    return { records: [{ id: 'opaque-id', name: 'Amélie Rose', variant: 'Amélie Rose.mp3',
      downloadName: 'greeting.mp3', file: 'Amélie Rose.mp3' }], hostedCount: 9774 };
  } });
  assert.equal(result.status, 200);
  assert.equal(result.data.records[0].name, 'Amélie Rose');
  assert.equal(result.data.records[0].id, 'opaque-id');
  assert.equal(result.data.records[0].variant, 'Recording 1');
  assert.equal(result.data.records[0].previewUrl, '/api/santa-name-preview?token=test-preview-opaque-id');
  assert.equal(result.data.hostedCount, undefined);
  assert.equal(result.data.records[0].file, undefined);
});

test('workshop search failures are explicit', async () => {
  const result = await request({ search: async () => { throw new Error('Unavailable'); } });
  assert.equal(result.status, 503);
  assert.match(result.data.error, /temporarily unavailable/);
});
