// Fixed schema probes only: no records, credentials, setup or migrations.
const tables = {
  generation: [
    {
      name: 'santa_studio_generation_access',
      columns: 'access_key, successes, locked_identity, latest_choices, reservation, operation, request_hash, reserved_until',
      privileges: ['SELECT', 'INSERT', 'UPDATE'],
      keys: [['access_key']],
    },
    {
      name: 'santa_studio_generation_results',
      columns: 'access_key, operation, request_hash, sequence, audio, created_at',
      privileges: ['SELECT', 'INSERT'],
      keys: [['access_key', 'operation'], ['access_key', 'sequence']],
    },
  ],
  reporting: [{
    name: 'santa_workshop_usage_sessions',
    columns: 'access_key, code_id, entry_kind, created_at',
    privileges: ['SELECT', 'INSERT'],
    keys: [['access_key']],
  }],
};

function failureReason(error) {
  return ['42P01', '42703'].includes(error?.code) ? 'table_or_columns_missing'
    : error?.code === '42501' ? 'database_permissions' : 'database_unavailable';
}

async function checkComponent(pool, specs) {
  let client;
  const checks = {};
  try {
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    for (const table of specs) {
      // All identifiers come exclusively from the fixed definitions above.
      await client.query(`SELECT ${table.columns} FROM public.${table.name} LIMIT 0`);
      const name = `public.${table.name}`;
      const { rows: [permissions] } = await client.query(`SELECT
        bool_and(has_table_privilege(current_user, $1, privilege)) AS privileges,
        NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass($1)) AS "noRowSecurity"
        FROM unnest($2::text[]) AS privilege`, [name, table.privileges]);
      checks[table.name] = { columns: true, privileges: permissions?.privileges === true,
        noRowSecurity: permissions?.noRowSecurity === true };
      for (const [index, columns] of table.keys.entries()) {
        const { rows: [key] } = await client.query(`SELECT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid=to_regclass($1) AND i.indisunique AND i.indisvalid
            AND i.indimmediate AND i.indpred IS NULL AND i.indexprs IS NULL
            AND ARRAY(
              SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
              WHERE k.ord<=i.indnkeyatts ORDER BY k.ord
            )=$2::text[]
        ) AS present`, [name, columns]);
        checks[table.name][`uniqueKey${index + 1}`] = key?.present === true;
      }
    }
    return { checked: true, ready: Object.values(checks).every(table =>
      Object.values(table).every(value => value === true)), checks };
  } catch (error) {
    return { checked: true, ready: false, reason: failureReason(error) };
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }
}

export async function checkStudioStorage(pool, { includeReporting = true } = {}) {
  // Separate read-only transactions keep a missing reporting table from
  // masking whether mandatory recording storage is available, and vice versa.
  const generation = await checkComponent(pool, tables.generation);
  const reporting = includeReporting ? await checkComponent(pool, tables.reporting)
    : { checked: false, ready: false, reason: 'optional_collection_disabled' };
  return { generation, reporting };
}

export function bindingReport(env, args = []) {
  const requested = args.find(arg => arg.startsWith('--target='))?.slice(9) || 'workspace';
  if (!['workspace', 'vercel-production'].includes(requested)) {
    return { target: 'unknown', productionBindingVerified: false, valid: false };
  }
  let matched = false;
  try {
    const url = new URL(env.DATABASE_URL);
    const expectedHost = args.find(arg => arg.startsWith('--expected-host='))?.slice(16);
    const expectedDatabase = args.find(arg => arg.startsWith('--expected-database='))?.slice(20);
    matched = !!expectedHost && !!expectedDatabase
      && url.hostname === expectedHost && decodeURIComponent(url.pathname.slice(1)) === expectedDatabase;
  } catch { /* Missing or malformed configuration is not verified. */ }
  const verified = requested === 'vercel-production'
    && env.VERCEL === '1' && env.VERCEL_ENV === 'production' && matched;
  return { target: requested, productionBindingVerified: verified,
    valid: requested === 'workspace' || verified };
}
