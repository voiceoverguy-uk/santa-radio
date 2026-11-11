import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { snapshotUrl, validateSnapshot } from '../server/names-demo/snapshot.js';
import { createNamesDemoHandler, namesDemoMiddleware } from '../server/names-demo/handler.js';
import { updateDemoSnapshot } from './import-names-demo.mjs';
import { prepareNamesDemo } from './prepare-names-demo.mjs';

const directory = new URL('../server/names-demo/', import.meta.url);
const prepared = await prepareNamesDemo();
const asset = `/names-data/${prepared.filename}`;
function response() {
  return { headers: {}, status: null, body: '',
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    writeHead(status, headers = {}) { this.status = status; for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); return this; },
    end(body = '') { this.body = body; return this; } };
}
async function request(handler, { method = 'GET', url = asset, headers = {} } = {}) {
  const res = response();
  await handler({ method, url, headers }, res);
  return res;
}
const handler = createNamesDemoHandler();

test('public file contains every deduplicated display name and NOTHING else', async () => {
  const source = validateSnapshot(JSON.parse(await readFile(snapshotUrl, 'utf8')));
  const res = await request(handler);
  assert.equal(res.status, 200);
  const names = JSON.parse(res.body);
  assert.ok(Array.isArray(names));
  assert.deepEqual(names, source.slice().sort());
  assert.equal(names.length, source.length);
  assert.ok(names.every(name => typeof name === 'string' && !/https?:|[/.\\]|\.mp3|\.wav|f-[0-9a-f]{64}/i.test(name)));
  assert.doesNotMatch(res.body.toString(), /importedAt|version|filename|previewUrl|selectionToken|stagcommunications/);
});

test('precompressed Brotli/gzip and identity responses are equivalent and publicly immutable', async () => {
  const plain = await request(handler);
  for (const encoding of ['br', 'gzip']) {
    const res = await request(handler, { headers: { 'accept-encoding': encoding } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], encoding);
    assert.equal(res.headers['vary'], 'Accept-Encoding');
    assert.match(res.headers['cache-control'], /public.*31536000.*immutable/);
    assert.match(res.headers['vercel-cdn-cache-control'], /public.*immutable/);
    assert.deepEqual((encoding === 'br' ? brotliDecompressSync : gunzipSync)(res.body), plain.body);
    assert.ok(res.body.length < plain.body.length / 2);
    const cached = await request(handler, { headers: { 'accept-encoding': encoding, 'if-none-match': res.headers.etag } });
    assert.equal(cached.status, 304);
    assert.equal(cached.body, '');
  }
  assert.equal((await request(handler, { headers: { 'accept-encoding': 'br;q=0, gzip;q=1' } })).headers['content-encoding'], 'gzip');
  assert.equal((await request(handler, { headers: { 'accept-encoding': 'br;q=0, gzip;q=0, identity;q=0' } })).status, 406);
  assert.equal((await request(handler, { method: 'HEAD' })).body, '');
});

test('page points at automatically refreshed names feed and cannot be cached with an obsolete version', async () => {
  const page = await request(handler, { url: '/names' });
  assert.equal(page.status, 200);
  assert.ok(page.body.includes('/names-data/latest.json'));
  assert.doesNotMatch(page.body, /__NAMES_ASSET_URL__|\/api\/names-demo|snapshot\.json|stagcommunications/);
  assert.match(page.headers['cache-control'], /no-store/);
  assert.equal(page.headers['vercel-cdn-cache-control'], 'no-store');
});

