import { createHash, randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';

const DAY_MS = 24 * 60 * 60_000;
const RETRY_MS = 60_000;
const LEASE_MS = 30_000; // Origin reads have a hard ten-second timeout.
const metadataSql = `version, record_count, refreshed_at, next_refresh_at, retry_after,
  lease_until, last_attempt_at, last_error`;
const milliseconds = value => value ? new Date(value).getTime() : 0;
const hintFor = row => ({ version: row.version,
  nextRefreshAt: milliseconds(row.next_refresh_at), retryAfter: milliseconds(row.retry_after) });
const unavailable = code => Object.assign(new Error('Private recorded-name index unavailable.'), { code });

// This module is server-only. It never returns payloads through an HTTP route.
// All queries use the existing private database, not an external cache service.
export function createNameSnapshotStore({ pool = databasePool, now = Date.now, parse, fetchIndex,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let cached = null;
  const read = async () => {
    const result = await pool().query(`SELECT ${metadataSql},
      CASE WHEN version IS DISTINCT FROM $1 THEN payload ELSE NULL END AS payload
      FROM santa_name_catalogue WHERE catalogue_key='recorded-names'`, [cached?.version || null]);
    const row = result.rows[0];
    if (!row) throw unavailable('INDEX_NOT_INITIALISED');
    if (row.payload != null) {
      const bytes = Buffer.from(row.payload);
      if (createHash('sha256').update(bytes).digest('hex') !== row.version) throw unavailable('INDEX_INTEGRITY');
      const records = parse(bytes);
      if (!records.length || records.length !== row.record_count) throw unavailable('INDEX_INTEGRITY');
      cached = { version: row.version, records };
    }
    return row;
  };

  const status = async () => {
    const result = await pool().query(`SELECT ${metadataSql} FROM santa_name_catalogue
      WHERE catalogue_key='recorded-names'`);
    const row = result.rows[0];
    if (!row) throw unavailable('INDEX_NOT_INITIALISED');
    return {
      available: Boolean(row.version), total: row.record_count || 0,
      refreshedAt: row.refreshed_at, nextRefreshAt: row.next_refresh_at,
      refreshing: milliseconds(row.lease_until) > now(),
      retryAfter: row.retry_after, lastAttemptAt: row.last_attempt_at, lastError: row.last_error,
    };
  };

  const refresh = async ({ force = false } = {}) => {
    const owner = randomUUID();
    const timestamp = new Date(now());
    const claimed = await pool().query(`UPDATE santa_name_catalogue SET lease_token=$1,
      lease_until=$2, last_attempt_at=$3
      WHERE catalogue_key='recorded-names'
        AND (lease_until IS NULL OR lease_until <= $3)
        AND ($4 OR retry_after IS NULL OR retry_after <= $3)
        AND ($4 OR version IS NULL OR next_refresh_at <= $3)
      RETURNING lease_token`, [owner, new Date(now() + LEASE_MS), timestamp, force]);
    if (!claimed.rowCount) return { published: false, reason: 'fresh-or-refresh-in-progress' };
    try {
      const bytes = Buffer.from(await fetchIndex());
      const records = parse(bytes); // Full validation BEFORE publishing anything.
      if (!records.length) throw unavailable('INDEX_EMPTY');
      const version = createHash('sha256').update(bytes).digest('hex');
      const published = await pool().query(`UPDATE santa_name_catalogue SET
        payload=$1, version=$2, record_count=$3, refreshed_at=$4, next_refresh_at=$5,
        lease_token=NULL, lease_until=NULL, retry_after=NULL, last_error=NULL
        WHERE catalogue_key='recorded-names' AND lease_token=$6 AND lease_until > $4
        RETURNING version`, [bytes.toString('utf8'), version, records.length, new Date(now()),
        new Date(now() + DAY_MS), owner]);
      if (!published.rowCount) throw unavailable('INDEX_LEASE_LOST');
      cached = { version, records };
      return { published: true, total: records.length };
    } catch (error) {
      // Generic bounded codes only: no paths, upstream bodies or credentials.
      const code = /^(INDEX_[A-Z_]+|UPSTREAM_[A-Z_]+)$/.test(error.code || '') ? error.code : 'INDEX_REFRESH_FAILED';
      await pool().query(`UPDATE santa_name_catalogue SET lease_token=NULL, lease_until=NULL,
        retry_after=$1, last_error=$2 WHERE catalogue_key='recorded-names' AND lease_token=$3`,
      [new Date(now() + RETRY_MS), code, owner]);
      throw unavailable(code);
    }
  };

  const load = async hint => {
    // Search/count get trusted metadata from the SAME atomic limiter call.
    // No freshness query is added to a warm typed-search request.
    let metadata = hint && cached?.version === hint.version ? hint : hintFor(await read());
    if (metadata.nextRefreshAt > now() || metadata.retryAfter > now()) {
      if (cached && cached.version === metadata.version) return cached.records;
      throw unavailable('INDEX_UNAVAILABLE');
    }
    try { await refresh(); }
    catch (error) {
      if (cached && cached.version === metadata.version) return cached.records;
      throw error;
    }
    // The winning instance caches the published version. Other instances read
    // it once; cold bootstrap waits are bounded, never detached background work.
    for (let attempt = 0; attempt < 9; attempt++) {
      metadata = hintFor(await read());
      if (cached && cached.version === metadata.version) return cached.records;
      if (attempt < 8) await sleep(250);
    }
    throw unavailable('INDEX_REFRESH_IN_PROGRESS');
  };
  return { load, refresh, status };
}
