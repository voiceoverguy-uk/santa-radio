import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';
import { collectOnce, observationDecision, readChart } from '../server/radio-history-store.js';
import { readCurrentSnapshot } from '../server/radio-metadata.js';
import { yesterdayWindow } from '../server/radio-history-time.js';
import { createTopTenHandler } from '../server/radio-top-ten.js';
import { pollingCadence, runCollector } from './radio-history-collector.mjs';

test('UK midnight windows include both daylight-saving boundaries and local rollover', () => {
  for (const [now, date, start, end, hours] of [
    ['2026-03-30T10:00Z', '2026-03-29', '2026-03-29T00:00:00.000Z', '2026-03-29T23:00:00.000Z', 23],
    ['2026-10-26T10:00Z', '2026-10-25', '2026-10-24T23:00:00.000Z', '2026-10-26T00:00:00.000Z', 25],
    ['2026-07-02T23:01Z', '2026-07-02', '2026-07-01T23:00:00.000Z', '2026-07-02T23:00:00.000Z', 24],
  ]) {
    const result = yesterdayWindow(new Date(now));
    assert.equal(result.date, date); assert.equal(result.start, start); assert.equal(result.end, end);
    assert.equal((+new Date(end) - +new Date(start)) / 3600000, hours);
    assert.ok(+new Date(result.nextRefreshAt) > +new Date(now));
  }
  assert.equal(yesterdayWindow(new Date('2026-07-02T22:59Z')).date, '2026-07-01');
});

test('fresh bounded reader rejects invalid snapshots and preserves announcements', async () => {
  const read = text => readCurrentSnapshot(async (url, options) => {
    assert.match(String(url), /stagcommunications.com\/santaradio\/Nowplaying.txt/);
    assert.equal(options.cache, 'no-store');
    return new Response(text, { headers: { 'content-type': 'text/plain' } });
  });
  assert.deepEqual(await read(' Artist - Song '), { artist: 'Artist', title: 'Song' });
  assert.equal(await read(' - Santa Radio Free Message ID - VO'), null);
  assert.equal(await read('Santa Radio - ID'), null);
  for (const text of ['bad', '<html>error</html>', '', 'A - B\nC - D', 'x'.repeat(9000)]) {
    await assert.rejects(read(text));
  }
  await assert.rejects(readCurrentSnapshot(async () => new Response('A - B', { status: 503 })));
});

test('normalisation preserves distinct recordings; baseline and gaps are not plays', () => {
  const now = new Date();
  const previous = { observed_at: new Date(+now - 15000), identity: '["a","b"]' };
  assert.equal(observationDecision(previous, { artist: ' A ', title: 'B' }, now).count, false);
  assert.equal(observationDecision(previous, { artist: 'A', title: 'B (live)' }, now).count, true);
  assert.equal(observationDecision({}, { artist: 'A', title: 'B' }, now).count, false);
  assert.equal(observationDecision({ ...previous, observed_at: new Date(+now - 91000) }, { artist: 'X', title: 'Y' }, now).count, false);
});

test('standalone loop backs off failures, never overlaps, and stops cleanly', async () => {
  assert.equal(pollingCadence(), 15000);
  for (const value of ['0', '30001', 'NaN', '1.5']) assert.throws(() => pollingCadence(value));
  const controller = new AbortController();
  const delays = []; let calls = 0, active = false;
  await runCollector({ signal: controller.signal, cadenceMs: 15000,
    poll: async () => {
      assert.equal(active, false); active = true; await Promise.resolve(); active = false;
      calls++; return { failed: calls < 3 };
    },
    wait: async delay => { delays.push(delay); if (delays.length === 3) controller.abort(); },
  });
  assert.deepEqual(delays, [30000, 60000, 15000]);
});

test('endpoint is read-only, inactive without storage, no-store, explicit failure and fresh date', async () => {
  let now = new Date('2026-07-02T22:59Z');
  const invoke = async (handler, method = 'GET') => {
    const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(body) { this.body = body; } };
    await handler({ method }, res); return res;
  };
  const handler = createTopTenHandler({ enabled: () => false, read: () => assert.fail(), clock: () => now });
  const response = await invoke(handler);
  assert.equal(JSON.parse(response.body).state, 'inactive');
  assert.equal(response.headers['Cache-Control'], 'no-store');
  now = new Date('2026-07-02T23:00Z');
  assert.equal(JSON.parse((await invoke(handler)).body).date, '2026-07-02');
  assert.equal((await invoke(handler, 'POST')).statusCode, 405);
  assert.equal((await invoke(createTopTenHandler({ enabled: () => true, read: async () => { throw Error(); } }))).statusCode, 503);
});

