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
  if (!parts || parts.length !== 3 || parts[0] !== 'access'
    || !/^\d{13}$/.test(parts[2]) || Number(parts[2]) <= now) return null;
  const dashboardIssue = /^[1-9]\d{0,9}$/.test(parts[1]) && Number(parts[1]) <= 2147483647;
  if (!dashboardIssue && !/^gift-[a-f0-9]{64}$/.test(parts[1])) return null;
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
function savedClaim(req, key) {
  if (!validKey(key)) throw new Error('FRIEND_SIGNING_UNAVAILABLE');
  const parts = verified(cookie(req, CLAIM), key);
  return parts?.length === 2 && parts[0] === 'claim' && /^[A-Za-z0-9_-]{43}$/.test(parts[1]) ? parts[1] : null;
}
function setClaim(req, res, key, nonce, duration) {
  const payload = `claim.${nonce}`;
  setCookie(req, res, CLAIM, `${payload}.${sign(payload, key)}`, duration);
}
export function friendClaim(req, res, key = secret()) {
  const existing = savedClaim(req, key);
  if (existing) return existing;
  const nonce = randomBytes(32).toString('base64url');
  setClaim(req, res, key, nonce, MONTH);
  return nonce;
}
export async function redeemFriendVoucher(req, res, code, { pool = databasePool(), key = secret() } = {}) {
  const normalized = code.trim().toUpperCase();
  const fixedGift = /^FRIEND-GIFT-(?:[A-F0-9]{5}-){3}[A-F0-9]{5}$/.test(normalized);
  if (!fixedGift && !/^FRIEND-[A-F0-9]{10}-[A-F0-9]{10}$/.test(normalized)) return false;
  const existing = savedClaim(req, key);
  const nonce = existing ?? randomBytes(32).toString('base64url');
  const claimant = digest(nonce);
  // Each update allows only the first claimant and that browser's retries.
  const result = fixedGift
    ? await pool.query(`UPDATE public.santa_fixed_gift_vouchers
      SET redeemed_at=COALESCE(redeemed_at,clock_timestamp()), claimant_sha256=COALESCE(claimant_sha256,$2)
      WHERE code_sha256=$1 AND valid_until > clock_timestamp()
        AND (redeemed_at IS NULL OR claimant_sha256=$2)
      RETURNING 'gift-' || code_sha256 AS issue, valid_until AS expires_at`, [digest(normalized), claimant])
    : await pool.query(`UPDATE public.santa_friend_vouchers
      SET redeemed_at=COALESCE(redeemed_at,clock_timestamp()), claimant_sha256=COALESCE(claimant_sha256,$2)
      WHERE code=$1 AND (redeemed_at IS NULL OR claimant_sha256=$2)
        AND (redeemed_at IS NULL OR redeemed_at > clock_timestamp()-interval '30 days')
      RETURNING slot AS issue, redeemed_at + interval '720 hours' AS expires_at`, [normalized, claimant]);
  const row = result.rows[0];
  if (!row) return false;
  const expiresAt = new Date(row.expires_at).getTime();
  const duration = Math.max(0, expiresAt - Date.now());
  if (!existing || fixedGift) setClaim(req, res, key, nonce, Math.max(MONTH, duration));
  const payload = `access.${row.issue}.${expiresAt}`;
  setCookie(req, res, ACCESS, `${payload}.${sign(payload, key)}`, duration);
  return { authorized: true, expiresAt, voucher: { unlimited: false, friend: true } };
}
function newFriendCode() {
  const random = randomBytes(10).toString('hex').toUpperCase();
  return `FRIEND-${random.slice(0,10)}-${random.slice(10)}`;
}

async function latestIssues(pool) {
  return (await pool.query(`SELECT DISTINCT ON ((slot - 1) % 20)
    slot AS issue, (slot - 1) % 20 + 1 AS slot, code, copied_at AS "copiedAt",
    redeemed_at AS "redeemedAt", redeemed_at <= now() - interval '24 hours' AS due
    FROM public.santa_friend_vouchers ORDER BY (slot - 1) % 20, slot DESC`)).rows;
}

export async function listFriendVouchers(pool = databasePool()) {
  let rows = await latestIssues(pool);
  const due = rows.filter(row => row.due);
  if (due.length) {
    // The deterministic successor ID and primary key allow simultaneous refreshes
    // to create exactly one new issue per expired position. Old IDs remain valid
    // for the original child's signed 30-day session and its own allowance.
    await pool.query(`INSERT INTO public.santa_friend_vouchers(slot, code)
      SELECT * FROM unnest($1::integer[], $2::text[]) ON CONFLICT (slot) DO NOTHING`,
      [due.map(row => row.issue + 20), due.map(newFriendCode)]);
    rows = await latestIssues(pool);
  }
  return { vouchers: rows.map(({ slot, code, copiedAt, redeemedAt }) => ({
    slot, code, copiedAt, redeemedAt,
    status: redeemedAt ? 'USED' : copiedAt ? 'COPIED' : 'AVAILABLE',
  })) };
}

export async function seedFriendVouchers(client) {
  for (let slot = 1; slot <= 20; slot++) {
    await client.query(`INSERT INTO public.santa_friend_vouchers(slot,code) VALUES($1,$2)
      ON CONFLICT(slot) DO NOTHING`, [slot, newFriendCode()]);
  }
}
