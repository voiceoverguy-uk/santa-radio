import { friendSession, friendClaim, redeemFriendVoucher, adminVoucherMatches, issueAdminVoucher } from './friend-vouchers.js';
import express from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { workshopSettings as settings, workshopConfigured as configured, workshopCodeDeadline, workshopCodeOpen, limitedWorkshopCode } from './santa-workshop-settings.js';
import { publicRequestUrl } from '../src/seo/requestUrl.js';
import { isStudioPath } from '../src/lib/studioRoute.js';

export const WORKSHOP_COOKIE = 'santa-workshop-preview';
export const WORKSHOP_SESSION_MS = 12 * 3600000;
const WINDOW_MS = 15 * 60000;
const hash = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(hash(a), hash(b));
const mac = (value, config) => createHmac('sha256', config.signingSecret)
  .update('studio-test:v2:').update(value).digest('base64url');
const sessionMac = (payload, entry, config) => mac(`session:${hash(entry.code).toString('hex')}:${payload}`, config);

export function issueWorkshopToken(config, now = Date.now(), codeId = config.codes?.[0]?.id) {
  const entry = config.codes?.find(item => item.id === codeId);
  if (!configured(config) || !workshopCodeOpen(config, entry, now)) throw new Error('Tester access is unavailable.');
  const payload = `v2.${entry.id}.${now}.${Math.min(now + WORKSHOP_SESSION_MS, workshopCodeDeadline(config, entry))}.${randomBytes(24).toString('base64url')}`;
  return `${payload}.${sessionMac(payload, entry, config)}`;
}

export function workshopSession(req, config = settings(), now = Date.now()) {
  const friend = friendSession(req);
  if (friend) return friend;
  if (!configured(config) || config.expiresAt <= now) return null;
  const cookie = req.headers?.cookie || '';
  if (typeof cookie !== 'string' || cookie.length > 16384) return null;
  const tokens = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(`${WORKSHOP_COOKIE}=`));
  if (tokens.length !== 1) return null;
  const raw = tokens[0].slice(WORKSHOP_COOKIE.length + 1);
  if (!/^v2\.[1-6]\.\d{13}\.\d{13}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const [version, id, issued, expires, nonce, signature] = raw.split('.');
  const entry = config.codes.find(item => item.id === id);
  const expiry = Number(expires);
  if (!workshopCodeOpen(config, entry, now) || Number(issued) > now || expiry <= now || expiry > Number(issued) + WORKSHOP_SESSION_MS
    || expiry > workshopCodeDeadline(config, entry) || !equal(signature, sessionMac(`${version}.${id}.${issued}.${expires}.${nonce}`, entry, config))) return null;
  return { expiresAt: expiry, generationKey: hash(`tester:${raw}`).toString('hex'), codeId: id,
    limited: limitedWorkshopCode(entry) };
}

export function hasWorkshopAccess(req, config = settings(), now = Date.now()) {
  return workshopSession(req, config, now) !== null;
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
      const key = `workshop-tests:${window}:${mac(`rate:${identity}`, config)}`;
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
  const pathname = publicRequestUrl(req.url, 'http://server').pathname;
  if (isStudioPath(pathname)) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
}

