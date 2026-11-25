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
  const shared = /^shared-[a-f0-9]{64}$/.test(parts[1]);
  if (!dashboardIssue && !shared && !/^gift-[a-f0-9]{64}$/.test(parts[1])) return null;
  const giftId = shared ? parts[1].replace('shared-', 'gift-') : parts[1];
  return { codeId: `friend-${parts[1]}`, limited: true, friend: true,
    expiresAt: Number(parts[2]), generationKey: digest(`friend-voucher:${giftId}`),
    ...(shared ? { legacyDadKey: digest(`dad-voucher:${giftId}`) } : {}) };
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
// After an atomic claim, keep the same browser identity for the lifetime of
// the voucher. Holding this nonce alone never grants a Studio session.
async function claimForBrowser(req, res, key, update) {
  const existing = savedClaim(req, key);
  const nonce = existing ?? randomBytes(32).toString('base64url');
  const { rows: [row] } = await update(digest(nonce));
  if (!row) return null;
  const expiresAt = new Date(row.expires_at).getTime();
  setClaim(req, res, key, nonce, Math.max(MONTH, expiresAt - Date.now()));
  return { id: row.issue, expiresAt };
}

export const sharedVoucherMatches = code => /^SANTA-GIFT-(?:[A-F0-9]{5}-){3}[A-F0-9]{5}$/.test(code);

export function claimFixedGift(req, res, normalized, pool, key) {
  const shared = sharedVoucherMatches(normalized);
  // The full code, including its Studio prefix, is part of the stored digest.
  return claimForBrowser(req, res, key, claimant => pool.query(`UPDATE public.santa_fixed_gift_vouchers
    SET redeemed_at=COALESCE(redeemed_at,clock_timestamp()), claimant_sha256=$2
    WHERE code_sha256=$1 AND valid_until > clock_timestamp()
      AND (redeemed_at IS NULL OR claimant_sha256=$2 OR ($3 AND claimant_sha256 IN ($4,$5)))
      AND (NOT $3 OR redeemed_at IS NULL OR redeemed_at > clock_timestamp()-interval '720 hours')
    RETURNING (CASE WHEN $3 THEN 'shared-' ELSE 'gift-' END) || code_sha256 AS issue,
      CASE WHEN $3 THEN LEAST(valid_until, redeemed_at + interval '720 hours') ELSE valid_until END AS expires_at`,
    [digest(normalized), claimant, shared, digest(`kids:${claimant}`), digest(`dads:${claimant}`)]));
}

export async function redeemFriendVoucher(req, res, code, { pool = databasePool(), key = secret() } = {}) {
  const normalized = code.trim().toUpperCase();
  const fixedGift = sharedVoucherMatches(normalized) || /^FRIEND-GIFT-(?:[A-F0-9]{5}-){3}[A-F0-9]{5}$/.test(normalized);
  if (!fixedGift && !/^FRIEND-[A-F0-9]{10}-[A-F0-9]{10}$/.test(normalized)) return false;
  const grant = fixedGift
    ? await claimFixedGift(req, res, normalized, pool, key)
    : await claimForBrowser(req, res, key, claimant => pool.query(`UPDATE public.santa_friend_vouchers
      SET redeemed_at=COALESCE(redeemed_at,clock_timestamp()), claimant_sha256=COALESCE(claimant_sha256,$2)
      WHERE code=$1 AND (redeemed_at IS NULL OR claimant_sha256=$2)
        AND (redeemed_at IS NULL OR redeemed_at > clock_timestamp()-interval '30 days')
      RETURNING slot AS issue, redeemed_at + interval '720 hours' AS expires_at`, [normalized, claimant]));
  if (!grant) return false;
  const { id, expiresAt } = grant;
  const payload = `access.${id}.${expiresAt}`;
  setCookie(req, res, ACCESS, `${payload}.${sign(payload, key)}`, Math.max(0, expiresAt - Date.now()));
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
