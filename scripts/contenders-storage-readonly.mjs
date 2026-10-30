// Run ONLY with the existing, securely bound Production environment.
// No application handlers: even the public GET handler writes rate-limit rows.
import pg from 'pg';
import { COMPETITION } from '../src/lib/contenders.js';

const mode = process.argv[2];
if (!['--identify', '--read-only'].includes(mode) || process.argv.length !== 3) {
  console.error('Usage: node scripts/contenders-storage-readonly.mjs --identify|--read-only');
  process.exit(1);
}

const tables = [
  'christmas_contenders_settings', 'christmas_contenders_entries',
  'christmas_contenders_ballots', 'christmas_contenders_notifications',
  'christmas_contenders_limits',
];
const report = { productionTargetVerified: false, realVotingEnabled: false };
let client;
let stage = 'binding';
try {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  // Identifiers only: never username/password, raw URL, query options or secrets.
  report.target = { host: url.hostname, port: url.port || '5432',
    database: decodeURIComponent(url.pathname.slice(1)) };
  report.providerHint = url.hostname.endsWith('.neon.tech') ? 'Neon'
    : /\.supabase\.(co|com)$/.test(url.hostname) ? 'Supabase'
    : url.hostname.endsWith('.rds.amazonaws.com') ? 'AWS RDS'
    : 'unverified — identify the existing resource in its hosting console';
  report.signingMeetsApplicationMinimum = (process.env.SESSION_SECRET?.length || 0) >= 32;
  if (mode === '--read-only') {
    stage = 'connection';
    client = new pg.Client({ connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 7000 });
    await client.connect();
    // PostgreSQL enforces read-only before any diagnostic SELECT is issued.
    await client.query('BEGIN READ ONLY');
    stage = 'metadata';
    report.database = (await client.query(`SELECT current_database() AS database,
      current_schema() AS schema, current_setting('search_path') AS search_path,
      current_setting('transaction_read_only') AS read_only`)).rows[0];
    if (report.database.read_only !== 'on') throw new Error();
    report.tables = (await client.query(`WITH resolved AS (
      SELECT name, to_regclass(name) AS relation FROM unnest($1::text[]) AS name
    ) SELECT name, relation::text AS visible_relation,
      has_table_privilege(relation,'SELECT') AS can_select,
      has_table_privilege(relation,'INSERT') AS can_insert,
      has_table_privilege(relation,'UPDATE') AS can_update,
      has_table_privilege(relation,'DELETE') AS can_delete
      FROM resolved ORDER BY name`, [tables])).rows;
    report.missingTables = report.tables.filter(table => !table.visible_relation).map(table => table.name);
    const settings = report.tables.find(table => table.name === tables[0]);
    if (settings?.visible_relation && settings.can_select) {
      stage = 'competition-settings';
      const row = (await client.query(`SELECT
        settings->>'availability' AS availability,
        settings->>'demoAvailability' AS demo_availability,
        settings->>'opensAt' AS opens_at, settings->>'closesAt' AS closes_at
        FROM christmas_contenders_settings WHERE competition=$1 LIMIT 1`, [COMPETITION])).rows[0];
      report.competitionSettings = { present: Boolean(row),
        availabilityValid: ['scheduled','closed','unavailable'].includes(row?.availability),
        demoAvailabilityValid: ['open','closed','unavailable'].includes(row?.demo_availability),
        datesValid: Boolean(row?.opens_at && row?.closes_at &&
          Number.isFinite(Date.parse(row.opens_at)) &&
          Date.parse(row.opens_at) < Date.parse(row.closes_at)) };
    } else report.competitionSettings = { present: null, reason: 'settings table missing or SELECT denied' };
    report.countingWritePath = 'not exercised; durable counting is not yet proven';
    await client.query('ROLLBACK');
  }
} catch (error) {
  // Raw driver errors may contain credentials, identities or connection URLs.
  report.error = { stage, code: /^[A-Z0-9_]{2,40}$/.test(error.code || '') ? error.code : 'CHECK_FAILED' };
  process.exitCode = 1;
} finally {
  if (client) {
    await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
  }
  console.log(JSON.stringify(report, null, 2));
}
