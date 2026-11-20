import {DAD_LAUNCH_AT, dadSalesOpen} from '../src/lib/dadLaunch.js';
import express from 'express';
import { STUDIO_PATH } from '../src/lib/dadRoute.js';
import { randomBytes } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { liveStudioConfig, sameLiveOrigin, liveHeaders } from './dad-live-config.js';
import { liveStripeClient, verifyLiveOffer } from './dad-live-stripe.js';
import { studioLiveReadiness } from './dad-live-readiness.js';
import { digest, transaction, consumeLiveAttempt } from './dad-live-store.js';
import { LIVE_CHECKOUT_COOKIE, LIVE_PENDING_COOKIE, cookieOptions, liveCheckoutClaim, signLiveClaim } from './dad-live-access.js';

export async function startLiveCheckout({ claim, config, stripe, pool = databasePool() }) {
  return startCheckout({ claim, config, stripe, pool }, false);
}

// Only the approved-owner handler may call this. Public checkout never accepts
// a canary flag, and the owner handler derives one stable claim server-side.
export async function startOwnerCanary(options) {
  return startCheckout(options, true);
}

async function startCheckout({ claim, config, stripe, pool = databasePool() }, ownerCanary) {
  if (!ownerCanary && !dadSalesOpen()) throw new Error('DAD_SALES_NOT_OPEN');
  const hash = digest(claim);
  const embedded = false;
  return transaction(pool, async client => {
    // Serialise creation against the operator's durable emergency switch:
    // after its disabling UPDATE commits, no new checkout can start.
    const sales = await client.query("SELECT enabled FROM public.santa_dad_live_sales_settings WHERE key='public' FOR SHARE");
    if (!ownerCanary && sales.rows[0]?.enabled !== true) throw new Error('STUDIO_LIVE_SALES_DISABLED');
    await client.query('INSERT INTO public.santa_dad_live_attempts(claim_sha256) VALUES($1) ON CONFLICT DO NOTHING', [hash]);
    const { rows: [attempt] } = await client.query(`SELECT checkout_session_id,generation FROM public.santa_dad_live_attempts
      WHERE claim_sha256=$1 FOR UPDATE`, [hash]);
    let session;
    if (attempt.checkout_session_id) {
      session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
      if (session.id !== attempt.checkout_session_id || session.livemode !== true
        || session.metadata?.offer !== config.offer || session.metadata?.access_claim_sha256 !== hash) {
        throw new Error('STUDIO_LIVE_CHECKOUT_MISMATCH');
      }
      if (session.status === 'complete') {
        const spent = await client.query(`SELECT p.checkout_session_id
          FROM public.santa_dad_live_purchases p
          JOIN public.santa_dad_creation_allowances a ON a.access_key=$2
          WHERE p.checkout_session_id=$1 AND p.claim_sha256=$3 AND cardinality(a.operations)=1`,
          [session.id, digest(`dad-purchase:${session.id}`), hash]);
        if (!spent.rows.length) return { sessionId: session.id, pending: true };
      }
      if (!['open', 'expired', 'complete'].includes(session.status)) throw new Error('STUDIO_LIVE_CHECKOUT_STATUS_INVALID');
    }
    if (!session || session.status === 'expired' || session.status === 'complete') {
      await verifyLiveOffer(stripe, config);
      const generation = attempt.generation + (session ? 1 : 0);
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        allow_promotion_codes: true,
        custom_fields: [{ key: 'purchaser_first_name', label: { type: 'custom', custom: 'Your first name (adult purchasing)' }, type: 'text', optional: false, text: { minimum_length: 1, maximum_length: 80 } }],
        line_items: [{ price: config.priceId, quantity: 1 }],
        ...(embedded ? {
          ui_mode: 'embedded',
          branding_settings: { display_name: 'Santa Radio', background_color: '#ffffff',
            button_color: '#9B111E', font_family: 'inter', border_style: 'rounded' },
          return_url: `${config.origin}${STUDIO_PATH}?checkout=return`,
        } : {
          success_url: `${config.origin}${STUDIO_PATH}?checkout=return`,
          cancel_url: `${config.origin}${STUDIO_PATH}?checkout=cancelled`,
        }),
        metadata: { offer: config.offer, access_claim_sha256: hash },
        // Stripe applies eligible promotion codes; the price and quantity stay pinned.
        custom_text: { submit: { message: '£5 before any eligible promotion includes one personalised Dad message creation as an MP4. Download your MP4 before leaving Studio. Your email link preserves remaining allowance, not recordings.' } },
      }, { idempotencyKey: `dad-live:${hash}:${generation}` });
      if (session.livemode !== true || session.metadata?.access_claim_sha256 !== hash
        || session.metadata?.offer !== config.offer) throw new Error('STUDIO_LIVE_CHECKOUT_MISMATCH');
      await client.query(`UPDATE public.santa_dad_live_attempts SET checkout_session_id=$2,generation=$3
        WHERE claim_sha256=$1`, [hash, session.id, generation]);
    }
    if (['embedded', 'embedded_page'].includes(session.ui_mode)) {
      if (!embedded || typeof session.client_secret !== 'string' || !session.client_secret.startsWith(`${session.id}_secret_`)) {
        throw new Error('STUDIO_EMBEDDED_SESSION_INVALID');
      }
      return { sessionId: session.id, clientSecret: session.client_secret };
    }
    const url = new URL(session.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('STUDIO_CHECKOUT_URL_INVALID');
    return { sessionId: session.id, url: url.href };
  });
}

