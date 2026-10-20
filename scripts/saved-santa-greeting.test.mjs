import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { trySavedSantaGreeting } from '../src/lib/savedSantaGreeting.js';
import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';
import { recipeFiles, santaAudioRecipeVersion } from './santa-audio-recipe.mjs';

const bytes = Buffer.from('test-only pinned MP3 bytes');
const pilot = {
  ...savedSantaGreeting, bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const options = {
  pilot, recipeVersion: pilot.recipeVersion,
  fetcher: async () => new Response(bytes, { headers: { 'content-type': 'audio/mpeg' } }),
};
const record = { id: 'arabella' };

test('approved saved bytes return unchanged; both exact recording-ID formats work', async () => {
  for (const id of pilot.recordingIds) {
    let calls = 0;
    const blob = await trySavedSantaGreeting({ id }, null, { ...options, fetcher: async (url, init) => {
      calls++;
      assert.equal(new URL(url).searchParams.get('recipe'), pilot.recipeVersion);
      assert.equal(init.mode, 'cors');
      assert.equal(init.credentials, 'omit');
      return options.fetcher();
    } });
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
    assert.equal(calls, 1);
  }
});

test('disabled pilot, changed recipe, other names/variants and unavailable crypto never fetch', async () => {
  const fetcher = () => { throw new Error('Unexpected saved-file lookup'); };
  for (const [selected, overrides] of [
    [record, { pilot: { ...pilot, enabled: false } }],
    [record, { recipeVersion: 'changed' }],
    [{ id: 'erin' }, {}], [{ id: 'arabella2' }, {}],
    [record, { cryptoImpl: {} }],
  ]) {
    assert.equal(await trySavedSantaGreeting(selected, null, { ...options, ...overrides, fetcher }), null);
  }
});

test('missing, invalid, truncated, oversized, changed or cross-origin-blocked files are misses', async () => {
  const responses = [
    () => new Response('', { status: 404 }),
    () => new Response(bytes, { headers: { 'content-type': 'text/html' } }),
    () => new Response(bytes, { status: 206, headers: { 'content-type': 'audio/mpeg' } }),
    () => new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'content-length': '9999' } }),
    () => new Response(bytes.subarray(1), { headers: { 'content-type': 'audio/mpeg' } }),
    () => new Response(Buffer.concat([bytes, bytes]), { headers: { 'content-type': 'audio/mpeg' } }),
    () => new Response(Buffer.alloc(bytes.length), { headers: { 'content-type': 'audio/mpeg' } }),
    () => { throw new TypeError('Failed to fetch'); },
  ];
  for (const fetcher of responses) {
    assert.equal(await trySavedSantaGreeting(record, null, { ...options, fetcher }), null);
  }
});

test('stalled body times out promptly; user cancellation is not treated as a miss', async () => {
  const fetcher = async (_, { signal }) => new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
    },
  }), { headers: { 'content-type': 'audio/mpeg' } });
  const start = Date.now();
  assert.equal(await trySavedSantaGreeting(record, null, { ...options, fetcher, timeoutMs: 20 }), null);
  assert.ok(Date.now() - start < 1000);
  const controller = new AbortController();
  const request = trySavedSantaGreeting(record, controller.signal, { ...options, fetcher });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('approval matches current recipe; each tracked ingredient/implementation change invalidates it', () => {
  assert.equal(santaAudioRecipeVersion(), savedSantaGreeting.recipeVersion);
  const baseline = santaAudioRecipeVersion(path => Buffer.from(path));
  for (const changed of recipeFiles) {
    assert.notEqual(santaAudioRecipeVersion(path => Buffer.from(path + (path === changed ? 'changed' : ''))), baseline);
  }
});
