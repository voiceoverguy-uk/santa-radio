import test from 'node:test';
import assert from 'node:assert/strict';
import { createSantaNamesHandler } from '../server/santa-names.js';

async function request(library, url = '/api/santa-names?inventory=hosted') {
  const result = { headers: {} };
  const response = {
    setHeader(key, value) { result.headers[key] = value; },
    writeHead(status) { result.status = status; },
    end(body) { result.data = JSON.parse(body); },
  };
  await createSantaNamesHandler(library)({ method: 'GET', url }, response);
  return result;
}

test('workshop inventory exposes every hosted name without local fallback or recipient queries', async () => {
  const hosted = Array.from({ length: 35 }, (_, index) => ({
    id: `record-${index}`, name: `Name ${index}`, file: `name-${index}.wav`,
    source: 'hosted', aliases: [], downloadName: 'unused',
  }));
  hosted.push({ id: 'variant-1', name: 'Dixie', file: 'dixie.wav' },
    { id: 'variant-2', name: 'Dixie', file: 'dixie3.wav' });
  const result = await request({
    catalogue: async () => hosted,
    search: () => { throw new Error('Workshop must not run recipient searches'); },
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.data.hostedCount, 37);
  assert.equal(result.data.records.length, 37, 'Do not apply the existing 20 search-result limit');
  assert.deepEqual(result.data.records.filter(row => row.name === 'Dixie'), [
    { id: 'variant-1', name: 'Dixie', previewUrl: 'https://stagcommunications.com/santaradio/names/dixie.wav', variant: 'dixie.wav' },
    { id: 'variant-2', name: 'Dixie', previewUrl: 'https://stagcommunications.com/santaradio/names/dixie3.wav', variant: 'dixie3.wav' },
  ]);
  assert.equal(result.data.warning, null);
  assert.ok(result.data.records.every(row => !('source' in row) && !('downloadName' in row)));
});

test('hosted inventory failure is explicit rather than substituting bundled examples', async () => {
  const result = await request({ catalogue: async () => { throw new Error('unavailable'); } });
  assert.equal(result.status, 503);
  assert.match(result.data.error, /hosted name list is unavailable/);
  assert.equal(result.data.records, undefined);
});

test('recorded preview URLs retain exact filenames, Unicode and extensions rather than using names or IDs', async () => {
  const result = await request({ catalogue: async () => [
    { id: 'unrelated-id', name: 'Different display name', file: 'Amélie Rose.mp3' },
  ] });
  assert.equal(result.data.records[0].previewUrl, 'https://stagcommunications.com/santaradio/names/Am%C3%A9lie%20Rose.mp3');
  assert.equal(result.data.records[0].id, 'unrelated-id');
});

test('existing maker search response and arguments stay unchanged', async () => {
  const data = { records: [{ id: 'test', name: 'Test', downloadName: 'test.mp3' }], warning: null, hostedCount: 1 };
  const result = await request({
    search: async query => { assert.equal(query, 'Test'); return data; },
    catalogue: () => { throw new Error('Legacy search must remain unchanged'); },
  }, '/api/santa-names?q=Test');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, data);
});
