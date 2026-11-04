import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { withNameDatabase, nameFixture } from './helpers/private-name-fixture.mjs';
import { createNameSnapshotStore } from '../server/santa-name-snapshot.js';
import { createNameLibrary, parseNameIndex, filenameId, localRecords } from '../server/santa-name-library.js';
import { createNameSearchIndex } from '../server/santa-name-search-index.js';
import { santaNameKey as keyFor } from '../src/lib/santaNameSearch.js';
import { consumeNameAccess } from '../server/santa-name-security.js';
import { createSantaNamesHandler } from '../server/santa-names.js';
import { issueNameToken, verifyNameToken } from '../server/santa-name-security.js';

const key = 'isolated-test-only-signing-key-never-a-live-secret';
const request = ip => ({ headers: {}, socket: { remoteAddress: ip } });
const DAY = 86400000;
const manifest = names => Buffer.from(JSON.stringify({ version: 2, names: names.map(([name, file, aliases]) =>
  ({ name, file, id: filenameId(file), ...(aliases ? { aliases } : {}) })) }));

test('persistent daily snapshot coordinates instances, preserves good data and propagates forced additions/removals', async () => {
  await withNameDatabase(async pool => {
    let now = Date.now(), calls = 0, broken = false;
    let bytes = manifest([['Anna', 'Anna.mp3'], ['Élodie', 'Élodie.mp3', ['Ellie']]]);
    const options = { pool: () => pool, now: () => now, parse: parseNameIndex, fetchIndex: async () => {
      calls++; await new Promise(resolve => setTimeout(resolve, 12));
      if (broken) throw Object.assign(new Error('do not disclose upstream location'), { code: 'UPSTREAM_FETCH' });
      return bytes;
    } };
    const storeA = createNameSnapshotStore(options), storeB = createNameSnapshotStore(options);
    const a = createNameLibrary({ snapshotStore: storeA }), b = createNameLibrary({ snapshotStore: storeB });
    const [first, concurrent] = await Promise.all([a.search('Anna'), b.search('Élo')]);
    assert.equal(first.records.length, 1);
    assert.equal(concurrent.records.length, 1);
    assert.equal(calls, 1, 'cold instances share a fenced bootstrap refresh');
    const freshInstance = createNameLibrary({ snapshotStore: createNameSnapshotStore(options) });
    assert.equal((await freshInstance.search('Ellie')).records[0].name, 'Élodie');
    assert.equal(calls, 1, 'new instance reads private persisted snapshot, not origin');
    now += DAY - 1;
    await a.search('Anna'); assert.equal(calls, 1);
    now += 2;
    await Promise.all([a.search('Anna'), b.search('Anna')]);
    assert.equal(calls, 2, 'one daily origin refresh across instances');
    bytes = manifest([['Anna', 'Anna.mp3'], ['Danny', 'Danny.mp3'], ['Anna', 'anna.wav']]);
    assert.equal((await storeA.refresh({ force: true })).published, true);
    const hint = await consumeNameAccess(request('refresh-test'), 'search', { pool, now, key });
    assert.equal((await b.search('Danny', hint)).records[0].name, 'Danny');
    assert.equal((await b.search('Ellie', hint)).records.length, 0);
    assert.equal(await b.resolve(filenameId('Élodie.mp3')), null);
    assert.equal((await b.resolve(filenameId('Danny.mp3'))).file, 'Danny.mp3');
    assert.equal(await b.count(hint), 3);
    assert.equal((await b.search('Anna', hint)).records.length, 2);
    broken = true; now += DAY + 1;
    assert.equal((await b.search('Danny')).records.length, 1, 'refresh failure serves validated last-known-good snapshot');
    const failures = calls;
    await a.search('Danny'); assert.equal(calls, failures, 'backoff shared across instances');
    assert.equal((await storeB.status()).lastError, 'UPSTREAM_FETCH');
    now += 60001; broken = false; bytes = Buffer.from('<html>malformed index</html>');
    await a.search('Danny');
    assert.equal((await storeA.status()).lastError, 'INDEX_JSON');
    assert.equal((await b.search('Danny')).records.length, 1, 'malformed refresh cannot replace snapshot');
    bytes = manifest([]);
    await assert.rejects(storeA.refresh({ force: true }), { code: 'INDEX_EMPTY' });
    assert.equal((await b.search('Danny')).records.length, 1);
    const diagnostic = JSON.stringify(await storeB.status());
    assert.doesNotMatch(diagnostic, /Danny|\.mp3|payload|token|upstream location/);
  });
});

