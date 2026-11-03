import pg from 'pg';

const safe = value => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,253}$/.test(value)
  ? value : null;

// Private operator logs only. Fixed classifications and non-secret connection
// identity; never log the URL, credentials, cookies, choices, paths or errors.
export function studioServiceFailure(error, stage, { env = process.env, log = console.error } = {}) {
  if (!['access', 'status', 'recovery', 'catalogue', 'reservation', 'source', 'render', 'commit'].includes(stage)) return;
  const reason = ['42P01', '42703'].includes(error?.code) ? 'missing_schema'
    : error?.code === '42501' ? 'database_permissions'
      : error?.code === 'DATABASE_NOT_CONFIGURED' ? 'database_not_configured'
        : stage === 'source' ? 'source_unavailable'
          : stage === 'render' ? 'render_unavailable' : 'service_unavailable';
  let database = null;
  if (['access', 'status', 'recovery', 'reservation', 'commit'].includes(stage)) {
    try {
      const client = new pg.Client({ connectionString: env.DATABASE_URL });
      database = { host: safe(client.host), name: safe(client.database), port: client.port };
    } catch { /* No raw exceptions or malformed connection text. */ }
  }
  try { log(JSON.stringify({ event: 'studio_service_unavailable', stage, reason,
    runtime: env.VERCEL === '1' ? 'vercel' : 'other', database })); } catch { /* Logging cannot change access. */ }
}
