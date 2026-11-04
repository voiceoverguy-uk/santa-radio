import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withNameDatabase } from './helpers/private-name-fixture.mjs';
import { createNameSnapshotStore } from '../server/santa-name-snapshot.js';
import { createNameLibrary, parseNameIndex } from '../server/santa-name-library.js';
import { createSantaNamesHandler } from '../server/santa-names.js';
import { createSantaNamePreviewHandler } from '../server/santa-name-preview.js';
import { consumeNameAccess, issueNameToken, verifyNameToken } from '../server/santa-name-security.js';
import { nameDiagnostic } from '../server/santa-name-diagnostic.js';

const key = 'isolated-recovery-test-key-not-a-live-secret';
const bytes = Buffer.from(JSON.stringify({ version: 1,
  names: [{ id: 'danny', name: 'Danny', file: 'danny.mp3' }] }));
const req = (query, url = '/api/santa-names', method = 'POST') => ({
  method, url, body: { query }, headers: { 'content-type': 'application/json' },
  socket: { remoteAddress: 'isolated-recovery' },
});
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; } };
}
const options = pool => ({
  limit: (request, scope) => consumeNameAccess(request, scope, { pool, key }),
  token: (id, scope) => issueNameToken(id, scope, Date.now(), key),
});
const lookup = async (handler, query) => {
  const res = response();
  await handler(req(query), res);
  assert.match(res.headers['Cache-Control'], /private, no-store/);
  return { ...res, data: JSON.parse(res.body) };
};

test('deployment-style old database serves private search without new schema, and missing base storage still fails closed', async () => {
  await withNameDatabase(async pool => {
    let fetches = 0;
    const store = createNameSnapshotStore({
      pool: () => pool, parse: parseNameIndex, fetchIndex: async () => { fetches++; return bytes; },
    });
    const library = createNameLibrary({ snapshotStore: store, legacySchemaFallback: true,
      fetcher: async url => {
        const source = new URL(url);
        if (source.pathname.endsWith('.mp3') || source.searchParams.get('action') === 'audio') return new Response('synthetic audio');
        fetches++;
        return new Response(bytes);
      } });
    const handler = createSantaNamesHandler(library, options(pool));
    let res = await lookup(handler, 'Danny');
    assert.equal(res.status, 200);
    assert.equal(res.data.records[0].name, 'Danny');
    assert.equal(res.data.warning, null);
    assert.equal(fetches, 1);
    assert.equal((await pool.query("SELECT to_regclass('public.santa_name_catalogue') AS name")).rows[0].name, null);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM santa_name_request_limits')).rows[0].n, 2);
    const selected = res.data.records[0];
    assert.equal(verifyNameToken(selected.selectionToken, 'message', Date.now(), key), selected.id);
    assert.equal((await library.resolve(selected.id)).id, selected.id);
    const preview = createSantaNamePreviewHandler(library, { ...options(pool),
      verify: (token, scope) => verifyNameToken(token, scope, Date.now(), key) });
    const audio = response();
    await preview(req('', selected.previewUrl, 'GET'), audio);
    assert.equal(audio.status, 200);
    assert.equal(audio.body.toString(), 'synthetic audio');
    assert.match(audio.headers['Cache-Control'], /private, no-store/);
    assert.doesNotMatch(res.body, /stagcommunications|names-index|danny\.mp3/);
    assert.equal((await lookup(handler, 'Zzxxyy')).data.warning, null);
    assert.equal(fetches, 1, 'private compatibility cache deduplicates reads');
    // Function absent while a valid snapshot exists also remains usable.
    const { readFile } = await import('node:fs/promises');
    const schema = await readFile('database/santa-name-catalogue.sql', 'utf8');
    await pool.query(schema);
    await store.refresh({ force: true });
    await pool.query('DROP FUNCTION santa_consume_name_access(text,text,integer,integer,timestamptz,timestamptz,text)');
    res = await lookup(handler, 'Danny');
    assert.equal(res.status, 200);
    assert.equal(res.data.warning, null);
    assert.equal(fetches, 2);
    // Function present but snapshot table absent: transaction fallback accounts
    // for the request after the failed function's transaction was rolled back.
    await pool.query(schema);
    await pool.query('DROP TABLE santa_name_catalogue');
    res = await lookup(handler, 'Danny');
    assert.equal(res.status, 200);
    assert.equal(res.data.warning, null);
    assert.equal(fetches, 2);
    await pool.query('DROP TABLE santa_name_request_limits');
    res = await lookup(handler, 'Danny');
    assert.equal(res.status, 503);
    assert.equal(fetches, 2, 'missing base limiter storage must not read the origin');
    assert.doesNotMatch(res.body, /42P01|42883|santa_name_catalogue|santa_consume_name_access/);
  }, { snapshotSchema: false });
});