test('fencing rejects an expired publisher and crash recovery cannot overwrite a newer snapshot', async () => {
  await withNameDatabase(async pool => {
    let now = Date.now(), finish;
    const old = createNameSnapshotStore({ pool: () => pool, now: () => now, parse: parseNameIndex,
      fetchIndex: () => new Promise(resolve => { finish = resolve; }) });
    const stalled = old.refresh({ force: true });
    const rejected = assert.rejects(stalled, { code: 'INDEX_LEASE_LOST' });
    while (!finish) await new Promise(resolve => setTimeout(resolve, 2));
    now += 30001;
    const next = createNameSnapshotStore({ pool: () => pool, now: () => now, parse: parseNameIndex,
      fetchIndex: async () => manifest([['Danny', 'Danny.mp3']]) });
    await next.refresh({ force: true });
    finish(manifest([['Anna', 'Anna.mp3']]));
    await rejected;
    const loaded = await next.load();
    assert.equal(loaded[0].name, 'Danny');
    assert.equal((await next.status()).lastError, null);
  });
});

test('bootstrap failure is bounded and explicit; no direct-origin fallback after storage failure', async () => {
  await withNameDatabase(async pool => {
    let calls = 0;
    const options = { pool: () => pool, parse: parseNameIndex, fetchIndex: async () => {
      calls++; throw new Error('sensitive upstream body');
    } };
    const store = createNameSnapshotStore(options);
    const library = createNameLibrary({ snapshotStore: store });
    assert.match((await library.search('Danny')).warning, /unavailable/);
    await assert.rejects(library.count());
    await assert.rejects(library.resolve(filenameId('Danny.mp3')));
    assert.equal(calls, 1, 'persisted failure backoff prevents origin stampede');
    const brokenStorage = createNameSnapshotStore({ ...options, pool: () => ({
      query() { throw new Error('database unavailable'); },
    }) });
    await assert.rejects(brokenStorage.load());
    assert.equal(calls, 1);
  });
});

test('real PostgreSQL limiter is atomic under concurrency, rolls back both buckets and keeps scopes separate', async () => {
  await withNameDatabase(async pool => {
    const now = Date.now();
    const opts = { pool, now, key };
    const attempts = await Promise.allSettled(Array.from({ length: 55 }, () => consumeNameAccess(request('same'), 'search', opts)));
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 40);
    assert.equal(attempts.filter(r => r.reason?.status === 429).length, 15);
    const rows = await pool.query('SELECT attempts, bucket_key FROM santa_name_request_limits');
    assert.equal(rows.rowCount, 2);
    assert.ok(rows.rows.every(row => row.attempts === 40), 'address rejection must not consume global capacity');
    assert.ok(rows.rows.every(row => !row.bucket_key.includes('same')), 'only HMAC identities stored');
    await consumeNameAccess(request('same'), 'preview', opts);
    await consumeNameAccess(request('same'), 'count', opts);
    await consumeNameAccess(request('other'), 'search', opts);
    // Explicit global saturation; no address row may be created on rejection.
    await pool.query("UPDATE santa_name_request_limits SET attempts=1200 WHERE bucket_key LIKE 'name-access:search:%'");
    await assert.rejects(consumeNameAccess(request('new-address'), 'search', opts), error => error.status === 429);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM santa_name_request_limits')).rows[0].n, 7);
    await consumeNameAccess(request('same'), 'search', { ...opts, now: now + 60000 });
    const failing = { query: async () => { throw Object.assign(new Error('unavailable'), { code: '08006' }); } };
    await assert.rejects(consumeNameAccess(request('same'), 'search', { ...opts, pool: failing }), { code: '08006' });
    await pool.query('DROP FUNCTION santa_consume_name_access(text,text,integer,integer,timestamptz,timestamptz,text)');
    await assert.rejects(consumeNameAccess(request('same'), 'search', opts), { code: '42883' });
  });
});