export function createLiveCheckoutHandler({
  getConfig = () => liveStudioConfig(process.env, { sales: true }), getStripe = liveStripeClient,
  getPool = databasePool, readiness = studioLiveReadiness, consume = consumeLiveAttempt, start = startLiveCheckout, now = Date.now,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    liveHeaders(res);
    if (!['GET', 'POST'].includes(req.method)) return res.set('Allow', 'GET, POST').status(405).end();
    try { req.studioConfig = getConfig(); }
    catch { return res.status(503).json({ available: false, error: 'Purchases are currently unavailable. ' }); }
    if (req.headers.host !== new URL(req.studioConfig.origin).host || req.headers['sec-fetch-site'] === 'cross-site'
      || req.method === 'POST' && !sameLiveOrigin(req, req.studioConfig)) {
      return res.status(403).json({ available: false, error: 'Start Purchase from the Santa Radio website.' });
    }
    if (req.method === 'POST' && !dadSalesOpen(now())) return res.status(503).json({available:false, opensAt:DAD_LAUNCH_AT, error:'Dad messages are available from 9am Saturday 21st November.'});
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Expected JSON.' });
    next();
  });
  app.use(express.json({ limit: '1kb', strict: true, inflate: false }));
  app.use(async (req, res) => {
    const config = req.studioConfig;
    try {
      if (req.method === 'GET' && req.query.prepare === '1' && !dadSalesOpen(now())) return res.json({configured:false, available:false, opensAt:DAD_LAUNCH_AT});
      const pool = getPool();
      // Readiness requests consume a budget too: do not let public polling
      // fan out unlimited upstream Stripe/probe requests.
      if (!await consume(req, config, req.method === 'GET' ? 'readiness' : 'checkout', pool)) {
        return res.set('Retry-After', '900').status(429).json({ available: false, error: 'Please wait before trying again.' });
      }
      if (req.method === 'POST' && (!req.body || Object.keys(req.body).length)) {
        return res.status(400).json({ error: 'Purchase details are set by the server.' });
      }
      const sales = await pool.query("SELECT enabled FROM public.santa_dad_live_sales_settings WHERE key='public'");
      if (sales.rows[0]?.enabled !== true) throw new Error('DAD_SALES_DISABLED');
      let claim = liveCheckoutClaim(req, config);
      if (req.method === 'POST' && !claim) return res.status(409).json({ error: 'Refresh this page before purchasing.' });
      // Bootstrap only sets the signed browser claim. The POST still performs
      // every readiness check before creating or resuming a payment session.
      if (req.method === 'GET' && req.query.prepare === '1') {
        if (!claim) {
          claim = randomBytes(32).toString('base64url');
          res.cookie(LIVE_CHECKOUT_COOKIE, signLiveClaim(claim, config), cookieOptions);
        }
        return res.json({ configured: true, mode: 'live', amount: 500, currency: 'gbp',
          checkoutMode: 'hosted', publishableKey: config.publishableKey || undefined });
      }
      const stripe = await getStripe(config);
      await readiness({ config, stripe, pool });
      if (req.method === 'GET') {
        if (!claim) {
          claim = randomBytes(32).toString('base64url');
          res.cookie(LIVE_CHECKOUT_COOKIE, signLiveClaim(claim, config), cookieOptions);
        }
        return res.json({ available: dadSalesOpen(now()), ready: true, opensAt: DAD_LAUNCH_AT, mode: 'live', sandbox: false, amount: 500, currency: 'gbp',
          checkoutMode: 'hosted', publishableKey: config.publishableKey || undefined });
      }
      const result = await start({ claim, config, stripe, pool });
      res.cookie(LIVE_PENDING_COOKIE, result.sessionId, cookieOptions);
      return res.json({ url: result.url, clientSecret: result.clientSecret, pending: !!result.pending });
    } catch (error) {
      console.warn('[studio-checkout]', { code: /^[A-Z0-9_]{1,80}$/.test(error?.code || error?.message || '') ? (error.code || error.message) : 'CHECKOUT_UNAVAILABLE' });
      return res.status(503).json({ available: false, error: 'Checkout is temporarily unavailable. ' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid checkout request.' }));
  return app;
}
