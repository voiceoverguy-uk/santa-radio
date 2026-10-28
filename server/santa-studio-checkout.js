import express from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { getUncachableStripeClient, requireSandboxWorkspace } from './stripeClient.js';
import { claimHash, confirmSandboxPurchase, STUDIO_PAID_COOKIE, STUDIO_TEST_PRICE, STUDIO_TEST_PRODUCT } from './santa-studio-purchase.js';
import { STUDIO_OFFER, assertFamilyPrice } from './stripe-sandbox.js';

export const CHECKOUT_COOKIE = 'santa-studio-checkout';
const sign = (claim, secret) => createHmac('sha256', secret).update(`studio-checkout:${claim}`).digest('base64url');
export const signedClaim = (claim, secret) => `${claim}.${sign(claim, secret)}`;
export function readCheckoutClaim(req, secret) {
  const cookies = String(req.headers.cookie || '');
  if (cookies.length > 16384) return null;
  const values = cookies.split(';').map(item => item.trim()).filter(item => item.startsWith(`${CHECKOUT_COOKIE}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(CHECKOUT_COOKIE.length + 1);
  const match = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(value);
  return match && timingSafeEqual(Buffer.from(match[2]), Buffer.from(sign(match[1], secret))) ? match[1] : null;
}
function config() {
  requireSandboxWorkspace();
  if (!process.env.SESSION_SECRET || !process.env.REPLIT_DEV_DOMAIN) throw new Error('Sandbox unavailable');
  return { secret: process.env.SESSION_SECRET, origin: `https://${process.env.REPLIT_DEV_DOMAIN}` };
}
export async function limitCheckout(req, secret, pool = databasePool()) {
  const now = Date.now(), window = Math.floor(now / 900000);
  // Never trust a caller-supplied X-Forwarded-For.
  const address = createHmac('sha256', secret).update(req.socket?.remoteAddress || 'unknown').digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM public.santa_studio_checkout_limits WHERE expires_at <= $1', [new Date(now)]);
    for (const [key, max] of [['global', 120], [address, 15]]) {
      const result = await client.query(`INSERT INTO public.santa_studio_checkout_limits(bucket_key,expires_at)
        VALUES($1,$2) ON CONFLICT(bucket_key) DO UPDATE SET attempts=santa_studio_checkout_limits.attempts+1
        WHERE santa_studio_checkout_limits.attempts < $3 RETURNING attempts`,
      [`${window}:${key}`, new Date((window + 1) * 900000), max]);
      if (!result.rowCount) { await client.query('ROLLBACK'); return false; }
    }
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

export async function startSandboxCheckout({ claim, origin, stripe, pool = databasePool() }) {
  const hash = claimHash(claim);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO public.santa_studio_checkout_attempts(claim_sha256) VALUES($1)
      ON CONFLICT DO NOTHING`, [hash]);
    const { rows: [attempt] } = await client.query(
      'SELECT checkout_session_id,generation FROM public.santa_studio_checkout_attempts WHERE claim_sha256=$1 FOR UPDATE', [hash]);
    let session;
    if (attempt.checkout_session_id) {
      session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
      if (session.livemode !== false) throw new Error('Sandbox required');
      if (session.status === 'complete') {
        const access = await confirmSandboxPurchase({ sessionId: session.id, claimToken: claim, stripe, pool: client });
        await client.query('COMMIT');
        return { sessionId: session.id, openStudio: access.authorized, pending: !access.authorized };
      }
    }
    if (!session || session.status === 'expired') {
      const price = assertFamilyPrice(await stripe.prices.retrieve(STUDIO_TEST_PRICE));
      if (price.product !== STUDIO_TEST_PRODUCT) throw new Error('Wrong product');
      const generation = attempt.generation + (session ? 1 : 0);
      session = await stripe.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'],
        line_items: [{ price: STUDIO_TEST_PRICE, quantity: 1 }],
        success_url: `${origin}/santa-message-workshop?checkout=return`,
        cancel_url: `${origin}/?studioCheckout=cancelled#santa-studio-promotion`,
        metadata: { offer: STUDIO_OFFER, access_claim_sha256: hash },
      }, { idempotencyKey: `studio-sandbox:${hash}:${generation}` });
      if (session.livemode !== false) throw new Error('Sandbox required');
      await client.query(`UPDATE public.santa_studio_checkout_attempts
        SET checkout_session_id=$2,generation=$3 WHERE claim_sha256=$1`, [hash, session.id, generation]);
    }
    const url = new URL(session.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected checkout URL');
    await client.query('COMMIT');
    return { sessionId: session.id, url: url.href };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

export function createStudioCheckoutHandler({
  getConfig = config, getStripe = getUncachableStripeClient,
  consume = limitCheckout, start = startSandboxCheckout,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Referrer-Policy', 'no-referrer');
    if (!['GET', 'POST'].includes(req.method)) return res.set('Allow', 'GET, POST').status(405).end();
    try { req.checkoutConfig = getConfig(); }
    catch { return res.status(503).json({ available: false, error: 'Sandbox purchases are available in the development preview only.' }); }
    if (req.headers['sec-fetch-site'] === 'cross-site'
      || (req.method === 'POST' && req.headers.origin !== req.checkoutConfig.origin)) {
      return res.status(403).json({ error: 'Open Purchase from this website to continue.' });
    }
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Expected JSON.' });
    next();
  });
  app.use(express.json({ limit: '1kb' }));
  app.use(async (req, res) => {
    const { secret, origin } = req.checkoutConfig;
    let claim = readCheckoutClaim(req, secret);
    if (req.method === 'GET') {
      if (!claim) {
        claim = randomBytes(32).toString('base64url');
        res.cookie(CHECKOUT_COOKIE, signedClaim(claim, secret), { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
      }
      return res.json({ available: true, sandbox: true });
    }
    if (!claim) return res.status(409).json({ error: 'Refresh this page before starting the sandbox purchase.' });
    if (!req.body || Object.keys(req.body).length) return res.status(400).json({ error: 'Purchase details are set by the server.' });
    try {
      if (!await consume(req, secret)) return res.status(429).set('Retry-After', '900').json({ error: 'Too many checkout attempts. Please wait 15 minutes.' });
      const result = await start({ claim, origin, stripe: await getStripe() });
      // Having this cookie is never payment proof. Every access check still asks Stripe.
      res.cookie(STUDIO_PAID_COOKIE, `${result.sessionId}.${claim}`, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
      return res.json({ url: result.url, openStudio: !!result.openStudio, pending: !!result.pending });
    } catch { return res.status(503).json({ error: 'Sandbox checkout is temporarily unavailable. Please try again.' }); }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid checkout request.' }));
  return app;
}
export default createStudioCheckoutHandler();
