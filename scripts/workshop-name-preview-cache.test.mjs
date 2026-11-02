import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopNamePreviewCache } from '../src/lib/workshopNamePreviewCache.js';

const record = { id: 'recording-1', name: 'Danny' };
function fixture({ audio } = {}) {
  const requests = [], created = [], revoked = [];
  const cache = createWorkshopNamePreviewCache({
    request: async (url, options) => {
      requests.push({ url, options });
      if (url === '/api/santa-names') {
        return Response.json({ records: [
          { ...record, previewUrl: '/api/santa-name-preview?token=fresh' },
          { id: 'recording-2', name: 'Danny', previewUrl: '/api/santa-name-preview?token=variant' },
        ] });
      }
      return audio ? audio() : new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    },
    createUrl: blob => { created.push(blob); return `blob:preview-${created.length}`; },
    revokeUrl: url => revoked.push(url),
  });
  return { cache, requests, created, revoked };
}

test('repeat playback uses one private lookup and one audio download', async () => {
  const { cache, requests, created } = fixture();
  assert.equal(cache.peek(), null);
  const url = await cache.load(record);
  assert.equal(cache.peek(record.id), url);
  assert.equal(await cache.load(record), url);
  assert.equal(requests.length, 2);
  assert.equal(created.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[1].options.cache, 'no-store');
  assert.equal(requests[1].options.redirect, 'error');
});

test('changing the recording identity revokes the old clip, even with the same spelling', async () => {
  const { cache, requests, revoked } = fixture();
  const first = await cache.load(record);
  const variant = { id: 'recording-2', name: 'Danny' };
  const second = await cache.load(variant);
  assert.notEqual(first, second);
  assert.deepEqual(revoked, [first]);
  assert.equal(cache.peek(record.id), null);
  assert.match(requests[3].url, /token=variant$/);
  cache.clear();
  cache.clear();
  assert.deepEqual(revoked, [first, second]);
  assert.equal(cache.peek(variant.id), null);
});

test('failed, empty and non-audio responses are not cached', async () => {
  for (const audio of [
    () => new Response('Unavailable', { status: 503 }),
    () => new Response('<html>Not audio</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('', { headers: { 'Content-Type': 'audio/mpeg' } }),
    () => new Response('x', { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(11 * 1024 * 1024) } }),
  ]) {
    const { cache, created } = fixture({ audio });
    await assert.rejects(cache.load(record));
    assert.equal(cache.peek(record.id), null);
    assert.equal(created.length, 0);
  }
});

test('stopping or leaving during download cannot recreate a discarded cache', async () => {
  for (const cancel of ['abort', 'clear']) {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const { cache, created } = fixture({ audio: async () => {
      await pending;
      return new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
    } });
    const controller = new AbortController();
    const loading = cache.load(record, { signal: controller.signal });
    // Let the lookup finish and the audio request start.
    await new Promise(resolve => setImmediate(resolve));
    if (cancel === 'abort') controller.abort();
    else cache.clear();
    release();
    await assert.rejects(loading, { name: 'AbortError' });
    assert.equal(created.length, 0);
    assert.equal(cache.peek(record.id), null);
  }
});
