// Logs contain only an operation and an allowlisted code. Never include errors,
// SQL, query text, filenames, tokens, connection strings or upstream responses.
const codes = new Set([
  '42P01', '42883', '42501', '08006', '08001', '53300', '57014',
  'DATABASE_NOT_CONFIGURED', 'INDEX_NOT_INITIALISED', 'INDEX_INTEGRITY',
  'INDEX_UNAVAILABLE', 'INDEX_EMPTY', 'INDEX_REFRESH_IN_PROGRESS',
  'INDEX_REFRESH_FAILED', 'INDEX_LEASE_LOST', 'INDEX_SIZE', 'INDEX_ENCODING',
  'INDEX_JSON', 'INDEX_FORMAT', 'INDEX_ENTRY', 'INDEX_DUPLICATE',
  'UPSTREAM_STATUS', 'UPSTREAM_SIZE', 'UPSTREAM_EMPTY', 'UPSTREAM_FETCH',
  'PRIVATE_ORIGIN_NOT_CONFIGURED',
]);
const lastLogged = new Map();

export function nameDiagnostic(stage, error) {
  const code = codes.has(error?.code) ? error.code : 'SERVICE_UNAVAILABLE';
  // At most one event per stage/code/minute per instance during an outage.
  // The keys come from fixed internal stages and this allowlist, not visitors.
  stage = ['catalogue', 'limiter'].includes(stage) ? stage : 'search';
  const key = `${stage}:${code}`;
  const now = Date.now();
  if (now - (lastLogged.get(key) || 0) < 60_000) return;
  lastLogged.set(key, now);
  console.warn('[santa-names]', { stage, code });
}