export function createWorkshopAccessHandler({
  getSettings = settings, consumeAttempt = consumeWorkshopAttempt, now = Date.now,
} = {}) {
  // Collection is disabled. Authentication and session rotation must never
  // import, call or wait for the optional voucher reporting store.
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
      if (!req.is('application/json')) return res.status(415).json({ error: 'Please send your tester code using the Studio form.' });
    }
    next();
  });
  app.use(express.json({ limit: '2kb', strict: true, inflate: false }));
  app.use(async (req, res) => {
    const config = getSettings();
    try {
      const friend = friendSession(req);
      if (req.method === 'GET') {
        if ((process.env.SESSION_SECRET || "").length >= 32) friendClaim(req, res);
        if (friend) return res.json({ authorized: true, expiresAt: friend.expiresAt, voucher: { unlimited: false, friend: !!friend.friend, admin: !!friend.admin } });
      }
      if (req.method === 'POST' && (adminVoucherMatches(req.body?.code) || friend?.admin && req.body?.another === true)) {
        if (Object.keys(req.body).length !== 1) return res.status(400).json({ error: 'Invalid voucher request.' });
        const limit = await consumeAttempt(req, config, now());
        if (!limit.allowed) return res.status(429).json({ error: 'Please wait before starting another admin test.' });
        if (friend?.admin && req.body?.another !== true) return res.json({ authorized: true, expiresAt: friend.expiresAt });
        return res.json(issueAdminVoucher(req, res, friend?.admin ? { expiresAt: friend.expiresAt } : undefined));
      }
      if (req.method === 'POST' && typeof req.body?.code === 'string' && /^FRIEND-/i.test(req.body.code.trim())) {
        if (Object.keys(req.body).length !== 1 || req.body.code.length > 80) return res.status(400).json({ error: 'Enter a valid voucher code.' });
        const limit = await consumeAttempt(req, config, now());
        if (!limit.allowed) return res.status(429).json({ error: 'Too many code attempts. Please try again in a few minutes.' });
        const result = await redeemFriendVoucher(req, res, req.body.code);
        return result ? res.json(result) : res.status(410).json({ error: 'This friends voucher is invalid or has already been redeemed.' });
      }
      if (friend && req.body?.another === true) return res.status(409).json({ error: 'Your friends voucher includes two creations. It cannot be reset.' });
    } catch { return res.status(503).json({ error: 'Voucher access is temporarily unavailable. Please try again.' }); }

    if (!configured(config)) return res.status(503).json({ error: 'Tester access is not configured yet. Please try again later.' });
    const time = now();
    if (time >= config.expiresAt) return res.status(410).json({ authorized: false, error: 'This friends-only test has closed. The Studio is coming soon.' });
    if (req.method === 'GET') {
      const session = workshopSession(req, config, time);
      return res.json(session ? {
        authorized: true, expiresAt: session.expiresAt,
        voucher: { code: config.codes.find(entry => entry.id === session.codeId).code, unlimited: !session.limited },
      } : { authorized: false });
    }
    // Temporary friends-test exception: only an already authenticated voucher
    // session can start another message. Never extend its existing expiry.
    if (req.body?.another === true && Object.keys(req.body).length === 1) {
      const session = workshopSession(req, config, time);
      if (!session) return res.status(403).json({ error: 'Enter a valid voucher code to create another test message.' });
      try {
        const attempt = await consumeAttempt(req, config, time);
        if (!attempt.allowed) return res.set('Retry-After', String(attempt.retryAfter)).status(429).json({ error: 'Please wait before starting another test message.' });
        const grantTime = now();
        if (!workshopSession(req, config, grantTime)) return res.status(403).json({ error: 'Enter a valid voucher code to create another test message.' });
        const secure = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() === 'https' || req.socket?.encrypted;
        // The limited visitor's signed session IS the bounded identity. Do not
        // rotate it (or extend its deadline) when starting creation two.
        if (!session.limited) {
          const token = issueWorkshopToken({ ...config, expiresAt: session.expiresAt }, grantTime, session.codeId);
          res.set('Set-Cookie', `${WORKSHOP_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
        }
        return res.json({ authorized: true, expiresAt: session.expiresAt });
      } catch {
        return res.status(503).json({ error: 'Another test message could not be started. Please try again.' });
      }
    }
    if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.code !== 'string'
      || !req.body.code.trim().length || req.body.code.trim().length > 80) {
      return res.status(400).json({ error: 'Enter a tester code of up to 80 characters.' });
    }
    try {
      const limit = await consumeAttempt(req, config, time);
      if (!limit.allowed) return res.set('Retry-After', String(limit.retryAfter)).status(429)
        .json({ error: 'Too many code attempts. Please wait a few minutes before trying again.' });
      // Compare all active codes without exposing which slot matched.
      let matched;
      for (const entry of config.codes) if (equal(req.body.code.trim(), entry.code)) matched = entry;
      if (!matched) return res.status(401).json({ error: 'That tester code is not valid. Please check it and try again.' });
      const grantTime = now();
      if (!workshopCodeOpen(config, matched, grantTime)) return res.status(410).json({ authorized: false, error: 'This voucher is outside its testing dates.' });
      const secure = req.socket?.encrypted || req.headers['x-forwarded-proto']?.split(',')[0]?.trim() === 'https';
      const existing = workshopSession(req, config, grantTime);
      const preserve = existing?.limited && existing.codeId === matched.id;
      if (!preserve) {
        const token = issueWorkshopToken(config, grantTime, matched.id);
        res.set('Set-Cookie', `${WORKSHOP_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
      }
      return res.json({ authorized: true, expiresAt: preserve ? existing.expiresAt
        : Math.min(grantTime + WORKSHOP_SESSION_MS, workshopCodeDeadline(config, matched)) });
    } catch {
      // Never log passwords, cookies, connection strings or raw exceptions.
      return res.status(503).json({ error: 'Workshop access is temporarily unavailable. Please try again.' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400)
    .json({ error: 'Please send a valid, short tester-code request.' }));
  return app;
}

export default createWorkshopAccessHandler();
