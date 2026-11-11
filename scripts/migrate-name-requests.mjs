// Additive, release-time migration. Never changes schema from a visitor request.
import pg from 'pg';
import { readFile } from 'node:fs/promises';

if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL) throw new Error('Name-request migration requires DATABASE_URL');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('santa-name-requests-schema'))");
    const schema = await readFile(new URL('../database/santa-name-requests.sql', import.meta.url), 'utf8');
    await client.query(schema);
    await client.query('SELECT request_key, recorded_at FROM santa_name_requests LIMIT 0');
    await client.query('SELECT id, recording_suggestions FROM santa_name_request_history LIMIT 0');
    await client.query('SELECT request_key FROM santa_name_recording_suggestions LIMIT 0');
    await client.query('COMMIT');
    console.log('Name-request schema verified; existing requests preserved.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Name-request schema migration failed', { code: error.code || 'UNEXPECTED' });
    process.exitCode = 1;
  } finally { await client.end(); }
} else {
  console.log('Name-request production migration skipped outside production.');
}
