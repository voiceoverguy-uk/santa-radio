import { createHash, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { getUncachableStripeClient, requireSandboxWorkspace } from './stripeClient.js';
import { databasePool } from './name-request-store.js';
import { STUDIO_OFFER } from './stripe-sandbox.js';

export const STUDIO_TEST_PRODUCT = 'prod_VWhiGsEihT5KxY';
export const STUDIO_TEST_PRICE = 'price_1UVeIcEt5PrD6a7CdGtAEuM1';
export const STUDIO_PAID_COOKIE = 'santa-studio-sandbox';
export const claimHash = token => createHash('sha256').update(token).digest('hex');
const id = object => typeof object === 'string' ? object : object?.id;

export function paidFamilySession(session, claimToken) {
  const hash = session?.metadata?.access_claim_sha256;
  if (!/^[a-f0-9]{64}$/.test(hash || '') || !/^[A-Za-z0-9_-]{43}$/.test(claimToken || '')) return false;
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(claimHash(claimToken), 'hex'))) return false;
  const lines = session.line_items;
  const line = lines?.data?.[0];
  const payment = session.payment_intent;
  return session.livemode === false && session.mode === 'payment' && session.status === 'complete'
    && session.payment_status === 'paid' && session.amount_total === 650 && session.currency === 'gbp'
    && session.metadata.offer === STUDIO_OFFER
    && lines?.has_more === false && lines.data.length === 1 && line?.quantity === 1
    && line.amount_total === 650 && line.amount_subtotal === 650
    && line.price?.id === STUDIO_TEST_PRICE && line.price?.livemode === false
    && line.price?.unit_amount === 650 && line.price?.currency === 'gbp'
    && line.price?.type === 'one_time' && !line.price?.recurring
    && id(line.price?.product) === STUDIO_TEST_PRODUCT
    && typeof payment?.id === 'string' && payment.livemode === false && payment.status === 'succeeded'
    && payment.amount === 650 && payment.amount_received === 650 && payment.currency === 'gbp';
}

export async function prepareSandboxPurchaseStore(pool = databasePool()) {
  requireSandboxWorkspace();
  // Application entitlements belong in public, not in the package's stripe schema.
  await pool.query(`CREATE TABLE IF NOT EXISTS public.santa_studio_sandbox_access (
    checkout_session_id text PRIMARY KEY,
    payment_intent_id text NOT NULL UNIQUE,
    claim_sha256 char(64) NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS public.santa_studio_checkout_attempts (
    claim_sha256 char(64) PRIMARY KEY, checkout_session_id text, generation integer NOT NULL DEFAULT 0
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS public.santa_studio_checkout_limits (
    bucket_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL
  )`);
}

export function studioClaimFromRequest(req) {
  if (String(req.headers.cookie || '').length > 16384) return null;
  const cookies = String(req.headers.cookie || '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${STUDIO_PAID_COOKIE}=`));
  const raw = cookies.length === 1 && cookies[0].slice(STUDIO_PAID_COOKIE.length + 1);
  const match = typeof raw === 'string' && raw.length < 300
    && /^(cs_test_[A-Za-z0-9]+)\.([A-Za-z0-9_-]{43})$/.exec(raw);
  return match ? { sessionId: match[1], claimToken: match[2] } : null;
}

export async function hasPaidStudioAccess(req) {
  const claim = studioClaimFromRequest(req);
  if (!claim) return false;
  return (await confirmSandboxPurchase({ ...claim, stripe: await getUncachableStripeClient() })).authorized;
}

export async function confirmSandboxPurchase({
  sessionId, claimToken, stripe, pool = databasePool(),
}) {
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId || '') || !/^[A-Za-z0-9_-]{43}$/.test(claimToken || '')) {
    return { authorized: false };
  }
  // Always ask Stripe. A redirect, event body, cookie or stored row alone is
  // never proof of successful payment.
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'line_items.data.price.product'],
  });
  if (session.id !== sessionId || !paidFamilySession(session, claimToken)) return { authorized: false };
  const result = await pool.query(`INSERT INTO public.santa_studio_sandbox_access
    (checkout_session_id, payment_intent_id, claim_sha256) VALUES ($1,$2,$3)
    ON CONFLICT DO NOTHING RETURNING checkout_session_id`,
  [sessionId, session.payment_intent.id, claimHash(claimToken)]);
  if (result.rowCount) return { authorized: true, newlyGranted: true };
  const existing = await pool.query(`SELECT 1 FROM public.santa_studio_sandbox_access
    WHERE checkout_session_id=$1 AND payment_intent_id=$2 AND claim_sha256=$3`,
  [sessionId, session.payment_intent.id, claimHash(claimToken)]);
  return existing.rowCount ? { authorized: true, newlyGranted: false } : { authorized: false };
}

export function createStudioPaidAccessHandler({
  getStripe = getUncachableStripeClient, confirm = confirmSandboxPurchase,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).end();
    const claim = studioClaimFromRequest(req);
    if (!claim) return res.json({ authorized: false });
    try {
      const result = await confirm({ ...claim, stripe: await getStripe() });
      return res.json({ authorized: result.authorized });
    } catch {
      return res.status(503).json({ authorized: false, error: 'Sandbox payment could not be checked.' });
    }
  });
  return app;
}

export default createStudioPaidAccessHandler();
