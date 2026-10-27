import { pathToFileURL } from 'node:url';
import { workshopSettings, workshopConfigurationChecks, workshopConfigured } from '../server/santa-workshop-settings.js';
import { databasePool } from '../server/name-request-store.js';

export function configurationReport(env = process.env, now = Date.now()) {
  const config = workshopSettings(env);
  return {
    checks: workshopConfigurationChecks(config),
    slots: Array.from({ length: 5 }, (_, index) => ({
      slot: index + 1,
      active: config.codes.some(entry => entry.id === String(index + 1)),
    })),
    approvedDeadline: config.expiresAt === Date.parse('2026-11-30T23:59:59Z'),
    testOpen: Number.isSafeInteger(config.expiresAt) && config.expiresAt > now,
    configured: workshopConfigured(config),
  };
}

export async function storageReport(pool) {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    // Check the actual columns without reading limiter records.
    await client.query('SELECT bucket_key, attempts, expires_at FROM santa_name_request_limits LIMIT 0');
    const { rows } = await client.query(`
      SELECT
        has_table_privilege(current_user, 'santa_name_request_limits', 'SELECT')
        AND has_table_privilege(current_user, 'santa_name_request_limits', 'INSERT')
        AND has_table_privilege(current_user, 'santa_name_request_limits', 'UPDATE')
        AND has_table_privilege(current_user, 'santa_name_request_limits', 'DELETE') AS privileges,
        EXISTS (
          SELECT 1 FROM pg_index i JOIN pg_attribute a
            ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
          WHERE i.indrelid='santa_name_request_limits'::regclass
            AND i.indisunique AND i.indisvalid AND i.indimmediate
            AND i.indnkeyatts=1 AND i.indpred IS NULL AND a.attname='bucket_key'
        ) AS "uniqueKey",
        EXISTS (
          SELECT 1 FROM pg_attribute a JOIN pg_attrdef d
            ON a.attrelid=d.adrelid AND a.attnum=d.adnum
          WHERE a.attrelid='santa_name_request_limits'::regclass
            AND a.attname='attempts' AND pg_get_expr(d.adbin,d.adrelid)='1'
        ) AS "attemptDefault",
        NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid='santa_name_request_limits'::regclass) AS "noRowSecurity"
    `);
    const checks = rows[0];
    return { checked: true, ready: Object.values(checks).every(value => value === true), checks };
  } catch (error) {
    const reason = ['42P01', '42703'].includes(error.code) ? 'table_or_columns_missing'
      : error.code === '42501' ? 'database_permissions'
        : 'database_unavailable';
    return { checked: true, ready: false, reason };
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }
}

async function main() {
  const report = configurationReport();
  let pool;
  if (process.argv.includes('--database')) {
    if (!process.env.DATABASE_URL) report.storage = { checked: true, ready: false, reason: 'database_not_configured' };
    else {
      try {
        pool = databasePool();
        report.storage = await storageReport(pool);
      } catch {
        report.storage = { checked: true, ready: false, reason: 'database_unavailable' };
      } finally { await pool?.end().catch(() => {}); }
    }
  } else report.storage = { checked: false };
  console.log(JSON.stringify(report, null, 2));
  if (!report.configured || !report.approvedDeadline || !report.testOpen
    || (report.storage.checked && !report.storage.ready)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
