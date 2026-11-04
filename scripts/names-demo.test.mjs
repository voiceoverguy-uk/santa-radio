import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { createDemoSearch, snapshotUrl, validateSnapshot } from '../server/names-demo/snapshot.js';
import { createNamesDemoHandler, namesDemoMiddleware } from '../server/names-demo/handler.js';
import { updateDemoSnapshot } from './import-names-demo.mjs';

function response() {
  return { headers: {}, status: null, body: '',
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    writeHead(status, headers = {}) { this.status = status; for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); return this; },
    end(body = '') { this.body = body; return this; } };
}
async function request(handler, { method = 'POST', url = '/api/names-demo', body = { query: 'da' } } = {}) {
  const req = Readable.from([JSON.stringify(body)]);
  Object.assign(req, { method, url, headers: { 'content-type': 'application/json' } });
  const res = response();
  await handler(req, res);
  return res;
}

test('real imported snapshot is validated, deduplicated and contains no original source metadata', async () => {
  const data = JSON.parse(await readFile(snapshotUrl, 'utf8'));
  const names = validateSnapshot(data);
  assert.ok(names.length > 9000);
  assert.deepEqual(Object.keys(data).sort(), ['importedAt', 'names', 'version']);
  assert.doesNotMatch(JSON.stringify(data), /https?:|\.wav|\.mp3|stagcommunications|names-index/i);
});

test('first, repeat and fresh-process searches work with ALL fetches forbidden and no origin configuration', async () => {
  const child = `
    let originCalls = 0;
    globalThis.fetch = () => { originCalls++; throw new Error('Stag unavailable'); };
    delete process.env.SANTA_LIBRARY_GATEWAY_URL;
    delete process.env.SANTA_LIBRARY_READ_TOKEN;
    const { createDemoSearch } = await import('./server/names-demo/snapshot.js');
    const search = createDemoSearch();
    const t = performance.now(); const first = await search('da'); const coldMs = performance.now() - t;
    const timings = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now(); await search(['da','an','ma','jo'][i%4]); timings.push(performance.now()-start);
    }
    timings.sort((a,b)=>a-b);
    console.log(JSON.stringify({originCalls,count:first.length,coldMs,warmP50Ms:timings[500],warmP95Ms:timings[950]}));
  `;
  for (let i = 0; i < 2; i++) {
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', child], { encoding: 'utf8' }));
    assert.equal(result.originCalls, 0);
    assert.ok(result.count > 0 && result.count <= 10);
    console.log('Fresh-instance measured snapshot search:', result);
  }
});

test('bounded private POST API reuses limiter, discloses names only and has no bulk/URL modes', async () => {
  let limits = 0;
  const handler = createNamesDemoHandler({ limit: async (_req, scope) => { assert.equal(scope, 'search'); limits++; } });
  for (const query of ['da', 'dan', 'ma']) {
    const res = await request(handler, { body: { query } });
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.deepEqual(Object.keys(data), ['names']);
    assert.ok(data.names.length > 0 && data.names.length <= 10);
    assert.equal(res.headers['cache-control'], 'private, no-store, max-age=0');
    assert.match(res.headers['server-timing'], /^snapshot-search;dur=/);
    assert.doesNotMatch(res.body, /file|source|http|token|previewUrl/);
  }
  assert.equal(limits, 3);
  for (const query of ['', 'a', 'a ', 'a-', '*', '%%', 'ab*', 'a'.repeat(81)]) {
    assert.equal((await request(handler, { body: { query } })).status, 400);
  }
  assert.equal((await request(handler, { body: { query: 'da', all: true } })).status, 400);
  assert.equal((await request(handler, { method: 'GET' })).status, 405);
  assert.equal((await request(handler, { url: '/api/names-demo?all' })).status, 403);
});

test('existing rate limits remain enforced, and unavailable snapshot fails explicitly without remote/local-name fallback', async () => {
  const limited = createNamesDemoHandler({ limit: async () => { throw Object.assign(new Error('Wait'), { status: 429, retryAfter: 10 }); } });
  const res = await request(limited);
  assert.equal(res.status, 429);
  assert.equal(res.headers['retry-after'], '10');
  const missing = createNamesDemoHandler({
    limit: async () => {},
    search: createDemoSearch(new URL('./does-not-exist.json', snapshotUrl)),
  });
  assert.equal((await request(missing)).status, 503);
});

test('manual update validates and deduplicates; acquisition/validation failures retain exact last-good snapshot', async t => {
  const dir = await mkdtemp(`${tmpdir()}/names-demo-`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destination = pathToFileURL(`${dir}/snapshot.json`);
  await writeFile(destination, 'last-good');
  await assert.rejects(updateDemoSnapshot({ destination, acquire: async () => { throw new Error('Origin unavailable'); } }));
  assert.equal(await readFile(destination, 'utf8'), 'last-good');
  await assert.rejects(updateDemoSnapshot({ destination, acquire: async () => [{ name: '<invalid>' }] }));
  assert.equal(await readFile(destination, 'utf8'), 'last-good');
  await assert.rejects(updateDemoSnapshot({ destination, acquire: async () => [] }));
  assert.equal(await readFile(destination, 'utf8'), 'last-good');
  const counts = await updateDemoSnapshot({ destination, acquire: async () => [{ name: 'Danny' }, { name: 'danny' }, { name: 'Daniel' }] });
  assert.equal(counts.savedNames, 2);
  assert.deepEqual(await createDemoSearch(destination)('da'), ['Daniel', 'Danny']);
});

test('page is standalone, no catalogue is embedded, and raw/Vite source accesses are denied', async () => {
  const handler = createNamesDemoHandler();
  const page = await request(handler, { method: 'GET', url: '/names' });
  assert.equal(page.status, 200);
  assert.match(page.body, /role="combobox"/);
  assert.doesNotMatch(page.body, /stagcommunications|snapshot\.json|<script[^>]*src=/);
  for (const url of ['/server/names-demo/snapshot.json', '/server/names-demo/snapshot.json?raw',
    '/@fs/home/runner/workspace/server/names-demo/snapshot.json',
    '/server%2fnames-demo%2fsnapshot.json', '/@fs/home/runner/workspace/server/names-demo/snapshot.json?import&raw']) {
    const res = response();
    namesDemoMiddleware({ url }, res, () => assert.fail('Private source exposed'));
    assert.equal(res.status, 404);
  }
});

test('Vercel explicitly bundles private snapshot/page and directs only /names to isolated handler', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.match(config.functions['api/names-demo.js'].includeFiles, /snapshot\.json,page\.html/);
  assert.deepEqual(config.routes.find(route => route.src === '/names'), { src: '/names', dest: '/api/names-demo' });
});
