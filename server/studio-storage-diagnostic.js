import { databasePool } from './name-request-store.js';
import { releaseStorageReport } from '../scripts/workshop-access-preflight.mjs';
import pg from 'pg';

const tableNames = [
  'santa_name_request_limits', 'santa_studio_generation_access',
  'santa_studio_generation_results', 'santa_workshop_usage_sessions',
];
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,253}$/.test(value)
  ? value : null;

function runtime(env) {
  return {
    host: env.VERCEL === '1' ? 'vercel' : env.REPL_ID ? 'replit' : 'other',
    environment: env.VERCEL === '1'
      ? ['production', 'preview', 'development'].includes(env.VERCEL_ENV) ? env.VERCEL_ENV : 'unknown'
      : env.REPLIT_DEPLOYMENT === '1' ? 'production' : 'development',
    deployment: env.VERCEL === '1' ? identifier(env.VERCEL_URL) : null,
    commit: /^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA || '') ? env.VERCEL_GIT_COMMIT_SHA : null,
  };
}

const reason = error => ['42P01', '42703'].includes(error?.code) ? 'table_or_columns_missing'
  : error?.code === '42501' ? 'database_permissions' : 'database_unavailable';

export async function studioStorageDiagnostic({
  env = process.env, pool, readiness = releaseStorageReport, includeReporting = true,
} = {}) {
  const inspectedTables = includeReporting ? tableNames : tableNames.filter(name => name !== 'santa_workshop_usage_sessions');
  const result = {
    kind: 'studio-storage-diagnostic',
    checkedAt: new Date().toISOString(),
    runtime: runtime(env),
    database: { configured: !!env.DATABASE_URL, connected: false, host: null, name: null },
    tables: [],
    storage: { checked: false, ready: false },
  };
  if (!env.DATABASE_URL) {
    result.database.reason = 'database_not_configured';
    return result;
  }
  try {
    // Use the same driver's effective connection parsing, including query
    // overrides. Never return the URL, connection options or credentials.
    const connection = new pg.Client({ connectionString: env.DATABASE_URL });
    result.database.host = identifier(connection.host);
    result.database.port = Number.isInteger(connection.port) ? connection.port : null;
  } catch {
    result.database.reason = 'invalid_database_configuration';
    return result;
  }
  let client;
  try {
    pool ||= databasePool();
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    const identity = await client.query('SELECT current_database() AS database');
    const metadata = await client.query(`SELECT table_name,
      to_regclass('public.' || table_name) IS NOT NULL AS present,
      has_table_privilege(current_user, to_regclass('public.' || table_name), 'SELECT') AS read,
      has_table_privilege(current_user, to_regclass('public.' || table_name), 'INSERT') AS insert,
      has_table_privilege(current_user, to_regclass('public.' || table_name), 'UPDATE') AS update,
      has_table_privilege(current_user, to_regclass('public.' || table_name), 'DELETE') AS delete
      FROM unnest($1::text[]) AS table_name`, [inspectedTables]);
    result.database.connected = true;
    result.database.name = identifier(identity.rows[0]?.database);
    // Whitelist both tables and fields. Never return driver objects or records.
    result.tables = inspectedTables.map(name => {
      const row = metadata.rows.find(item => item.table_name === name);
      return { name, present: row?.present === true, permissions: Object.fromEntries(
        ['read', 'insert', 'update', 'delete'].map(key => [key, row?.[key] === true])) };
    });
  } catch (error) {
    result.database.reason = reason(error);
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }
  if (result.database.connected) {
    try { result.storage = await readiness(pool, { includeReporting }); }
    catch { result.storage = { checked: true, ready: false, reason: 'database_unavailable' }; }
  }
  return result;
}
