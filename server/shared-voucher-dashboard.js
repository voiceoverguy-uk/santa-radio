import { createHash, randomBytes } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { sharedVoucherMatches } from './friend-vouchers.js';

const POOL_SIZE = 10;
const visibleVouchers = `
  SELECT v.shared_code AS code, v.shared_copied_at AS "copiedAt", v.redeemed_at AS "redeemedAt",
    CASE WHEN v.redeemed_at <= now() - interval '720 hours' THEN 0 ELSE
      GREATEST(0, 2 - COALESCE(cardinality(a.operations),0) - COALESCE(cardinality(d.operations),0))
    END AS remaining,
    COALESCE(a.dad_completed,false) OR COALESCE(cardinality(d.operations),0) > 0 AS "dadUsed"
  FROM public.santa_fixed_gift_vouchers v
  LEFT JOIN public.santa_studio_creation_allowances a
    ON a.access_key = encode(sha256(convert_to('friend-voucher:gift-' || v.code_sha256,'UTF8')), 'hex')
  LEFT JOIN public.santa_dad_creation_allowances d
    ON d.access_key = encode(sha256(convert_to('dad-voucher:gift-' || v.code_sha256,'UTF8')), 'hex')
  WHERE v.shared_code IS NOT NULL AND (
    v.redeemed_at IS NULL OR (
      v.redeemed_at > now() - interval '744 hours' AND (
        COALESCE(cardinality(a.operations),0) + COALESCE(cardinality(d.operations),0) < 2
        OR COALESCE(a.last_completed_at, v.redeemed_at) > now() - interval '24 hours'
      )
    )
  )
  ORDER BY v.redeemed_at IS NOT NULL, v.shared_copied_at IS NOT NULL, v.redeemed_at DESC, v.shared_code`;

export async function listSharedVouchers(pool = databasePool()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(731926151)');
    const {rows} = await client.query(visibleVouchers);
    if (rows.length < POOL_SIZE) {
      for (let i = rows.length; i < POOL_SIZE; i++) {
        const code = 'SANTA-GIFT-' + randomBytes(10).toString('hex').toUpperCase().match(/.{5}/g).join('-');
        const hash = createHash('sha256').update(code).digest('hex');
        await client.query(`INSERT INTO public.santa_fixed_gift_vouchers(code_sha256, valid_until, shared_code)
          VALUES($1, 'infinity', $2)`, [hash, code]);
      }
    }
    const vouchers = rows.length < POOL_SIZE ? (await client.query(visibleVouchers)).rows : rows;
    await client.query('COMMIT');
    return { vouchers };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function copySharedVoucher(code, pool) {
  if (typeof code !== 'string' || !sharedVoucherMatches(code)) return {status: 400, error: 'Enter a shared voucher code.'};
  const {rows: [row]} = await (pool ?? databasePool()).query(`
    WITH voucher AS (
      SELECT code_sha256, shared_copied_at FROM public.santa_fixed_gift_vouchers
      WHERE shared_code=$1 AND redeemed_at IS NULL FOR UPDATE
    )
    UPDATE public.santa_fixed_gift_vouchers v
      SET shared_copied_at=COALESCE(v.shared_copied_at, clock_timestamp()) FROM voucher
      WHERE v.code_sha256=voucher.code_sha256
      RETURNING v.shared_copied_at AS "copiedAt", voucher.shared_copied_at IS NOT NULL AS "alreadyCopied"`, [code]);
  return row ?? {status: 409, error: 'This voucher is no longer available.'};
}
