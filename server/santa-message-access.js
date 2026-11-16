import { requestFreeMessageCode, confirmFreeMessageCode, sendFreeMessageCode, verificationBinding, VERIFICATION_COOKIE } from './free-message-verification.js';
import { CONTACT_COOKIE, sealContact } from './name-request-contact.js';
import express from 'express';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { consumeNameAccess, privateResponse } from './santa-name-security.js';
import { validateAccessFields } from '../src/lib/santaMessageAccess.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';

export const FREE_ACCESS_COOKIE = 'santa-free-message';
export const FREE_COOLDOWN_MS = 2 * 3600000;
const SESSION_MS = 24 * 3600000;
const signingKey = () => {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Signing unavailable');
  return process.env.SESSION_SECRET;
};
const mac = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');
export function issueFreeAccess(email, now = Date.now(), secret = signingKey()) {
  const subject = mac(`free-adult:${email.trim().normalize('NFKC').toLowerCase()}`, secret);
  // Fresh server randomness per verified acceptance; a submitted address cannot choose
  // or fix the bearer grant. Only its keyed allowance identity stays stable.
  const payload = Buffer.from(JSON.stringify({ subject, nonce: randomBytes(16).toString('base64url'),
    verified: true, exp: now + SESSION_MS })).toString('base64url');
  return `${payload}.${mac(`free-access:${payload}`, secret)}`;
}
export function freeSession(req, now = Date.now(), secret = signingKey()) {
  const cookies = String(req.headers.cookie || '');
  if (cookies.length > 16384) return null;
  const entries = cookies.split(';').map(value => value.trim()).filter(value => value.startsWith(`${FREE_ACCESS_COOKIE}=`));
  if (entries.length !== 1) return null;
  const match = /^([A-Za-z0-9_-]{1,300})\.([A-Za-z0-9_-]{43})$/.exec(entries[0].slice(FREE_ACCESS_COOKIE.length + 1));
  if (!match || !timingSafeEqual(Buffer.from(match[2]), Buffer.from(mac(`free-access:${match[1]}`, secret)))) return null;
  try {
    const data = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    return data.verified === true && /^[A-Za-z0-9_-]{43}$/.test(data.subject) && /^[A-Za-z0-9_-]{22}$/.test(data.nonce) && Number.isSafeInteger(data.exp) &&
      data.exp > now && data.exp <= now + SESSION_MS ? data : null;
  } catch { return null; }
}
export function sameSiteRequest(req) {
  try {
    const origin = new URL(req.headers.origin);
    const protocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim()
      || (req.socket?.encrypted ? 'https' : 'http');
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === getClerkProxyHost(req) &&
      origin.protocol === `${protocol}:` &&
      req.headers['sec-fetch-site'] !== 'cross-site';
  } catch { return false; }
}
export function authorizeFreeMessage(req) {
  if (!sameSiteRequest(req)) throw Object.assign(new Error('Please create your message from this website.'), { status: 403 });
  const session = freeSession(req);
  if (!session) throw Object.assign(new Error('Please add your adult details again to open Santa’s recording studio.'), { status: 401 });
  return session;
}
const bucket = subject => `free-message-allowance:${subject}`;
export async function availableAt(subject, pool = databasePool(), now = Date.now()) {
  const result = await pool.query('SELECT expires_at FROM santa_name_request_limits WHERE bucket_key=$1 AND expires_at>$2',
    [bucket(subject), new Date(now)]);
  return result.rows[0] ? new Date(result.rows[0].expires_at).getTime() : 0;
}
export async function reserveFreeMessage(session, pool = databasePool(), now = Date.now()) {
  // A short generation lease prevents concurrent requests across instances.
  // The reservation marker distinguishes this render from a later lease.
  const marker = randomBytes(4).readUInt32BE() % 2000000000 + 1;
  const result = await pool.query(`INSERT INTO santa_name_request_limits(bucket_key,attempts,expires_at)
    VALUES($1,$2,$3) ON CONFLICT(bucket_key) DO UPDATE SET attempts=$2,expires_at=$3
    WHERE santa_name_request_limits.expires_at <= $4 RETURNING bucket_key`,
  [bucket(session.subject), marker, new Date(now + 120000), new Date(now)]);
  if (!result.rowCount) {
    const until = await availableAt(session.subject, pool, now);
    throw Object.assign(new Error('Your free message allowance is resting. Please try again after the time shown.'),
      { status: 429, availableAt: until, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)) });
  }
  return { key: bucket(session.subject), marker };
}
export async function finishFreeMessage(lease, success, pool = databasePool(), now = Date.now()) {
  if (success) {
    const result = await pool.query('UPDATE santa_name_request_limits SET expires_at=$3 WHERE bucket_key=$1 AND attempts=$2',
      [lease.key, lease.marker, new Date(now + FREE_COOLDOWN_MS)]);
    if (!result.rowCount) throw new Error('Message allowance lease lost');
  } else await pool.query('DELETE FROM santa_name_request_limits WHERE bucket_key=$1 AND attempts=$2', [lease.key, lease.marker]);
}
export function createMessageAccessHandler({ fetcher = fetch, limit = consumeNameAccess,
  readSession = freeSession, issue = issueFreeAccess, readAllowance = availableAt,
  requestCode = requestFreeMessageCode, confirmCode = confirmFreeMessageCode } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    privateResponse(res);
    if (!['GET', 'POST'].includes(req.method)) return res.set('Allow', 'GET, POST').status(405).end();
    if (req.method === 'POST' && !sameSiteRequest(req)) return res.status(403).json({ error: 'Please use this website to open the studio.' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Expected JSON.' });
    next();
  });
  app.use(express.json({ limit: '2kb', inflate: false }));
  app.use(async (req, res) => {
    try {
      if (req.method === 'GET') {
        const session = readSession(req);
        return res.json({ authorized: !!session, availableAt: session ? await readAllowance(session.subject) : 0 });
      }
      await limit(req, 'signup');
      const fields = req.body;
      if (fields?.action === 'confirm-code') {
        const confirmation = await confirmCode({ id: fields.verificationId, code: fields.code, binding: verificationBinding(req) });
        const email = typeof confirmation === 'string' ? confirmation : confirmation.email;
        const grant = issue(email);
        const session = JSON.parse(Buffer.from(grant.split('.')[0], 'base64url').toString('utf8'));
        res.cookie(CONTACT_COOKIE, sealContact({ email, subject: session.subject, exp: session.exp }),
          { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MS });
        res.cookie(FREE_ACCESS_COOKIE, grant, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MS });
        res.clearCookie(VERIFICATION_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
        return res.json({ success: true, marketingStatus: confirmation.marketingStatus || 'not-requested' });
      }
      // Older websites and the native app still use the provider's old name.
      // Check BOTH independently: an empty alias must never mask a filled trap.
      const traps = ['studio_check', 'email_address_check'];
      if (!fields || fields.action !== 'request-code' || Array.isArray(fields) ||
          Object.keys(fields).some(key => !['action', 'FIRSTNAME', 'LASTNAME', 'EMAIL', 'marketingOptIn', ...traps].includes(key)) ||
          ['FIRSTNAME', 'LASTNAME', 'EMAIL'].some(key => typeof fields[key] !== 'string' || /[\u0000-\u001f\u007f]/.test(fields[key])) ||
          traps.some(key => Object.hasOwn(fields, key) && fields[key] !== '') ||
          (fields.marketingOptIn !== undefined && typeof fields.marketingOptIn !== 'boolean') ||
          Object.keys(validateAccessFields(fields)).length) {
        return res.status(400).json({ success: false, message: 'Please check your adult contact details.' });
      }
      const challenge = await requestCode(fields, { send: args => sendFreeMessageCode(args, fetcher) });
      res.cookie(VERIFICATION_COOKIE, challenge.binding,
        { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 15 * 60000 });
      return res.json({ state: 'verification', verificationId: challenge.id });
    } catch (error) {
      if ([400, 409].includes(error.status)) return res.status(error.status).json({ success: false, message: error.message });
      if (error.status === 429) return res.set('Retry-After', String(error.retryAfter)).status(429).json({ success: false, message: error.message });
      return res.status(503).json({ success: false, message: 'The recording studio is temporarily unavailable. Please try again.' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : error.status === 415 ? 415 : 400).json({ success: false, message: 'Please send a short, uncompressed request.' }));
  return app;
}
export default createMessageAccessHandler();
