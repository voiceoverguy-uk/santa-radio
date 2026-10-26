import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { trySavedSantaGreeting } from '../src/lib/savedSantaGreeting.js';
import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';
import { recipeFiles, santaAudioRecipeVersion } from './santa-audio-recipe.mjs';
import { createSavedGreetingCache } from '../server/santa-saved-cache.js';

const bytes = Buffer.from('test-only pinned MP3 bytes');
const pilot = {
  ...savedSantaGreeting, bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const options = {
  pilot, recipeVersion: pilot.recipeVersion,
  fetcher: async () => new Response(bytes, { headers: { 'content-type': 'audio/mpeg' } }),
};
const withLookup = fetcher => async (url, init) => String(url).startsWith('/api/santa-greeting?')
  ? Response.json({ available: true, greeting: pilot }) : fetcher(url, init);
const record = { id: 'arabella' };

test('approved saved bytes return unchanged; both exact recording-ID formats work', async () => {
  for (const id of pilot.recordingIds) {
    let calls = 0;
    const blob = await trySavedSantaGreeting({ id }, null, { ...options, fetcher: withLookup(async (url, init) => {
      calls++;
      assert.equal(new URL(url).searchParams.get('recipe'), pilot.recipeVersion);
      assert.equal(init.mode, 'cors');
      assert.equal(init.credentials, 'omit');
      return options.fetcher();
    }) });
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
    assert.equal(calls, 1);
  }
});

test('disabled pilot, other names/variants and unavailable crypto never fetch', async () => {
  let calls = 0;
  const fetcher = () => { calls++; throw new Error('Unexpected saved-file lookup'); };
  for (const [selected, overrides] of [
    [record, { pilot: { ...pilot, enabled: false } }],
    [{ id: 'erin' }, {}], [{ id: 'arabella2' }, {}],
    [record, { cryptoImpl: {} }],
  ]) {
    assert.equal(await trySavedSantaGreeting(selected, null, { ...options, ...overrides, fetcher }), null);
  }
  assert.equal(calls, 0);
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
    assert.equal(await trySavedSantaGreeting(record, null, { ...options, fetcher: withLookup(fetcher) }), null);
  }
});

test('stalled body times out promptly; user cancellation is not treated as a miss', async () => {
  const fetcher = async (_, { signal }) => new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
    },
  }), { headers: { 'content-type': 'audio/mpeg' } });
  const start = Date.now();
  assert.equal(await trySavedSantaGreeting(record, null, { ...options, fetcher: withLookup(fetcher), timeoutMs: 20 }), null);
  assert.ok(Date.now() - start < 1000);
  const controller = new AbortController();
  const request = trySavedSantaGreeting(record, controller.signal, { ...options, fetcher: withLookup(fetcher) });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('old manual approval cannot bypass the new intro and timing recipe; every ingredient invalidates it', () => {
  assert.notEqual(santaAudioRecipeVersion(), savedSantaGreeting.recipeVersion);
  assert.notEqual(santaAudioRecipeVersion(undefined, undefined, 1),
    santaAudioRecipeVersion(undefined, undefined, 2), 'Outro variants must not share a cache key.');
  const baseline = santaAudioRecipeVersion(path => Buffer.from(path));
  for (const changed of recipeFiles) {
    assert.notEqual(santaAudioRecipeVersion(path => Buffer.from(path + (path === changed ? 'changed' : ''))), baseline);
  }
});

test('old remote manifests and the old manual Arabella file are misses with the current recipe', async () => {
  let calls = 0;
  const cache = createSavedGreetingCache({
    fetcher: async () => {
      calls++;
      return Response.json({ schema: 1, recipeVersion: savedSantaGreeting.recipeVersion,
        nameSha256: savedSantaGreeting.nameSha256 });
    },
    publisher: async () => assert.fail('Invalidation checks must never publish'),
    log: () => {},
  });
  const library = { sourceBytes: async () => bytes };
  assert.equal(await cache.lookup({ id: 'arabella', source: 'hosted', file: 'arabella.mp3' }, library), null);
  assert.equal(calls, 1);
});
