import express from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';

export const WORKSHOP_COOKIE = 'santa-workshop-preview';
export const WORKSHOP_SESSION_MS = 12 * 3600000;
const WINDOW_MS = 15 * 60000;
const hash = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(hash(a), hash(b));
const mac = (value, config) => createHmac('sha256', config.signingSecret)
  .update(`workshop-preview:v1:${config.password}:`).update(value).digest('base64url');
const settings = () => ({
  password: process.env.SANTA_WORKSHOP_PASSWORD,
  signingSecret: process.env.SESSION_SECRET,
});
const configured = config => typeof config.password === 'string' && config.password.length > 0
  && typeof config.signingSecret === 'string' && config.signingSecret.length >= 32;

export function issueWorkshopToken(config, now = Date.now()) {
  const payload = `v1.${now + WORKSHOP_SESSION_MS}.${randomBytes(24).toString('base64url')}`;
  return `${payload}.${mac(payload, config)}`;
}

export function hasWorkshopAccess(req, config = settings(), now = Date.now()) {
  if (!configured(config)) return false;
  const cookie = req.headers.cookie || '';
  if (typeof cookie !== 'string' || cookie.length > 16384) return false;
  const tokens = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(`${WORKSHOP_COOKIE}=`));
  if (tokens.length !== 1) return false;
  const raw = tokens[0].slice(WORKSHOP_COOKIE.length + 1);
  if (!/^v1\.\d{13}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(raw)) return false;
  const [version, expires, nonce, signature] = raw.split('.');
  const expiry = Number(expires);
  return expiry > now && expiry <= now + WORKSHOP_SESSION_MS
    && equal(signature, mac(`${version}.${expires}.${nonce}`, config));
}

// Shared atomic PostgreSQL buckets work across serverless instances/restarts.
// Reuse the existing expiring request-limit store with a disjoint namespace.
// Count all well-formed submissions, not just failures, to bound concurrent work.
export async function consumeWorkshopAttempt(req, config, now = Date.now()) {
  const window = Math.floor(now / WINDOW_MS);
  const expires = new Date((window + 1) * WINDOW_MS);
  // Vercel overwrites this header. Else use the socket, never a caller's XFF.
  const address = process.env.VERCEL === '1'
    ? req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
    : req.socket?.remoteAddress || 'unknown';
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM santa_name_request_limits WHERE expires_at <= $1', [new Date(now)]);
    for (const [identity, limit] of [['global', 150], [`address:${address}`, 10]]) {
      const key = `workshop:${window}:${mac(identity, config)}`;
      const result = await client.query(`INSERT INTO santa_name_request_limits(bucket_key, expires_at)
        VALUES($1,$2) ON CONFLICT(bucket_key) DO UPDATE
        SET attempts=santa_name_request_limits.attempts+1
        WHERE santa_name_request_limits.attempts < $3 RETURNING attempts`, [key, expires, limit]);
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((expires.getTime() - now) / 1000)) };
      }
    }
    await client.query('COMMIT');
    return { allowed: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export function workshopDocumentHeaders(req, res, next) {
  const pathname = new URL(req.url, 'http://server').pathname;
  if (/^\/santa-message-workshop(?:\/|$)/.test(pathname)) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
}

export function createWorkshopAccessHandler({ getSettings = settings, consumeAttempt = consumeWorkshopAttempt, now = Date.now } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('Vercel-CDN-Cache-Control', 'no-store');
    res.set('CDN-Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'POST'].includes(req.method)) return res.set('Allow', 'GET, POST').status(405).json({ error: 'Method not allowed.' });
    if (req.method === 'POST') {
      const protocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim()
        || (req.socket?.encrypted ? 'https' : 'http');
      const host = req.headers.host;
      try {
        const origin = new URL(req.headers.origin);
        if (!host || origin.origin !== `${protocol}://${host}` || req.headers['sec-fetch-site'] === 'cross-site') throw new Error();
      } catch { return res.status(403).json({ error: 'Please open the workshop from this website and try again.' }); }
      if (!req.is('application/json')) return res.status(415).json({ error: 'Please send the password using the workshop form.' });
    }
    next();
  });
  app.use(express.json({ limit: '2kb', strict: true }));
  app.use(async (req, res) => {
    const config = getSettings();
    if (!configured(config)) return res.status(503).json({ error: 'Workshop preview access is not configured yet. Please try again later.' });
    if (req.method === 'GET') return res.json({ authorized: hasWorkshopAccess(req, config, now()) });
    if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.password !== 'string'
      || !req.body.password.length || Buffer.byteLength(req.body.password) > 1024) {
      return res.status(400).json({ error: 'Enter a password of up to 1,024 bytes.' });
    }
    try {
      const limit = await consumeAttempt(req, config, now());
      if (!limit.allowed) return res.set('Retry-After', String(limit.retryAfter)).status(429)
        .json({ error: 'Too many password attempts. Please wait a few minutes before trying again.' });
      if (!equal(req.body.password, config.password)) return res.status(401).json({ error: 'That password is not correct. Please try again.' });
      const secure = req.socket?.encrypted || req.headers['x-forwarded-proto']?.split(',')[0]?.trim() === 'https';
      res.set('Set-Cookie', `${WORKSHOP_COOKIE}=${issueWorkshopToken(config, now())}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
      return res.json({ authorized: true });
    } catch {
      // Never log passwords, cookies, connection strings or raw exceptions.
      return res.status(503).json({ error: 'Workshop access is temporarily unavailable. Please try again.' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400)
    .json({ error: 'Please send a valid, short password request.' }));
  return app;
}

export default createWorkshopAccessHandler();
