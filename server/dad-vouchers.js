import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { claimFixedGift, friendClaim, sharedVoucherMatches } from './friend-vouchers.js';
const COOKIE = 'santa-dad-voucher';
const MONTH = 30 * 86400000;
const digest = value => createHash('sha256').update(value).digest('hex');
const sign = (value, key) => createHmac('sha256', key).update(`dad-voucher:v1:${value}`).digest('base64url');
export function dadVoucherSession(req, key = process.env.SESSION_SECRET, now = Date.now()) {
  if (typeof key !== 'string' || key.length < 32) return null;
  const raw = req.headers?.cookie || '';
  if (raw.length > 16384) return null;
  const cookies = raw.split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
  if (cookies.length !== 1) return null;
  const [id, expiry, signature, extra] = cookies[0].slice(COOKIE.length + 1).split('.');
  const voucherId = /^[a-f0-9-]{36}$/.test(id || '') || /^(gift|shared)-[a-f0-9]{64}$/.test(id || '');
  if (extra !== undefined || !voucherId || !/^\d{13}$/.test(expiry || '') || +expiry <= now || !/^[A-Za-z0-9_-]{43}$/.test(signature || '')) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}.${expiry}`, key)))) return null;
  if (id.startsWith('shared-')) return sharedDadIdentity(id.slice(7), +expiry);
  return { key: digest(`dad-voucher:${id}`), expiresAt: +expiry,
    ...(id.startsWith('gift-') ? { giftHash: id.slice(5) } : {}) };
}

function sharedDadIdentity(hash, expiresAt) {
  return { key: digest(`friend-voucher:gift-${hash}`), expiresAt: new Date(expiresAt),
    legacyDadKey: digest(`dad-voucher:gift-${hash}`), maker: 'dads' };
}

export async function dadVoucherAllowanceIdentity(voucher, pool) {
  if (!voucher.giftHash) return voucher;
  const { rows } = await (pool ?? databasePool()).query(
    'SELECT 1 FROM public.santa_fixed_gift_vouchers WHERE code_sha256=$1 AND shared_code IS NOT NULL',
    [voucher.giftHash],
  );
  return rows.length ? sharedDadIdentity(voucher.giftHash, voucher.expiresAt) : voucher;
}
async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize pool replenishment and redemption across all server instances.
    await client.query("SELECT pg_advisory_xact_lock(731926150)");
    const value = await work(client);
    await client.query('COMMIT'); return value;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
async function replenish(client) {
  const { rows: [row] } = await client.query(`SELECT count(*)::int AS visible FROM public.santa_dad_vouchers
    WHERE redeemed_at IS NULL OR redeemed_at > now() - interval '24 hours'`);
  for (let i = row.visible; i < 15; i++) {
    const code = randomBytes(10).toString('hex').toUpperCase();
    await client.query('INSERT INTO public.santa_dad_vouchers(id,code) VALUES($1,$2)', [randomUUID(), `DAD-${code.slice(0,10)}-${code.slice(10)}`]);
  }
}
export async function listDadVouchers(pool = databasePool()) {
  return transaction(pool, async client => {
    await replenish(client);
    const { rows } = await client.query(`SELECT id,code,copied_at AS "copiedAt",redeemed_at AS "redeemedAt",
      CASE WHEN redeemed_at IS NOT NULL THEN 'USED' WHEN copied_at IS NOT NULL THEN 'COPIED' ELSE 'AVAILABLE' END AS status
      FROM public.santa_dad_vouchers WHERE redeemed_at IS NULL OR redeemed_at > now() - interval '24 hours'
      ORDER BY created_at,id`);
    return { vouchers: rows };
  });
}
async function claimDashboardVoucher(req, res, normalized, pool, key) {
  const claim = digest(friendClaim(req, res, key));
  return transaction(pool, async client => {
    const { rows: [row] } = await client.query(`UPDATE public.santa_dad_vouchers
      SET redeemed_at=COALESCE(redeemed_at,clock_timestamp()),claimant_sha256=COALESCE(claimant_sha256,$2)
      WHERE code=$1 AND (redeemed_at IS NULL OR claimant_sha256=$2)
      AND (redeemed_at IS NULL OR redeemed_at > clock_timestamp()-interval '30 days') RETURNING id,redeemed_at`, [normalized,claim]);
    return row && { id: row.id, expiresAt: +new Date(row.redeemed_at) + MONTH };
  });
}

export async function redeemDadVoucher(req, res, code, { pool = databasePool(), key = process.env.SESSION_SECRET } = {}) {
  if (typeof code !== 'string') return false;
  const normalized = code.trim().toUpperCase();
  const fixedGift = sharedVoucherMatches(normalized) || /^DAD-GIFT-(?:[A-F0-9]{5}-){3}[A-F0-9]{5}$/.test(normalized);
  if (!fixedGift && !/^DAD-[A-F0-9]{10}-[A-F0-9]{10}$/.test(normalized)) return false;
  if (typeof key !== 'string' || key.length < 32) throw Error('DAD_VOUCHER_SIGNING_UNAVAILABLE');
  const grant = fixedGift
    ? await claimFixedGift(req, res, normalized, pool, key)
    : await claimDashboardVoucher(req, res, normalized, pool, key);
  if (!grant) return false;
  const { id, expiresAt } = grant;
  const payload = `${id}.${expiresAt}`;
  res.cookie(COOKIE, `${payload}.${sign(payload,key)}`, { httpOnly:true, secure:!!(req.socket?.encrypted || req.headers['x-forwarded-proto'] === 'https'), sameSite:'strict', path:'/', maxAge:Math.max(0,expiresAt-Date.now()) });
  return { authorized:true,expiresAt,voucher:{dad:true,unlimited:false} };
}
