import { databasePool } from './name-request-store.js';

const referencePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function recordDadFailure(identity, reference, failure, pool = databasePool()) {
  const { rows: [row] } = await pool.query(`
    INSERT INTO public.santa_dad_recording_support
      (access_key, reference, failed_attempts, recent_failures, access_expires_at)
    VALUES ($1, $2, 1, jsonb_build_array($3::jsonb), $4)
    ON CONFLICT (access_key) DO UPDATE SET
      failed_attempts = santa_dad_recording_support.failed_attempts + 1,
      last_failure_at = now(),
      recent_failures = (jsonb_build_array($3::jsonb) || santa_dad_recording_support.recent_failures) - 20
    RETURNING reference, failed_attempts
  `, [identity.key, reference, JSON.stringify(failure), identity.expiresAt ?? null]);
  return { reference: row.reference, failedAttempts: row.failed_attempts };
}

export async function dadSupportStatus(identity, pool = databasePool()) {
  const { rows: [row] } = await pool.query(`
    SELECT reference, failed_attempts FROM public.santa_dad_recording_support WHERE access_key=$1
  `, [identity.key]);
  return row ? { reference: row.reference, failedAttempts: row.failed_attempts } : null;
}

export async function dadSupportReport(reference, pool = databasePool()) {
  if (reference && !referencePattern.test(reference)) {
    throw Object.assign(new Error('Enter a valid support reference.'), { status: 400 });
  }
  const { rows } = await pool.query(`
    SELECT s.reference, s.failed_attempts AS "failedAttempts", s.recent_failures AS "recentFailures",
      s.last_failure_at AS "lastFailureAt", s.replacement_recorded_at AS "replacementRecordedAt",
      s.recording_completed_at AS "recordingCompletedAt",
      CASE WHEN s.recording_completed_at IS NOT NULL OR cardinality(a.operations) > 0 THEN 'used'
           WHEN s.access_expires_at <= now() THEN 'expired'
           WHEN a.reserved_until > now() THEN 'preparing'
           ELSE 'available' END AS "creditStatus"
    FROM public.santa_dad_recording_support s
    LEFT JOIN public.santa_dad_creation_allowances a USING (access_key)
    WHERE ($1::uuid IS NULL OR s.reference = $1::uuid)
    ORDER BY s.last_failure_at DESC LIMIT 40
  `, [reference || null]);
  return { cases: rows };
}

export async function recordDadReplacement(reference, pool = databasePool()) {
  if (typeof reference !== 'string' || !referencePattern.test(reference)) {
    throw Object.assign(new Error('Enter a valid support reference.'), { status: 400 });
  }
  const { rowCount } = await pool.query(`
    UPDATE public.santa_dad_recording_support s SET replacement_recorded_at = now()
    WHERE reference = $1 AND replacement_recorded_at IS NULL
      AND (s.recording_completed_at IS NOT NULL OR s.access_expires_at <= now() OR EXISTS (
        SELECT FROM public.santa_dad_creation_allowances a
        WHERE a.access_key = s.access_key AND cardinality(a.operations) > 0
      ))
  `, [reference]);
  if (!rowCount) throw Object.assign(new Error('The credit is still available, or a replacement is already recorded.'), { status: 409 });
  return dadSupportReport(reference, pool);
}
