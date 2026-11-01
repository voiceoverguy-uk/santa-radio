import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createSantaNameCountHandler } from '../server/santa-name-count.js';
import { createNameLibrary } from '../server/santa-name-library.js';

async function endpoint(t, library, options = { limit: async () => {} }) {
  const server = createServer(createSantaNameCountHandler(library, options));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}/api/santa-name-count`;
}

test('anonymous aggregate projects only the number, supports HEAD and rejects lookup inputs', async t => {
  let reads = 0;
  const url = await endpoint(t, {
    count: async () => { reads++; return 9730; },
    catalogue: () => assert.fail('Handler must never access raw catalogue'),
    search: () => assert.fail('Handler must never search'),
  }, { limit: async (_req, scope) => assert.equal(scope, 'count') });
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { total: 9730 });
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(`${url}?query=arabella`)).status, 400);
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 405);
  assert.equal(reads, 2);
});

test('invalid totals and private inventory errors never become invented numbers or disclosures', async t => {
  for (const value of [-1, 1.2, '9730', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const url = await endpoint(t, { count: async () => value });
    const response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'The recorded-name total is temporarily unavailable.' });
  }
  const url = await endpoint(t, { count: async () => { throw new Error('private-origin/secret-file.mp3'); } });
  const response = await fetch(url);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-origin|secret-file|\.mp3/);
});

test('zero is a valid total and rate-limit/storage failures fail closed', async t => {
  const zero = await endpoint(t, { count: async () => 0 });
  assert.deepEqual(await (await fetch(zero)).json(), { total: 0 });
  for (const status of [429, 503]) {
    const url = await endpoint(t, { count: () => assert.fail('Must not read after limit failure') }, {
      limit: async () => { throw Object.assign(new Error('private-storage-detail'), { status, retryAfter: 20 }); },
    });
    const response = await fetch(url);
    assert.equal(response.status, status);
    if (status === 429) assert.equal(response.headers.get('retry-after'), '20');
    assert.doesNotMatch(await response.text(), /private-storage-detail/);
  }
});

test('count reuses authoritative catalogue caching, concurrent loads and failure backoff', async () => {
  let calls = 0, now = 1, failed = false;
  const library = createNameLibrary({ now: () => now, fetcher: async () => {
    calls++;
    if (failed) throw new Error('Controlled unavailable index');
    return new Response(JSON.stringify({ version: 1, names: [
      { id: 'demrie', name: 'Demrie', file: 'demrie.wav', aliases: ['Dem'] },
      { id: 'arabella', name: 'Arabella', file: 'arabella.mp3' },
    ] }));
  } });
  assert.deepEqual(await Promise.all(Array.from({ length: 15 }, () => library.count())), Array(15).fill(2));
  assert.equal(calls, 1);
  assert.equal(await library.count(), 2);
  assert.equal(calls, 1);
  now += 24 * 60 * 60_000;
  failed = true;
  await assert.rejects(library.count());
  const afterFailure = calls;
  await assert.rejects(library.count());
  assert.equal(calls, afterFailure);
  now += 24 * 60 * 60_000;
  failed = false;
  assert.equal(await library.count(), 2);
});

test('count delivery is wired for Vite, built Node and Vercel without changing private search', async () => {
  const { default: api } = await import('../api/santa-name-count.js');
  assert.equal(typeof api, 'function');
  const vite = await readFile('vite.config.js', 'utf8');
  const node = await readFile('index.js', 'utf8');
  const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal((vite.match(/use\('\/api\/santa-name-count', santaNameCount\)/g) || []).length, 2);
  assert.match(node, /pathname === '\/api\/santa-name-count'/);
  assert.ok(vercel.routes.some(route => route.handle === 'filesystem'));
  const search = await readFile('server/santa-names.js', 'utf8');
  assert.match(search, /return send\(200, \{ records, warning:/);
  assert.doesNotMatch(search, /return send\(200, \{[^}]*hostedCount/);
});
