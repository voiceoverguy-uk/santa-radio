import { randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';
const problem = message => Object.assign(new Error(message), {status:409});
export const allowanceStatus = row => ({
  limit: 1, successes: row?.operations?.length || 0,
  remaining: 1 - (row?.operations?.length || 0), pending: !!row?.pending,
});

export async function studioAllowanceReady(pool = databasePool()) {
  await pool.query(`SELECT access_key,operations,reservation,operation,reserved_until,expires_at
    FROM public.santa_dad_creation_allowances LIMIT 0`);
  const { rows: [permissions] } = await pool.query(`SELECT
    has_table_privilege(current_user,'public.santa_dad_creation_allowances','SELECT')
    AND has_table_privilege(current_user,'public.santa_dad_creation_allowances','INSERT')
    AND has_table_privilege(current_user,'public.santa_dad_creation_allowances','UPDATE')
    AND has_table_privilege(current_user,'public.santa_dad_creation_allowances','DELETE') AS allowed`);
  if (!permissions?.allowed) throw new Error('STUDIO_ALLOWANCE_STORAGE_PERMISSIONS_REQUIRED');
}

// Deliberately separate from the retired generation/archive store. One row:
// opaque identity, at most two opaque operation IDs, one fenced lease, expiry.
// No recipient, choice, audio, gift, download or recovery data.
export function createStudioAllowanceStore(pool = databasePool()) {
  const transaction = async work => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  };
  return {
    async status(identity) {
      const result = await pool.query(`SELECT operations, reserved_until > clock_timestamp() AS pending
        FROM public.santa_dad_creation_allowances
        WHERE access_key=$1 AND (expires_at IS NULL OR expires_at > clock_timestamp())`, [identity.key]);
      return allowanceStatus(result.rows[0]);
    },
    async reserve(identity, operation) {
      const expiresAt = identity.expiresAt == null ? null : new Date(identity.expiresAt);
      return transaction(async client => {
        await client.query(`DELETE FROM public.santa_dad_creation_allowances WHERE expires_at <= clock_timestamp()`);
        if (expiresAt && +expiresAt <= Date.now()) throw problem('This Studio visit has expired.');
        await client.query(`INSERT INTO public.santa_dad_creation_allowances(access_key,expires_at)
          VALUES($1,$2) ON CONFLICT DO NOTHING`, [identity.key, expiresAt]);
        const { rows: [row] } = await client.query(`SELECT *, reserved_until > clock_timestamp() AS pending
          FROM public.santa_dad_creation_allowances WHERE access_key=$1 FOR UPDATE`, [identity.key]);
        // Replays are NOT re-rendered. With no archive a committed operation
        // can only report its outcome, never manufacture unlimited recordings.
        if (row.operations.includes(operation)) throw problem('This creation already completed. Recordings are not saved; check the open Studio page before starting a different creation.');
        if (row.operations.length >= 1) throw problem('Your creation has been used. Your current recording can still be downloaded while this page remains open.');
        if (row.pending) throw problem('A message is already being prepared for this access. Please wait and check again.');
        const reservation = randomUUID();
        await client.query(`UPDATE public.santa_dad_creation_allowances SET reservation=$2,
          operation=$3, reserved_until=clock_timestamp()+interval '150 seconds' WHERE access_key=$1`,
        [identity.key, reservation, operation]);
        return reservation;
      });
    },
    async succeed(identity, reservation) {
      const result = await pool.query(`
        WITH completed AS (
          UPDATE public.santa_dad_creation_allowances
          SET operations=array_append(operations,operation), reservation=NULL, operation=NULL, reserved_until=NULL
          WHERE access_key=$1 AND reservation=$2 AND reserved_until > clock_timestamp()
          AND (expires_at IS NULL OR expires_at > clock_timestamp()) AND cardinality(operations)<1
          RETURNING access_key
        ), support AS (
          UPDATE public.santa_dad_recording_support s
          SET recording_completed_at=now()
          FROM completed c WHERE s.access_key=c.access_key
        )
        SELECT access_key FROM completed
      `, [identity.key, reservation]);
      if (!result.rowCount) throw problem('This preparation expired. Check Studio before trying again.');
    },
    async release(identity, reservation) {
      await pool.query(`UPDATE public.santa_dad_creation_allowances SET reservation=NULL,
        operation=NULL,reserved_until=NULL WHERE access_key=$1 AND reservation=$2`, [identity.key, reservation]);
    },
  };
}
let store;
export const studioAllowanceStore = new Proxy({}, {
  get: (_, method) => (...args) => (store ||= createStudioAllowanceStore())[method](...args),
});
