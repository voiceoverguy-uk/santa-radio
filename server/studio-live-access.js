import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { databasePool } from './name-request-store.js';
import { liveStudioConfig, liveHeaders, sameLiveOrigin } from './studio-live-config.js';
import { liveStripeClient } from './studio-live-stripe.js';
import { digest, transaction, reconcileLivePurchase, consumeLiveAttempt } from './studio-live-store.js';

export const LIVE_ACCESS_COOKIE = '__Host-santa-studio-paid';
export const LIVE_CHECKOUT_COOKIE = '__Host-santa-studio-claim';
export const LIVE_PENDING_COOKIE = '__Host-santa-studio-pending';
export const cookieOptions = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' };
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const sessionPattern = /^cs_live_[A-Za-z0-9]{1,240}$/;
const mac = (claim, config) => createHmac('sha256', config.secret).update(`studio-live-checkout:${claim}`).digest('base64url');
export const signLiveClaim = (claim, config) => `${claim}.${mac(claim, config)}`;

export function singleCookie(req, name) {
  const raw = req.headers.cookie || '';
  if (typeof raw !== 'string' || raw.length > 16384) return null;
  const values = raw.split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}
export function liveCheckoutClaim(req, config) {
  const [claim, signature, extra] = (singleCookie(req, LIVE_CHECKOUT_COOKIE) || '').split('.');
  if (extra !== undefined || !tokenPattern.test(claim || '') || !tokenPattern.test(signature || '')) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(mac(claim, config))) ? claim : null;
}

export async function livePaidPurchaseId(req, { config, pool } = {}) {
  const token = singleCookie(req, LIVE_ACCESS_COOKIE);
  const pending = singleCookie(req, LIVE_PENDING_COOKIE);
  if (!tokenPattern.test(token || '') && !sessionPattern.test(pending || '')) return false;
  config ||= liveStudioConfig();
  pool ||= databasePool();
  if (tokenPattern.test(token || '')) {
    const result = await pool.query(`SELECT p.checkout_session_id FROM public.santa_studio_live_sessions s
      JOIN public.santa_studio_live_purchases p USING(checkout_session_id) WHERE s.token_sha256=$1`, [digest(token)]);
    if (result.rowCount) return result.rows[0].checkout_session_id;
  }
  const claim = liveCheckoutClaim(req, config);
  const sessionId = pending;
  if (!claim || !sessionPattern.test(sessionId || '')) return false;
  const result = await pool.query(`SELECT checkout_session_id FROM public.santa_studio_live_purchases
    WHERE checkout_session_id=$1 AND claim_sha256=$2`, [sessionId, digest(claim)]);
  return result.rows[0]?.checkout_session_id || false;
}

export async function hasLivePaidAccess(req, options) {
  return !!await livePaidPurchaseId(req, options);
}

export async function issueLiveAccess(res, sessionId, client) {
  const token = randomBytes(32).toString('base64url');
  await client.query(`INSERT INTO public.santa_studio_live_sessions(token_sha256,checkout_session_id) VALUES($1,$2)`,
    [digest(token), sessionId]);
  // Set only after the caller's transaction has committed.
  return () => res.cookie(LIVE_ACCESS_COOKIE, token, cookieOptions);
}

export function createLiveAccessHandler({
  getConfig = liveStudioConfig, getStripe = liveStripeClient, getPool = databasePool,
  consume = consumeLiveAttempt,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(async (req, res) => {
    liveHeaders(res);
    if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).end();
    let config;
    try { config = getConfig(); } catch { return res.status(503).json({ authorized: false }); }
    if (req.headers.host !== new URL(config.origin).host || req.headers['sec-fetch-site'] === 'cross-site'
      || req.headers.origin && !sameLiveOrigin(req, config)) return res.status(403).json({ authorized: false });
    try {
      const pool = getPool();
      if (await hasLivePaidAccess(req, { config, pool })) return res.json({ authorized: true, mode: 'live' });
      const claim = liveCheckoutClaim(req, config), sessionId = singleCookie(req, LIVE_PENDING_COOKIE);
      if (!claim || !sessionPattern.test(sessionId || '')) return res.json({ authorized: false });
      if (!await consume(req, config, 'confirm', pool)) return res.status(429).json({ authorized: false });
      const stripe = await getStripe(config);
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent', 'line_items.data.price.product'] });
      if (session.id !== sessionId || session.metadata?.access_claim_sha256 !== digest(claim)) {
        return res.json({ authorized: false });
      }
      const grant = await transaction(pool, async client => {
        if (!await reconcileLivePurchase(client, session, config)) return null;
        return issueLiveAccess(res, session.id, client);
      });
      grant?.();
      return res.json({ authorized: !!grant, mode: 'live' });
    } catch {
      return res.status(503).json({ authorized: false, error: 'Payment confirmation is temporarily unavailable. Your voucher can still be used.' });
    }
  });
  return app;
}
