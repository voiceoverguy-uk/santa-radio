import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { releaseStorageReport } from './workshop-access-preflight.mjs';
import { bindingReport } from './studio-storage-preflight.mjs';

function fixture({ table, code, privilege = true, key = true, rls = false } = {}) {
  const clients = [];
  return {
    clients,
    async connect() {
      const client = {
        queries: [], released: false,
        async query(sql, values) {
          this.queries.push(sql);
          if (code && sql.includes(`FROM public.${table} LIMIT 0`)) {
            throw Object.assign(new Error('PRIVATE CONNECTION DETAILS'), { code });
          }
          if (sql.includes(' AS present')) return { rows: [{
            present: values?.[0] === `public.${table}` ? key : true,
          }] };
          if (sql.includes('FROM unnest($2')) return { rows: [{
            privileges: values?.[0] === `public.${table}` ? privilege : true,
            noRowSecurity: !(values?.[0] === `public.${table}` && rls),
          }] };
          return { rows: [{ privileges: true, uniqueKey: true, attemptDefault: true, noRowSecurity: true }] };
        },
        release() { this.released = true; },
      };
      clients.push(client);
      return client;
    },
  };
}

test('release check covers entry, recording and reporting storage using only read-only metadata probes', async () => {
  const pool = fixture();
  const report = await releaseStorageReport(pool);
  assert.equal(report.ready, true);
  assert.equal(report.entryReady, true);
  assert.equal(report.recordingReady, true);
  assert.equal(report.reportingReady, true);
  assert.equal(pool.clients.length, 3);
  for (const client of pool.clients) {
    assert.equal(client.queries[0], 'BEGIN READ ONLY');
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal(client.released, true);
    assert.ok(client.queries.slice(1, -1).every(sql => sql.trim().startsWith('SELECT')));
  }
  assert.deepEqual(Object.keys(report.generation.checks),
    ['santa_studio_generation_access', 'santa_studio_generation_results']);
  assert.ok(report.reporting.checks.santa_workshop_usage_sessions);
});

test('missing recording tables cannot be mistaken for working Studio just because voucher entry is ready', async () => {
  for (const table of ['santa_studio_generation_access', 'santa_studio_generation_results']) {
    const report = await releaseStorageReport(fixture({ table, code: '42P01' }));
    assert.equal(report.entryReady, true);
    assert.equal(report.recordingReady, false);
    assert.equal(report.ready, false);
    assert.equal(report.generation.reason, 'table_or_columns_missing');
    assert.equal(report.reporting.ready, true);
  }
});

test('optional reporting failures are distinct from mandatory entry and recording readiness', async () => {
  for (const [code, reason] of [['42P01', 'table_or_columns_missing'],
    ['42703', 'table_or_columns_missing'], ['42501', 'database_permissions'], ['08006', 'database_unavailable']]) {
    const report = await releaseStorageReport(fixture({ table: 'santa_workshop_usage_sessions', code }));
    assert.equal(report.entryReady, true);
    assert.equal(report.recordingReady, true);
    assert.equal(report.reportingReady, false);
    assert.equal(report.ready, true);
    assert.equal(report.reporting.reason, reason);
    assert.ok(!JSON.stringify(report).includes('PRIVATE'));
  }
});

test('production recording checks never query optional reporting, including when that table is unavailable', async () => {
  const pool = fixture({ table: 'santa_workshop_usage_sessions', code: '42P01' });
  const report = await releaseStorageReport(pool, { includeReporting: false });
  assert.equal(report.ready, true);
  assert.equal(report.reporting.checked, false);
  assert.equal(pool.clients.length, 2);
  assert.ok(pool.clients.every(client => client.queries.every(sql => !sql.includes('santa_workshop_usage_sessions'))));
});

test('missing permissions, unique keys and row-security assumptions fail readiness', async () => {
  for (const change of [{ privilege: false }, { key: false }, { rls: true }]) {
    const report = await releaseStorageReport(fixture({ table: 'santa_studio_generation_results', ...change }));
    assert.equal(report.recordingReady, false);
    assert.equal(report.ready, false);
  }
});

test('connection failures remain redacted and cannot claim any subsystem is ready', async () => {
  const report = await releaseStorageReport({ connect: async () => { throw new Error('PRIVATE'); } });
  assert.equal(report.entryReady, false);
  assert.equal(report.recordingReady, false);
  assert.equal(report.reportingReady, false);
  assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});

const env = { DATABASE_URL: 'postgres://fixture:private@expected.example/studio',
  VERCEL: '1', VERCEL_ENV: 'production' };
const production = ['--target=vercel-production', '--expected-host=expected.example', '--expected-database=studio'];

test('production labels require the expected binding and a production Vercel runner, not the workspace environment label', () => {
  assert.deepEqual(bindingReport(env), { target: 'workspace', productionBindingVerified: false, valid: true });
  assert.equal(bindingReport(env, production).productionBindingVerified, true);
  for (const changed of [{ ...env, VERCEL: undefined }, { ...env, VERCEL_ENV: 'preview' },
    { ...env, DATABASE_URL: 'postgres://fixture:private@wrong.example/studio' },
    { ...env, DATABASE_URL: 'postgres://fixture:private@expected.example/wrong' },
    { REPLIT_ENVIRONMENT: 'production', DATABASE_URL: env.DATABASE_URL }]) {
    assert.equal(bindingReport(changed, production).valid, false);
  }
  assert.equal(bindingReport(env, ['--target=vercel-production']).valid, false);
  assert.equal(bindingReport(env, ['--target=other']).valid, false);
  assert.ok(!JSON.stringify(bindingReport(env, production)).includes('private'));
});

test('CLI refuses an unverified production target before making database queries', () => {
  const result = spawnSync(process.execPath, ['scripts/workshop-access-preflight.mjs',
    '--database', ...production], { encoding: 'utf8',
    env: { PATH: process.env.PATH, DATABASE_URL: env.DATABASE_URL, REPLIT_ENVIRONMENT: 'production' } });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.liveStorageReadinessVerified, false);
  assert.deepEqual(report.storage, { checked: false, reason: 'target_not_verified' });
});
