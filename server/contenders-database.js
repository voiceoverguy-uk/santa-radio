import pg from 'pg';
let pool;
// Dedicated Neon binding: never fall back to the legacy payment/name database.
export function databasePool() {
  const connectionString = process.env.CONTENDERS_DATABASE_URL || process.env.CONTENDERS_URL;
  if (!connectionString) throw Object.assign(new Error('Voting database is not configured'), { code: 'CONTENDERS_DATABASE_NOT_CONFIGURED' });
  return pool ||= new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, statement_timeout: 8000, query_timeout: 10000 });
}
