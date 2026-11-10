import { createHash, randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { workshopSession } from './santa-workshop-access.js';
import { studioClaimFromRequest, hasPaidStudioAccess } from './santa-studio-purchase.js';
import { liveProduction } from './studio-live-config.js';
import { livePaidPurchaseId } from './studio-live-access.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const problem = message => Object.assign(new Error(message), { status: 409 });

// Called after genuine access verification. Never use a live credential itself
// as the purchase identity: return emails and cookie rotation mint new tokens.
export async function studioAllowanceIdentity(req, {
  visitorSession = workshopSession, production = liveProduction,
  livePurchase = livePaidPurchaseId, sandboxClaim = studioClaimFromRequest,
  sandboxPaid = hasPaidStudioAccess,
} = {}) {
  // Verified purchase identity must win over any old voucher cookie. In
  // particular, an exhausted purchase must not fall through to an unlimited
  // voucher or acquire a fresh per-visitor allowance.
  const live = production();
  const claim = live ? null : sandboxClaim(req);
  const purchase = live ? await livePurchase(req)
    : claim && await sandboxPaid(req) ? claim.sessionId : false;
  if (purchase) return { key: hash(`studio-purchase:${purchase}`), expiresAt: null };
  const visitor = visitorSession(req);
  if (visitor) return visitor.limited
    ? { key: visitor.generationKey, expiresAt: new Date(visitor.expiresAt) } : null;
  throw Object.assign(new Error('Please reopen Studio to confirm your purchase.'), { status: 403 });
}

export const allowanceStatus = row => ({
  limit: 2, successes: row?.operations?.length || 0,
  remaining: 2 - (row?.operations?.length || 0), pending: !!row?.pending,
});

export async function studioAllowanceReady(pool = databasePool()) {
  await pool.query(`SELECT access_key,operations,reservation,operation,reserved_until,expires_at
    FROM public.santa_studio_creation_allowances LIMIT 0`);
  const { rows: [permissions] } = await pool.query(`SELECT
    has_table_privilege(current_user,'public.santa_studio_creation_allowances','SELECT')
    AND has_table_privilege(current_user,'public.santa_studio_creation_allowances','INSERT')
    AND has_table_privilege(current_user,'public.santa_studio_creation_allowances','UPDATE')
    AND has_table_privilege(current_user,'public.santa_studio_creation_allowances','DELETE') AS allowed`);
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
        FROM public.santa_studio_creation_allowances
        WHERE access_key=$1 AND (expires_at IS NULL OR expires_at > clock_timestamp())`, [identity.key]);
      return allowanceStatus(result.rows[0]);
    },
    async reserve(identity, operation) {
      return transaction(async client => {
        await client.query(`DELETE FROM public.santa_studio_creation_allowances WHERE expires_at <= clock_timestamp()`);
        if (identity.expiresAt && +identity.expiresAt <= Date.now()) throw problem('This Studio visit has expired.');
        await client.query(`INSERT INTO public.santa_studio_creation_allowances(access_key,expires_at)
          VALUES($1,$2) ON CONFLICT DO NOTHING`, [identity.key, identity.expiresAt]);
        const { rows: [row] } = await client.query(`SELECT *, reserved_until > clock_timestamp() AS pending
          FROM public.santa_studio_creation_allowances WHERE access_key=$1 FOR UPDATE`, [identity.key]);
        // Replays are NOT re-rendered. With no archive a committed operation
        // can only report its outcome, never manufacture unlimited recordings.
        if (row.operations.includes(operation)) throw problem('This creation already completed. Recordings are not saved; check the open Studio page before starting a different creation.');
        if (row.operations.length >= 2) throw problem('Both creations have been used. Your current recording and gifts can still be downloaded while this page remains open.');
        if (row.pending) throw problem('A message is already being prepared for this access. Please wait and check again.');
        const reservation = randomUUID();
        await client.query(`UPDATE public.santa_studio_creation_allowances SET reservation=$2,
          operation=$3, reserved_until=clock_timestamp()+interval '150 seconds' WHERE access_key=$1`,
        [identity.key, reservation, operation]);
        return reservation;
      });
    },
    async succeed(identity, reservation) {
      const result = await pool.query(`UPDATE public.santa_studio_creation_allowances
        SET operations=array_append(operations,operation), reservation=NULL, operation=NULL, reserved_until=NULL
        WHERE access_key=$1 AND reservation=$2 AND reserved_until > clock_timestamp()
        AND (expires_at IS NULL OR expires_at > clock_timestamp()) AND cardinality(operations)<2
        RETURNING access_key`, [identity.key, reservation]);
      if (!result.rowCount) throw problem('This preparation expired. Check Studio before trying again.');
    },
    async release(identity, reservation) {
      await pool.query(`UPDATE public.santa_studio_creation_allowances SET reservation=NULL,
        operation=NULL,reserved_until=NULL WHERE access_key=$1 AND reservation=$2`, [identity.key, reservation]);
    },
  };
}
let store;
export const studioAllowanceStore = new Proxy({}, {
  get: (_, method) => (...args) => (store ||= createStudioAllowanceStore())[method](...args),
});
