import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import { studioStorageDiagnostic } from '../server/studio-storage-diagnostic.js';
import usageApp, { createWorkshopUsageHandler } from '../server/santa-workshop-usage.js';

const env = {
  DATABASE_URL: 'postgres://private-user:PRIVATE-PASSWORD@expected.example:5433/studio?application_name=PRIVATE-QUERY',
  VERCEL: '1', VERCEL_ENV: 'production', VERCEL_URL: 'test-deployment.example',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
};
function fixture(failure) {
  const sql = [];
  const client = {
    released: false,
    async query(query, values) {
      sql.push(query);
      if (failure && query.startsWith('SELECT')) {
        throw Object.assign(new Error(env.DATABASE_URL), { code: failure });
      }
      if (query.includes('current_database')) return { rows: [{ database: 'actual-bound-database' }] };
      if (query.includes('FROM unnest')) return { rows: values[0].map((name, index) => ({
        table_name: name, present: index !== 2, read: true, insert: false, update: false, delete: false,
        // Must never leak fields accidentally added to a driver result.
        password: 'PRIVATE-DRIVER-FIELD',
      })) };
      return { rows: [] };
    },
    release() { this.released = true; },
  };
  return { sql, client, connect: async () => client };
}
test('diagnostic reads actual identity and all table metadata without reading records or emitting credentials', async () => {
  const pool = fixture();
  let readinessCalls = 0;
  const result = await studioStorageDiagnostic({ env, pool, readiness: async p => {
    assert.equal(p, pool); readinessCalls++; return { checked: true, ready: false };
  } });
  assert.equal(readinessCalls, 1);
  assert.equal(result.runtime.host, 'vercel');
  assert.equal(result.runtime.environment, 'production');
  assert.equal(result.database.host, 'expected.example');
  assert.equal(result.database.port, 5433);
  assert.equal(result.database.name, 'actual-bound-database');
  assert.equal(result.database.connected, true);
  assert.equal(result.tables.length, 4);
  assert.equal(result.tables[2].present, false);
  assert.equal(result.tables[0].permissions.insert, false);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.ok(!JSON.stringify(result).includes('private-user'));
  assert.equal(pool.sql[0], 'BEGIN READ ONLY');
  assert.equal(pool.sql.at(-1), 'ROLLBACK');
  assert.ok(pool.sql.slice(1, -1).every(sql => sql.startsWith('SELECT')));
  assert.ok(!pool.sql.some(sql => /FROM public\./.test(sql)));
  assert.equal(pool.client.released, true);
});
test('driver query overrides are reflected, not mistaken for the URL hostname', async () => {
  const result = await studioStorageDiagnostic({
    env: { DATABASE_URL: 'postgres://fixture:PRIVATE@ignored.example/studio?host=effective.example&port=5434' },
    pool: fixture(), readiness: async () => ({ checked: true, ready: true }),
  });
  assert.equal(result.database.host, 'effective.example');
  assert.equal(result.database.port, 5434);
  assert.equal(result.runtime.environment, 'development');
  assert.equal(result.runtime.host, 'other');
});
test('missing configuration, missing metadata privileges and outages are explicit, redacted and never mutate storage', async () => {
  let connections = 0;
  const absent = await studioStorageDiagnostic({ env: {}, pool: { connect() { connections++; } } });
  assert.equal(connections, 0);
  assert.equal(absent.database.reason, 'database_not_configured');
  for (const [code, reason] of [['42501', 'database_permissions'], ['08006', 'database_unavailable']]) {
    const pool = fixture(code);
    const result = await studioStorageDiagnostic({ env, pool,
      readiness: async () => assert.fail('Do not repeat failed connection checks') });
    assert.equal(result.database.reason, reason);
    assert.equal(result.database.connected, false);
    assert.equal(result.storage.checked, false);
    assert.equal(pool.sql.at(-1), 'ROLLBACK');
    assert.equal(pool.client.released, true);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
});
async function serve(app, run) {
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}
test('real staff middleware rejects anonymous and voucher-only diagnostic requests', async () => {
  await serve(usageApp, async url => {
    for (const cookie of ['', 'santa-workshop-preview=not-staff']) {
      const response = await fetch(`${url}?diagnostic=recording-storage`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal((await response.json()).database, undefined);
    }
  });
});
test('diagnostic requires approved staff, rejects unsupported/cross-site requests and never invokes the usage reader', async () => {
  for (const allowed of [401, 403, 200]) {
    let checks = 0;
    const app = express();
    app.use(createWorkshopUsageHandler({ checkAdmin: async () => allowed,
      diagnose: async () => { checks++; return { kind: 'fixture-diagnostic' }; },
      read: async () => assert.fail('Diagnostic must not read usage records') }));
    await serve(app, async url => {
      const response = await fetch(`${url}?diagnostic=recording-storage`);
      assert.equal(response.status, allowed);
      assert.equal(checks, allowed === 200 ? 1 : 0);
      assert.match(response.headers.get('cache-control'), /private, no-store/);
      if (allowed === 200) {
        assert.equal((await response.json()).kind, 'fixture-diagnostic');
        assert.equal((await fetch(`${url}?diagnostic=recording-storage`,
          { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
        assert.equal((await fetch(`${url}?diagnostic=unknown`)).status, 400);
        assert.equal((await fetch(`${url}?diagnostic=recording-storage`, { method: 'POST' })).status, 405);
        assert.equal(checks, 1);
      }
    });
  }
});
