import { databasePool } from './name-request-store.js';

export async function markVoucherCopied(view, code, pool = databasePool()) {
  const dad = view === 'dad-vouchers';
  const format = dad ? /^DAD-[A-F0-9]{10}-[A-F0-9]{10}$/ : /^FRIEND-[A-F0-9]{10}-[A-F0-9]{10}$/;
  if ((!dad && view !== 'friends') || typeof code !== 'string' || !format.test(code)) {
    return { status: 400, error: 'Choose a voucher from this list.' };
  }

  const table = dad ? 'public.santa_dad_vouchers' : 'public.santa_friend_vouchers';
  const first = await pool.query(`UPDATE ${table} SET copied_at = clock_timestamp()
    WHERE code = $1 AND redeemed_at IS NULL AND copied_at IS NULL RETURNING copied_at AS "copiedAt"`, [code]);
  if (first.rows.length) return { copiedAt: first.rows[0].copiedAt, alreadyCopied: false };

  const saved = await pool.query(`SELECT copied_at AS "copiedAt" FROM ${table}
    WHERE code = $1 AND redeemed_at IS NULL`, [code]);
  if (saved.rows[0]?.copiedAt) return { copiedAt: saved.rows[0].copiedAt, alreadyCopied: true };
  return { status: 409, error: 'This voucher is no longer available to send. Choose another code.' };
}