test('legacy compatibility keeps concurrent persistent limits atomic, scoped, expiring and query-free', async () => {
  await withNameDatabase(async pool => {
    const now = Date.now();
    const opts = { pool, key, now };
    const attempts = await Promise.allSettled(Array.from({ length: 55 }, () => consumeNameAccess(req('not stored'), 'search', opts)));
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 40);
    assert.equal(attempts.filter(r => r.reason?.status === 429).length, 15);
    const rows = await pool.query('SELECT attempts,bucket_key FROM santa_name_request_limits');
    assert.equal(rows.rowCount, 2);
    assert.ok(rows.rows.every(row => row.attempts === 40), 'address rejection rolls back global increment');
    assert.doesNotMatch(JSON.stringify(rows.rows), /isolated-recovery|not stored/);
    await consumeNameAccess(req(''), 'preview', opts);
    await consumeNameAccess(req(''), 'message', opts);
    await pool.query("UPDATE santa_name_request_limits SET attempts=1200 WHERE bucket_key LIKE 'name-access:search:%'");
    await assert.rejects(consumeNameAccess({ ...req(''), socket: { remoteAddress: 'new' } }, 'search', opts),
      error => error.status === 429 && error.retryAfter > 0);
    const all = await pool.query('SELECT count(*)::int AS n FROM santa_name_request_limits');
    assert.equal(all.rows[0].n, 6, 'no rejected address inserted');
    await consumeNameAccess(req(''), 'search', { ...opts, now: now + 60000 });
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM santa_name_request_limits')).rows[0].n, 2,
      'new minute is usable and expired buckets are cleaned');
  }, { snapshotSchema: false });
});

test('optimised and compatibility limiters share the same buckets during a rolling release', async () => {
  await withNameDatabase(async pool => {
    const old = { query: async () => { throw Object.assign(new Error(), { code: '42883' }); },
      connect: () => pool.connect() };
    const now = Date.now();
    const attempts = await Promise.allSettled(Array.from({ length: 55 }, (_, i) =>
      consumeNameAccess(req(''), 'search', { pool: i % 2 ? old : pool, key, now })));
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 40);
    assert.equal(attempts.filter(r => r.reason?.status === 429).length, 15);
    const rows = await pool.query('SELECT attempts FROM santa_name_request_limits');
    assert.equal(rows.rowCount, 2);
    assert.ok(rows.rows.every(row => row.attempts === 40));
  });
});

test('schema compatibility never masks storage, permissions, integrity, empty-source or upstream failures', async () => {
  for (const code of ['08006', '42501', 'INDEX_INTEGRITY', 'INDEX_UNAVAILABLE']) {
    let fetches = 0;
    const library = createNameLibrary({ legacySchemaFallback: true,
      snapshotStore: { load: async () => { throw Object.assign(new Error('private details'), { code }); } },
      fetcher: async () => { fetches++; return new Response(bytes); } });
    const result = await library.search('Danny');
    assert.match(result.warning, /incomplete/);
    assert.equal(fetches, 0);
    assert.equal(result.records.length, 0);
  }
  for (const source of ['{"version":1,"names":[]}', 'private invalid source']) {
    let now = 1, fetches = 0;
    const library = createNameLibrary({ legacySchemaFallback: true, now: () => now,
      snapshotStore: { load: async () => { throw Object.assign(new Error(), { code: '42P01' }); } },
      fetcher: async () => { fetches++; return new Response(source); } });
    assert.match((await library.search('Danny')).warning, /incomplete/);
    assert.match((await library.search('Arabella')).warning, /incomplete/);
    assert.equal(fetches, 1, 'failed compatibility fetch uses bounded backoff');
    now += 10001;
    assert.match((await library.search('Danny')).warning, /incomplete/);
    assert.equal(fetches, 2);
  }
});