test('warm search adds no freshness trip and responses retain bounded private capabilities, not inventory metadata', async () => {
  await withNameDatabase(async real => {
    let commands = 0, fetches = 0;
    const pool = { query: (...args) => { commands++; return real.query(...args); } };
    const store = createNameSnapshotStore({ pool: () => pool, parse: parseNameIndex,
      fetchIndex: async () => { fetches++; return nameFixture(); } });
    const library = createNameLibrary({ snapshotStore: store });
    await store.refresh({ force: true });
    const handler = createSantaNamesHandler(library, {
      limit: (req, scope) => consumeNameAccess(req, scope, { pool, key }),
      token: (id, scope) => issueNameToken(id, scope, Date.now(), key),
    });
    let payload;
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
      writeHead(code) { this.status = code; }, end(body) { payload = JSON.parse(body); } };
    commands = 0;
    await handler({ ...request('warm'), method: 'POST', url: '/api/santa-names',
      headers: { 'content-type': 'application/json' }, body: { query: 'Anna' } }, res);
    assert.equal(res.status, 200);
    assert.equal(commands, 1, 'metadata is returned by the atomic limiter call');
    assert.equal(fetches, 1);
    assert.equal(payload.records.length, 10);
    assert.deepEqual(Object.keys(payload).sort(), ['records', 'warning']);
    assert.doesNotMatch(JSON.stringify(payload), /fixture-\d+\.mp3|payload|refreshedAt|hostedCount|stagcommunications/);
    for (const record of payload.records) {
      assert.equal(verifyNameToken(record.selectionToken, 'message', Date.now(), key), record.id);
      assert.equal(verifyNameToken(record.selectionToken, 'preview', Date.now(), key), null);
    }
    assert.match(res.headers['Cache-Control'], /private, no-store/);
  });
});

test('pre-indexed matching agrees with historical filtering for Unicode, aliases, variants and local overrides', () => {
  const bytes = manifest([
    ['Seán', 'Seán.mp3'], ['Sea\u0301n', 'Sea\u0301n.mp3'], ["O'Conner", "O'Conner.wav"],
    ['O’Conner', 'O’Conner.wav'], ['Mary Jane', 'Mary Jane.mp3', ['MJ']],
    ['Anna', 'Anna.mp3'], ['Anna', 'Anna.wav'], ['Erin', 'Erin.mp3'],
  ]);
  const hosted = parseNameIndex(bytes);
  const index = createNameSearchIndex(hosted, localRecords);
  const hostedLabels = new Set(hosted.map(r => keyFor(r.name)));
  const records = new Map(localRecords.filter(r => !hostedLabels.has(keyFor(r.name))).map(r => [r.id, r]));
  for (const r of hosted) records.set(r.id, r);
  for (const input of ['SEÁN', "o'c", 'O’c', 'Mary J', 'MJ', 'Anna', 'erin', 'missing', '']) {
    const prefix = keyFor(input);
    const historical = [...records.values()].filter(r => prefix &&
      [r.name, r.file?.slice(0, -4) || r.id, ...(r.aliases || [])].some(value => keyFor(value).startsWith(prefix)))
      .sort((a, b) => a.name.localeCompare(b.name, 'en-GB')).slice(0, 20).map(r => r.id);
    assert.deepEqual(index.search(input).map(r => r.id), historical, input);
  }
});

test('operator command is private and requires deliberate refresh confirmation', async () => {
  const source = await readFile('scripts/private-name-catalogue.mjs', 'utf8');
  assert.match(source, /--confirm-refresh/);
  assert.doesNotMatch(source, /console\.(?:log|error)\(.*(?:process\.env|error\.message|payload)/);
  assert.throws(() => execFileSync(process.execPath, ['scripts/private-name-catalogue.mjs', 'refresh'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }), error => error.status === 1 && /USE_STATUS_OR_REFRESH_WITH_CONFIRM_REFRESH/.test(error.stderr));
});
