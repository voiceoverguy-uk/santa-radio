import { databasePool, recordNameRequest } from './name-request-store.js';
import { normaliseRequestedName } from '../src/lib/santaNameRequests.js';
import { recordingUploadName } from '../src/lib/recordingUploadName.js';

export async function completeUploadedName(name, { pool = databasePool(), complete = recordNameRequest } = {}) {
  const requested = normaliseRequestedName(recordingUploadName(name));
  if (!requested) return { status: 'complete', requests: 0 };
  // Preserve accents and spelling; only equate whitespace and hyphens.
  const { rows } = await pool.query(`SELECT request_key FROM santa_name_requests
    WHERE recorded_at IS NULL AND dismissed_at IS NULL
    AND regexp_replace(request_key, '[[:space:]]+', '-', 'g') = $1`, [requested.key]);
  let count = 0;
  for (const row of rows) {
    try { await complete(row.request_key, new Date(), pool); count++; }
    catch (error) { if (![400, 404].includes(error.status)) throw error; }
  }
  return { status: 'complete', requests: count };
}
