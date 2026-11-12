import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';

const CLAIM = 'santa-friend-claim';
const ACCESS = 'santa-friend-access';
const MONTH = 30 * 86400000;
const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => process.env.SESSION_SECRET;
const sign = (value, key) => createHmac('sha256', key).update(`friend-voucher:v1:${value}`).digest('base64url');
const validKey = key => typeof key === 'string' && key.length >= 32;
function cookie(req, name) {
  const raw = req.headers?.cookie || '';
  if (typeof raw !== 'string' || raw.length > 16384) return '';
  const values = raw.split(';').map(s => s.trim()).filter(s => s.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
function verified(raw, key) {
  if (!validKey(key) || !raw || raw.length > 240) return null;
  const parts = raw.split('.'), signature = parts.pop(), payload = parts.join('.');
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature || '')) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload, key))) ? parts : null;
}
function setCookie(req, res, name, value, maxAge) {
  const secure = req.socket?.encrypted || req.headers?.['x-forwarded-proto']?.split(',')[0]?.trim() === 'https';
  res.cookie(name, value, { httpOnly: true, secure: !!secure, sameSite: 'strict', path: '/', maxAge });
}
export function friendSession(req, key = secret(), now = Date.now()) {
  const parts = verified(cookie(req, ACCESS), key);
  if (parts?.length === 3 && parts[0] === 'admin' && /^[A-Za-z0-9_-]{32}$/.test(parts[1])
    && /^\d{13}$/.test(parts[2]) && Number(parts[2]) > now) {
    return { codeId: 'admin', limited: true, admin: true, expiresAt: Number(parts[2]),
      generationKey: digest(`friend-admin:${parts[1]}`) };
  }
  if (!parts || parts.length !== 3 || parts[0] !== 'access' || !/^[1-9][0-9]?$/.test(parts[1])
    || Number(parts[1]) > 20 || !/^\d{13}$/.test(parts[2]) || Number(parts[2]) <= now) return null;
  return { codeId: `friend-${parts[1]}`, limited: true, friend: true,
    expiresAt: Number(parts[2]), generationKey: digest(`friend-voucher:${parts[1]}`) };
}
export const adminVoucherMatches = code => typeof code === 'string'
  && digest(code.trim()) === '67a780ecc73b80f4f6cc061e3e1c4f266ada69518eab64b278ba263317685aa6';
export function issueAdminVoucher(req, res, { key = secret(), expiresAt = Date.now() + 12 * 3600000 } = {}) {
  if (!validKey(key)) throw new Error('FRIEND_SIGNING_UNAVAILABLE');
  const payload = `admin.${randomBytes(24).toString('base64url')}.${expiresAt}`;
  setCookie(req, res, ACCESS, `${payload}.${sign(payload, key)}`, Math.max(0, expiresAt - Date.now()));
  return { authorized: true, expiresAt, voucher: { unlimited: false, admin: true } };
}
export function friendClaim(req, res, key = secret()) {
  if (!validKey(key)) throw new Error('FRIEND_SIGNING_UNAVAILABLE');
  const parts = verified(cookie(req, CLAIM), key);
  if (parts?.length === 2 && parts[0] === 'claim' && /^[A-Za-z0-9_-]{43}$/.test(parts[1])) return parts[1];
  const nonce = randomBytes(32).toString('base64url'), payload = `claim.${nonce}`;
  setCookie(req, res, CLAIM, `${payload}.${sign(payload, key)}`, MONTH);
  return nonce;
}
export async function redeemFriendVoucher(req, res, code, { pool = databasePool(), key = secret() } = {}) {
  const normalized = code.trim().toUpperCase();
  if (!/^FRIEND-[A-F0-9]{10}-[A-F0-9]{10}$/.test(normalized)) return false;
  const claim = digest(friendClaim(req, res, key));
  // One database statement serializes competing redeemers. The original browser
  // may retry a lost response without spending the voucher twice or resetting it.
  const { rows: [row] } = await pool.query(`UPDATE public.santa_friend_vouchers
    SET redeemed_at=COALESCE(redeemed_at,clock_timestamp()), claimant_sha256=COALESCE(claimant_sha256,$2)
    WHERE code=$1 AND (redeemed_at IS NULL OR claimant_sha256=$2)
    AND (redeemed_at IS NULL OR redeemed_at > clock_timestamp()-interval '30 days')
    RETURNING slot, redeemed_at`, [normalized, claim]);
  if (!row) return false;
  const expiresAt = new Date(row.redeemed_at).getTime() + MONTH;
  const payload = `access.${row.slot}.${expiresAt}`;
  setCookie(req, res, ACCESS, `${payload}.${sign(payload, key)}`, Math.max(0, expiresAt - Date.now()));
  return { authorized: true, expiresAt, voucher: { unlimited: false, friend: true } };
}
export async function listFriendVouchers(pool = databasePool()) {
  const { rows } = await pool.query(`SELECT slot,code,redeemed_at AS "redeemedAt"
    FROM public.santa_friend_vouchers ORDER BY slot`);
  return { vouchers: rows.map(row => ({ ...row, status: row.redeemedAt ? 'EXPIRED' : 'AVAILABLE' })) };
}
export async function seedFriendVouchers(client) {
  for (let slot = 1; slot <= 20; slot++) {
    const random = randomBytes(10).toString('hex').toUpperCase();
    await client.query(`INSERT INTO public.santa_friend_vouchers(slot,code) VALUES($1,$2)
      ON CONFLICT(slot) DO NOTHING`, [slot, `FRIEND-${random.slice(0,10)}-${random.slice(10)}`]);
  }
}