test('real handler distinguishes unavailable initial index, local choices, genuine no-match and last-known-good recovery', async () => {
  await withNameDatabase(async pool => {
    let now = Date.now(), fail = true, empty = false, fetches = 0;
    const store = createNameSnapshotStore({ pool: () => pool, now: () => now, parse: parseNameIndex,
      fetchIndex: async () => {
        fetches++;
        if (fail) throw Object.assign(new Error('private upstream details'), { code: 'UPSTREAM_FETCH' });
        return empty ? Buffer.from('{"version":1,"names":[]}') : bytes;
      } });
    const library = createNameLibrary({ snapshotStore: store, fetcher: async () => new Response('synthetic audio') });
    const handler = createSantaNamesHandler(library, options(pool));
    let res = await lookup(handler, 'Danny');
    assert.equal(res.status, 200);
    assert.equal(res.data.records.length, 0);
    assert.match(res.data.warning, /incomplete/);
    res = await lookup(handler, 'Arabella');
    assert.ok(res.data.records.length > 0, 'useful local recording remains selectable');
    assert.match(res.data.warning, /incomplete/);
    assert.equal(fetches, 1, 'failure backoff prevents repeated bootstrap reads');
    const local = res.data.records[0];
    assert.equal(verifyNameToken(local.selectionToken, 'message', Date.now(), key), local.id);
    assert.ok(await library.resolve(local.id));
    fail = false; empty = true;
    await assert.rejects(store.refresh({ force: true }), { code: 'INDEX_EMPTY' });
    assert.match((await lookup(handler, 'Danny')).data.warning, /incomplete/);
    empty = false;
    await store.refresh({ force: true });
    res = await lookup(handler, 'Danny');
    assert.equal(res.status, 200);
    assert.equal(res.data.warning, null);
    assert.equal(res.data.records[0].name, 'Danny');
    const record = res.data.records[0];
    assert.equal(verifyNameToken(record.selectionToken, 'message', Date.now(), key), record.id);
    const preview = createSantaNamePreviewHandler(library, { ...options(pool),
      verify: (token, scope) => verifyNameToken(token, scope, Date.now(), key) });
    const audio = response();
    await preview(req('', record.previewUrl, 'GET'), audio);
    assert.equal(audio.status, 200);
    assert.equal(audio.body.toString(), 'synthetic audio');
    assert.match(audio.headers['Cache-Control'], /private, no-store/);
    const wrongScope = response();
    await preview(req('', `/api/santa-name-preview?token=${record.selectionToken}`, 'GET'), wrongScope);
    assert.equal(wrongScope.status, 403);
    res = await lookup(handler, 'Zzxxyy');
    assert.equal(res.data.warning, null);
    assert.deepEqual(res.data.records, []);
    fail = true; now += 86400001;
    res = await lookup(handler, 'Danny');
    assert.equal(res.data.records[0].id, record.id);
    assert.equal(res.data.warning, null, 'a validated complete previous snapshot is not local-only');
    assert.equal((await store.status()).lastError, 'UPSTREAM_FETCH');
    // A cold instance also recovers the validated snapshot during retry backoff.
    const cold = createNameLibrary({ snapshotStore: createNameSnapshotStore({
      pool: () => pool, now: () => now, parse: parseNameIndex,
      fetchIndex: async () => { throw new Error('must not read origin during backoff'); },
    }) });
    const coldResult = await lookup(createSantaNamesHandler(cold, options(pool)), 'Danny');
    assert.equal(coldResult.data.records[0].id, record.id);
    assert.equal(coldResult.data.warning, null);
  });
});

test('runtime diagnostics allowlist codes without child queries, SQL, credentials or source details', t => {
  const log = t.mock.method(console, 'warn', () => {});
  nameDiagnostic('unsafe child query', { code: 'private credential', message: 'sensitive source' });
  nameDiagnostic('search', { code: '42501', message: 'private SQL' });
  for (const call of log.mock.calls) {
    assert.doesNotMatch(JSON.stringify(call.arguments), /unsafe|credential|sensitive|SQL/);
  }
  assert.ok(log.mock.calls.some(call => call.arguments[1].code === '42501'));
});