test('real isolated PostgreSQL: atomic concurrency, durable restarts, coverage, ranking and boundaries', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'santa-radio-history-'));
  const data = join(dir, 'db');
  let started = false, db;
  t.after(async () => {
    await db?.end();
    if (started) execFileSync('pg_ctl', ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    await rm(dir, { recursive: true, force: true });
  });
  execFileSync('initdb', ['-D', data, '-A', 'trust', '--no-locale', '-U', 'radio_test'], { stdio: 'ignore' });
  execFileSync('pg_ctl', ['-D', data, '-l', join(dir, 'postgres.log'), '-o', `-k ${dir} -h '' -p 55439`, '-w', 'start'], { stdio: 'ignore' });
  started = true;
  const config = { host: dir, port: 55439, user: 'radio_test', database: 'postgres', max: 4 };
  db = new pg.Pool(config);
  await db.query(await readFile(new URL('../database/radio-history.sql', import.meta.url), 'utf8'));
  const A = { artist: 'Artist', title: 'Song' }, B = { artist: 'Other', title: 'Song (live)' };
  const poll = track => collectOnce({ pool: db, read: async () => track });
  const advance = () => db.query(`UPDATE radio_history_checkpoint SET attempted_at=clock_timestamp()-interval '16 seconds', observed_at=clock_timestamp()-interval '16 seconds'`);
  assert.equal((await poll(A)).baseline, true);
  await advance(); assert.equal((await poll(A)).counted, false);
  await advance();
  let release, entered;
  const entry = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const first = collectOnce({ pool: db, read: async () => { entered(); await gate; return B; } });
  await entry;
  assert.equal((await poll(B)).skipped, true);
  release(); assert.equal((await first).counted, true);
  assert.equal((await poll(B)).skipped, true);
  // Reopening a pool models a new process: checkpoint is not in memory.
  await db.end(); db = new pg.Pool(config);
  await advance(); assert.equal((await poll(B)).counted, false);
  await advance(); await poll(null);
  await advance(); assert.equal((await poll(B)).counted, true);
  await advance();
  assert.equal((await collectOnce({ pool: db, read: async () => { throw Error('outage'); } })).failed, true);
  assert.equal((await db.query('SELECT last_error FROM radio_history_checkpoint')).rows[0].last_error, true);
  await db.query(`UPDATE radio_history_checkpoint SET attempted_at=clock_timestamp()-interval '2 minutes',observed_at=clock_timestamp()-interval '2 minutes'`);
  assert.equal((await poll(A)).baseline, true);
  assert.equal(Number((await db.query('SELECT count(*) FROM radio_history_plays')).rows[0].count), 2);
  // Execute the real command twice, shutting it down with SIGTERM. The first
  // establishes a baseline; the second must use its persisted identity.
  await db.query(`UPDATE radio_history_checkpoint SET attempted_at=NULL,observed_at=NULL,identity=NULL`);
  for (let run = 0; run < 2; run++) {
    if (run) await advance();
    const child = spawn(process.execPath, ['--import', './scripts/fixtures/radio-history-fetch.mjs', 'scripts/radio-history-collector.mjs'], {
      env: { ...process.env, RADIO_HISTORY_ENABLED: 'true', RADIO_HISTORY_POLL_MS: '5000',
        RADIO_HISTORY_DATABASE_URL: `postgresql://radio_test@localhost/postgres?host=${encodeURIComponent(dir)}&port=55439` },
      stdio: ['ignore','pipe','pipe'],
    });
    try {
      await new Promise((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => reject(Error(`CLI timeout: ${output}`)), 12000);
        child.stdout.on('data', chunk => {
          output += chunk;
          if (/baseline saved|Observation saved/.test(output)) { clearTimeout(timer); resolve(); }
        });
        child.once('exit', code => { clearTimeout(timer); reject(Error(`CLI exited ${code}`)); });
      });
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      assert.equal((await exited)[0], 0);
    } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
  }
  assert.equal(Number((await db.query('SELECT count(*) FROM radio_history_plays')).rows[0].count), 2);
  const window = yesterdayWindow(new Date('2026-10-26T12:00Z'));
  await db.query('TRUNCATE radio_history_plays,radio_history_coverage');
  await db.query('UPDATE radio_history_checkpoint SET first_observed_at=NULL,observed_at=NULL');
  assert.equal((await readChart(window, db)).state, 'initial');
  await db.query('UPDATE radio_history_checkpoint SET first_observed_at=$1,observed_at=$2', [window.start, window.end]);
  for (const [time, artist, title] of [
    [window.start, 'Beta', 'Song'], ['2026-10-25T01:30Z', 'Alpha', 'Song'],
    ['2026-10-25T02:30Z', ' alpha ', ' song '], [window.end, 'Tomorrow', 'Excluded'],
    ['2026-10-24T22:59Z', 'Before', 'Excluded'],
  ]) {
    const { identity } = observationDecision({}, { artist, title }, new Date());
    await db.query('INSERT INTO radio_history_plays(observed_at,identity,artist,title) VALUES($1,$2,$3,$4)', [time, identity, artist, title]);
  }
  let chart = await readChart(window, db);
  assert.equal(chart.state, 'partial');
  assert.deepEqual(chart.songs.map(s => [s.artist,s.count]), [['Alpha',2],['Beta',1]]);
  await db.query('INSERT INTO radio_history_coverage VALUES($1,$2)', [window.start, window.end]);
  chart = await readChart(window, db);
  assert.equal(chart.state, 'complete'); assert.equal(chart.coverage.seconds, 25 * 3600);
  await db.query('TRUNCATE radio_history_plays');
  assert.equal((await readChart(window, db)).state, 'empty');
  for (const artist of ['Zed','Able']) await db.query('INSERT INTO radio_history_plays(observed_at,identity,artist,title) VALUES($1,$2,$3,$4)', [window.start, JSON.stringify([artist.toLowerCase(),'song']), artist, 'Song']);
  assert.deepEqual((await readChart(window, db)).songs.map(s => s.artist), ['Able','Zed']);
});
