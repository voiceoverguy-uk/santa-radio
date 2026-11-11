import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserSantaNames, matchBrowserSantaNames, resolveBrowserSantaName } from '../src/lib/browserSantaNames.js';
import { createNameSearchIndex } from '../server/santa-name-search-index.js';
import { createSantaNamesHandler } from '../server/santa-names.js';

test('list failures are retryable; concurrent checkers share one names-only download', async () => {
  globalThis.__SANTA_NAMES_ASSET_URL__ = '/names-data/test-version.json';
  await assert.rejects(loadBrowserSantaNames(async () => new Response('', { status: 503 })), /retry/i);
  await assert.rejects(loadBrowserSantaNames(async () => Response.json([{ name: 'Danny', file: 'private.wav' }])), /invalid/i);
  let requests = 0;
  const request = async url => {
    requests++;
    assert.equal(url, '/names-data/latest.json');
    return Response.json(['Danny', 'Daniel', 'Zoë', 'O’Connor']);
  };
  const [one, two] = await Promise.all([loadBrowserSantaNames(request), loadBrowserSantaNames(request)]);
  assert.equal(one, two);
  assert.equal(requests, 1);
  assert.deepEqual(matchBrowserSantaNames(one, 'da').map(record => record.name), ['Daniel', 'Danny']);
  assert.deepEqual(matchBrowserSantaNames(one, "o'").map(record => record.name), ['O’Connor']);
  assert.equal(matchBrowserSantaNames(one, 'd').length, 0);
  assert.equal(matchBrowserSantaNames(one, 'missing').length, 0);
  assert.equal(matchBrowserSantaNames(Array.from({ length: 50 }, (_, i) => ({ name: `Danny ${i}`, key: `danny ${i}` })), 'da').length, 10);
});

test('Studio resolves an exact selection only, keeping private tokens out of URLs', async () => {
  const record = { id: 'fixture', name: 'Danny', selectionToken: 'scoped',
    previewUrl: '/api/santa-name-preview?token=scoped' };
  const result = await resolveBrowserSantaName('Danny', { request: async (url, options) => {
    assert.equal(url, '/api/santa-names');
    assert.deepEqual(JSON.parse(options.body), { query: 'Danny', exact: true });
    assert.equal(options.method, 'POST');
    assert.equal(options.cache, 'no-store');
    return Response.json({ records: [record] });
  } });
  assert.deepEqual(result, [record]);
  for (const records of [[], [{ ...record, name: 'Danni' }], [{ ...record, previewUrl: 'https://origin.invalid/audio.wav' }]]) {
    await assert.rejects(resolveBrowserSantaName('Danny', { request: async () => Response.json({ records }) }), /no longer available/i);
  }
  await assert.rejects(resolveBrowserSantaName('Danny', { request: async () =>
    Response.json({ records: [record], warning: 'Incomplete list. Retry.' }) }), /Incomplete/i);
  await assert.rejects(resolveBrowserSantaName('Danny', { request: async () =>
    Response.json({ error: 'Too many attempts.' }, { status: 429 }) }), /Too many/i);
});

test('exact resolution is independent of prefix limits and preserves recording variants', () => {
  const names = [
    ...Array.from({ length: 40 }, (_, i) => ({ id: `prefix-${i}`, name: `Ann ${i}` })),
    { id: 'one', name: 'Ann', file: 'ann.wav' },
    { id: 'two', name: 'Ann', file: 'ann2.wav' },
    { id: 'other', name: 'Anna' },
  ];
  const index = createNameSearchIndex(names, []);
  assert.deepEqual(index.exact('ann').map(record => record.id), ['one', 'two']);
  assert.ok(index.exact('Ann').every(record => record.variant));
  assert.equal(index.exact('removed').length, 0);
});

test('server supports exact protected selection without enabling bulk modes or exposing paths', async () => {
  const handler = createSantaNamesHandler({
    async search(query, hint, options) {
      assert.equal(query, 'Ann');
      assert.equal(options.exact, true);
      return { records: [{ id: 'one', name: 'Ann', file: 'private.wav', variant: 'private.wav' }] };
    },
  }, { limit: async () => undefined, token: () => 'scoped.token' });
  const res = { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  const { Readable } = await import('node:stream');
  const req = Readable.from([Buffer.from(JSON.stringify({ query: 'Ann', exact: true }))]);
  Object.assign(req, { url: '/api/santa-names', method: 'POST', headers: { 'content-type': 'application/json' } });
  await handler(req, res);
  assert.equal(res.status, 200);
  assert.doesNotMatch(res.body, /private.wav/);
  assert.equal(JSON.parse(res.body).records[0].variant, 'Recording 1');
});
