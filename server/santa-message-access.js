import express from 'express';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { consumeNameAccess, privateResponse } from './santa-name-security.js';
import { BREVO_FORM_URL, validateAccessFields } from '../src/lib/santaMessageAccess.js';
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
  // Fresh server randomness per acceptance; a submitted address cannot choose
  // or fix the bearer grant. Only its keyed allowance identity stays stable.
  const payload = Buffer.from(JSON.stringify({ subject, nonce: randomBytes(16).toString('base64url'),
    exp: now + SESSION_MS })).toString('base64url');
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
    return /^[A-Za-z0-9_-]{43}$/.test(data.subject) && /^[A-Za-z0-9_-]{22}$/.test(data.nonce) && Number.isSafeInteger(data.exp) &&
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
  readSession = freeSession, issue = issueFreeAccess, readAllowance = availableAt } = {}) {
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
      if (!fields || Object.keys(fields).some(key => !['FIRSTNAME', 'LASTNAME', 'EMAIL', 'email_address_check'].includes(key)) ||
          ['FIRSTNAME', 'LASTNAME', 'EMAIL'].some(key => typeof fields[key] !== 'string' || /[\u0000-\u001f\u007f]/.test(fields[key])) ||
          fields.email_address_check || Object.keys(validateAccessFields(fields)).length) {
        return res.status(400).json({ success: false, message: 'Please check your adult contact details.' });
      }
      const body = new FormData();
      for (const name of ['FIRSTNAME', 'LASTNAME', 'EMAIL']) body.append(name, fields[name].trim());
      body.append('email_address_check', ''); body.append('locale', 'en');
      const response = await fetcher(`${BREVO_FORM_URL}?isAjax=1`, {
        method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(12000),
      });
      const reader = response.body.getReader();
      let bytes = '', length = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 16000) { await reader.cancel(); throw new Error('Provider response too large'); }
          bytes += decoder.decode(value, { stream: true });
        }
        bytes += decoder.decode();
      } finally { reader.releaseLock(); }
      let data;
      try { data = JSON.parse(bytes); } catch { throw new Error('Invalid provider response'); }
      if (!response.ok || data?.success !== true) {
        // Retain useful field/configuration errors without forwarding provider
        // HTML, arbitrary object structure, or unbounded field names.
        const errors = {};
        if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
          for (const [field, value] of Object.entries(data.errors).slice(0, 32)) {
            if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(field)) continue;
            errors[field] = typeof value === 'string'
              ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300)
              : 'Please check this field.';
          }
        }
        return res.status(422).json({ success: false, errors,
          message: 'Your details could not be accepted. Please check them and try again.' });
      }
      res.cookie(FREE_ACCESS_COOKIE, issue(fields.EMAIL), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
      return res.json({ success: true });
    } catch (error) {
      if (error.status === 429) return res.set('Retry-After', String(error.retryAfter)).status(429).json({ success: false, message: error.message });
      return res.status(503).json({ success: false, message: 'The recording studio is temporarily unavailable. Please try again.' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : error.status === 415 ? 415 : 400).json({ success: false, message: 'Please send a short, uncompressed request.' }));
  return app;
}
export default createMessageAccessHandler();