test('deterministic preparation changes URLs only when names change and retains old versions/failure fallback', async t => {
  const dir = await mkdtemp(`${tmpdir()}/names-demo-assets-`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = pathToFileURL(`${dir}/`);
  const first = await prepareNamesDemo({ root, data: { version: 1, names: ['Danny', 'Daniel'] } });
  const same = await prepareNamesDemo({ root, data: { version: 1, importedAt: 'changed', names: ['Daniel', 'Danny'] } });
  assert.equal(first.filename, same.filename);
  const changed = await prepareNamesDemo({ root, data: { version: 1, names: ['Daniel', 'Danny', 'Daisy'] } });
  assert.notEqual(first.filename, changed.filename);
  const lastGood = await readFile(new URL('./asset-manifest.json', root), 'utf8');
  await assert.rejects(prepareNamesDemo({ root, data: { version: 1, names: ['Danny', 'danny'] } }));
  await assert.rejects(prepareNamesDemo({ root, data: { version: 1, names: ['https://private.invalid'] } }));
  assert.equal(await readFile(new URL('./asset-manifest.json', root), 'utf8'), lastGood);
  assert.equal((await request(createNamesDemoHandler({ directory: root }), { url: `/names-data/${first.filename}` })).status, 200);
  await cp(new URL('./page.html', directory), new URL('./page.html', root));
  const newPage = await request(createNamesDemoHandler({ directory: root }), { url: '/names' });
  assert.ok(newPage.body.includes('/names-data/latest.json'));
  assert.ok(!newPage.body.includes(first.filename));
});

test('live names update without a rebuild, remain names-only, and fall back safely', async () => {
  let records = [{ name: 'Danny', file: 'secret.wav', id: 'private-id' }];
  const live = createNamesDemoHandler({ library: { catalogue: async () => records } });
  const get = () => request(live, { url: '/names-data/latest.json' });
  assert.deepEqual(JSON.parse((await get()).body), ['Danny']);
  records.push({ name: 'Daisy', file: 'private.wav' }, { name: 'danny' });
  const updated = await get();
  assert.deepEqual(JSON.parse(updated.body), ['Daisy', 'Danny']);
  assert.doesNotMatch(updated.body, /secret|file|private|id/);
  assert.match(updated.headers['cache-control'], /max-age=0.*must-revalidate/);
  assert.equal(updated.headers['vercel-cdn-cache-control'], 'public, s-maxage=60');
  records = [{ name: 'https://invalid.example' }];
  const fallback = await get();
  assert.deepEqual(JSON.parse(fallback.body), JSON.parse((await request(handler)).body));
  assert.equal(fallback.headers['vercel-cdn-cache-control'], 'public, s-maxage=10');
  const offline = createNamesDemoHandler({ library: { catalogue: async () => { throw new Error('offline'); } } });
  assert.equal((await request(offline, { url: '/names-data/latest.json' })).status, 200);
  assert.equal((await request(live, { url: '/names-data/latest.json?file=secret' })).status, 403);
  assert.equal((await request(live, { url: '/names-data/latest.json', method: 'POST' })).status, 405);
});

test('retired search routes do not query a database or expose extra data', async () => {
  for (const method of ['GET', 'POST']) {
    assert.equal((await request(handler, { url: '/api/names-demo', method })).status, 410);
  }
  assert.equal((await request(handler, { url: `${asset}?all` })).status, 403);
  assert.equal((await request(handler, { url: '/names-data/snapshot.json' })).status, 404);
  assert.equal((await request(handler, { url: '/names-data/' + 'a'.repeat(64) + '.json' })).status, 404);
  assert.equal((await request(handler, { method: 'POST' })).status, 405);
  assert.equal((await request(createNamesDemoHandler({ directory: new URL('./missing/', directory) }), { url: '/names' })).status, 503);
});

test('manual source update rejects acquisition/validation failure and preserves last-good snapshot', async t => {
  const dir = await mkdtemp(`${tmpdir()}/names-demo-import-`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destination = pathToFileURL(`${dir}/snapshot.json`);
  await writeFile(destination, 'last-good');
  await assert.rejects(updateDemoSnapshot({ destination, acquire: async () => { throw new Error('Origin unavailable'); } }));
  await assert.rejects(updateDemoSnapshot({ destination, acquire: async () => [{ name: '<invalid>' }] }));
  await assert.rejects(updateDemoSnapshot({ destination, acquire: async () => [] }));
  assert.equal(await readFile(destination, 'utf8'), 'last-good');
  const counts = await updateDemoSnapshot({ destination, acquire: async () => [{ name: 'Danny' }, { name: 'danny' }] });
  assert.equal(counts.savedNames, 1);
});

test('raw source, generated-file paths, private manifest and @fs requests remain blocked', () => {
  for (const url of ['/server/names-demo/snapshot.json', '/server/names-demo/snapshot.json?raw',
    '/server/names-demo/asset-manifest.json', `/server/names-demo/assets/${prepared.filename}`,
    '/@fs/home/runner/workspace/server/names-demo/snapshot.json',
    '/server%2fnames-demo%2fsnapshot.json']) {
    const res = response();
    namesDemoMiddleware({ url }, res, () => assert.fail('Private source exposed'));
    assert.equal(res.status, 404);
  }
});

test('Vercel packages public projections, not the snapshot, and both preview/build prepare without downloading', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const includes = config.functions['api/names-demo.js'].includeFiles;
  assert.match(includes, /asset-manifest\.json,assets\/\*\*/);
  assert.doesNotMatch(includes, /snapshot/);
  assert.ok(config.routes.some(route => route.src.startsWith('/names-data/') && route.dest === '/api/names-demo'));
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  for (const command of [pkg.scripts.dev, pkg.scripts.build]) {
    assert.match(command, /prepare-names-demo/);
    assert.doesNotMatch(command, /import-names-demo/);
  }
});
