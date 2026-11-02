import { createHmac, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_LIMIT = 10;
const WINDOW_MS = 60_000;
const TOKEN_MS = 5 * 60_000;
const MAXIMUM = { studioMessage: 6, count: 30, search: 40, preview: 12, message: 6, request: 20, signup: 10, contenderRead: 300, contenderWrite: 30 };
const GLOBAL_MAXIMUM = { studioMessage: 60, count: 6000, search: 1200, preview: 300, message: 120, request: 300, signup: 300, contenderRead: 6000, contenderWrite: 600 };
export function trustedAddress(req) {
  return process.env.VERCEL === '1'
    ? req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
    : req.socket?.remoteAddress || 'unknown';
}

export function privateResponse(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('Name service signing is unavailable.');
  return value;
}
const mac = (value, key) => createHmac('sha256', key).update(value).digest('base64url');
export function issueNameToken(id, scope, now = Date.now(), key = secret()) {
  const payload = Buffer.from(JSON.stringify({ id, scope, exp: now + TOKEN_MS })).toString('base64url');
  return `${payload}.${mac(`name-access:${payload}`, key)}`;
}
export function verifyNameToken(token, scope, now = Date.now(), key = secret()) {
  if (typeof token !== 'string' || token.length > 800) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const expected = mac(`name-access:${parts[0]}`, key);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return value.scope === scope && typeof value.id === 'string' &&
      Number.isSafeInteger(value.exp) && value.exp > now && value.exp <= now + TOKEN_MS ? value.id : null;
  } catch { return null; }
}

// Shared, atomic, expiring buckets reuse the existing request-limits table.
// Never trust caller-supplied X-Forwarded-For or keep raw IPs/searches in storage.
export async function consumeNameAccess(req, scope, { now = Date.now(), pool = databasePool(), key = secret() } = {}) {
  const duration = ['request', 'signup', 'contenderRead', 'contenderWrite'].includes(scope) ? 3600000 : WINDOW_MS;
  const window = Math.floor(now / duration);
  const expires = new Date((window + 1) * duration);
  const address = trustedAddress(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [identity, maximum] of [['global', GLOBAL_MAXIMUM[scope]], [`address:${address}`, MAXIMUM[scope]]]) {
      if (!maximum) throw new Error('Unknown name-access scope.');
      const bucket = `name-access:${scope}:${window}:${mac(identity, key)}`;
      const result = await client.query(`INSERT INTO santa_name_request_limits(bucket_key, expires_at)
        VALUES($1,$2) ON CONFLICT(bucket_key) DO UPDATE
        SET attempts=santa_name_request_limits.attempts+1
        WHERE santa_name_request_limits.attempts < $3 RETURNING attempts`, [bucket, expires, maximum]);
      if (!result.rowCount) {
        const error = new Error('Too many requests. Please wait before trying again.');
        error.status = 429;
        error.retryAfter = Math.max(1, Math.ceil((expires.getTime() - now) / 1000));
        throw error;
      }
    }
    await client.query(`DELETE FROM santa_name_request_limits WHERE bucket_key IN
      (SELECT bucket_key FROM santa_name_request_limits WHERE expires_at <= $1 LIMIT 100)`, [new Date(now)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function readNameJson(req) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Expected JSON.'), { status: 415 });
  }
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 1024) throw Object.assign(new Error('Request is too large.'), { status: 413 });
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body) || '') > 1024) {
    throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try {
    const value = typeof body === 'string' ? JSON.parse(body) : body;
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw Object.assign(new Error('Invalid request.'), { status: 400 }); }
}
