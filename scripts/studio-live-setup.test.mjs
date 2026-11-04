import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { userInfo } from 'node:os';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';

const execute = promisify(execFile);
const script = 'scripts/setup-studio-live.mjs';

test('development schema setup rejects ambiguous invocation and all deployed runtimes before connecting', async () => {
  const base = { ...process.env, NODE_ENV: 'development', VERCEL: '', REPLIT_DEPLOYMENT: '', DATABASE_URL: 'postgresql://invalid.invalid/never-connect' };
  for (const [args, overrides] of [
    [[], {}],
    [['--development', '--production'], {}],
    [['--development'], { NODE_ENV: 'production' }],
    [['--development'], { VERCEL: '1' }],
    [['--development'], { REPLIT_DEPLOYMENT: '1' }],
  ]) {
    await assert.rejects(execute(process.execPath, [script, ...args], { env: { ...base, ...overrides }, timeout: 5000 }),
      error => /development-only/.test(error.stderr));
  }
});

test('post-merge development setup creates its schema idempotently without changing existing sales settings', async () => {
  const database = await studioTestDatabase({ loadSchema: false });
  try {
    const url = new URL('postgresql://localhost/postgres');
    url.username = userInfo().username;
    url.searchParams.set('host', database.socket);
    url.searchParams.set('sslmode', 'disable');
    const env = { ...process.env, NODE_ENV: 'development', VERCEL: '', REPLIT_DEPLOYMENT: '',
      REPLIT_ENVIRONMENT: 'production', DATABASE_URL: url.toString() };
    await execute(process.execPath, [script, '--development'], { env, timeout: 15000 });
    assert.equal((await database.pool.query("SELECT enabled FROM public.santa_studio_live_sales_settings WHERE key='public'")).rows[0].enabled, false);
    await database.pool.query("UPDATE public.santa_studio_live_sales_settings SET enabled=true WHERE key='public'");
    await execute(process.execPath, [script, '--development'], { env, timeout: 15000 });
    assert.equal((await database.pool.query("SELECT enabled FROM public.santa_studio_live_sales_settings WHERE key='public'")).rows[0].enabled, true,
      'Repeating development setup must not silently change the durable sales switch');
    const tables = await database.pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'santa_studio_live_%'");
    assert.equal(tables.rows.length, 10);
  } finally { await database.close(); }
});
