import express from 'express';
import { randomBytes } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { liveStudioConfig, sameLiveOrigin, liveHeaders } from './studio-live-config.js';
import { liveStripeClient, verifyLiveOffer } from './studio-live-stripe.js';
import { studioLiveReadiness } from './studio-live-readiness.js';
import { digest, transaction, consumeLiveAttempt } from './studio-live-store.js';
import { LIVE_CHECKOUT_COOKIE, LIVE_PENDING_COOKIE, cookieOptions, liveCheckoutClaim, signLiveClaim } from './studio-live-access.js';

export async function startLiveCheckout({ claim, config, stripe, pool = databasePool() }) {
  const hash = digest(claim);
  return transaction(pool, async client => {
    // Serialise creation against the operator's durable emergency switch:
    // after its disabling UPDATE commits, no new checkout can start.
    const sales = await client.query("SELECT enabled FROM public.santa_studio_live_sales_settings WHERE key='public' FOR SHARE");
    if (sales.rows[0]?.enabled !== true) throw new Error('STUDIO_LIVE_SALES_DISABLED');
    await client.query('INSERT INTO public.santa_studio_live_attempts(claim_sha256) VALUES($1) ON CONFLICT DO NOTHING', [hash]);
    const { rows: [attempt] } = await client.query(`SELECT checkout_session_id,generation FROM public.santa_studio_live_attempts
      WHERE claim_sha256=$1 FOR UPDATE`, [hash]);
    let session;
    if (attempt.checkout_session_id) {
      session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
      if (session.id !== attempt.checkout_session_id || session.livemode !== true
        || session.metadata?.offer !== config.offer || session.metadata?.access_claim_sha256 !== hash) {
        throw new Error('STUDIO_LIVE_CHECKOUT_MISMATCH');
      }
      if (session.status === 'complete') return { sessionId: session.id, pending: true };
      if (!['open', 'expired'].includes(session.status)) throw new Error('STUDIO_LIVE_CHECKOUT_STATUS_INVALID');
    }
    if (!session || session.status === 'expired') {
      await verifyLiveOffer(stripe, config);
      const generation = attempt.generation + (session ? 1 : 0);
      session = await stripe.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'],
        line_items: [{ price: config.priceId, quantity: 1 }],
        success_url: `${config.origin}/santa-message-workshop?checkout=return`,
        cancel_url: `${config.origin}/?studioCheckout=cancelled#santa-studio-promotion`,
        metadata: { offer: config.offer, access_claim_sha256: hash },
        // No account/signup, discounts, adjustable quantities, tax or subscriptions.
        custom_text: { submit: { message: '£6.50 once. Personalised content for one child. Download your MP3 and gifts before leaving Studio. Your purchase email receives a private return link, not an archive of recordings.' } },
      }, { idempotencyKey: `studio-live:${hash}:${generation}` });
      if (session.livemode !== true || session.metadata?.access_claim_sha256 !== hash
        || session.metadata?.offer !== config.offer) throw new Error('STUDIO_LIVE_CHECKOUT_MISMATCH');
      await client.query(`UPDATE public.santa_studio_live_attempts SET checkout_session_id=$2,generation=$3
        WHERE claim_sha256=$1`, [hash, session.id, generation]);
    }
    const url = new URL(session.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('STUDIO_CHECKOUT_URL_INVALID');
    return { sessionId: session.id, url: url.href };
  });
}

export function createLiveCheckoutHandler({
  getConfig = () => liveStudioConfig(process.env, { sales: true }), getStripe = liveStripeClient,
  getPool = databasePool, readiness = studioLiveReadiness, consume = consumeLiveAttempt, start = startLiveCheckout,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    liveHeaders(res);
    if (!['GET', 'POST'].includes(req.method)) return res.set('Allow', 'GET, POST').status(405).end();
    try { req.studioConfig = getConfig(); }
    catch { return res.status(503).json({ available: false, error: 'Purchases are currently unavailable. Voucher access is unchanged.' }); }
    if (req.headers.host !== new URL(req.studioConfig.origin).host || req.headers['sec-fetch-site'] === 'cross-site'
      || req.method === 'POST' && !sameLiveOrigin(req, req.studioConfig)) {
      return res.status(403).json({ available: false, error: 'Start Purchase from the Santa Radio website.' });
    }
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Expected JSON.' });
    next();
  });
  app.use(express.json({ limit: '1kb', strict: true, inflate: false }));
  app.use(async (req, res) => {
    const config = req.studioConfig;
    try {
      const pool = getPool();
      // Readiness requests consume a budget too: do not let public polling
      // fan out unlimited upstream Stripe/probe requests.
      if (!await consume(req, config, req.method === 'GET' ? 'readiness' : 'checkout', pool)) {
        return res.set('Retry-After', '900').status(429).json({ available: false, error: 'Please wait before trying again.' });
      }
      if (req.method === 'POST' && (!req.body || Object.keys(req.body).length)) {
        return res.status(400).json({ error: 'Purchase details are set by the server.' });
      }
      let claim = liveCheckoutClaim(req, config);
      if (req.method === 'POST' && !claim) return res.status(409).json({ error: 'Refresh this page before purchasing.' });
      const stripe = await getStripe(config);
      await readiness({ config, stripe, pool });
      if (req.method === 'GET') {
        if (!claim) {
          claim = randomBytes(32).toString('base64url');
          res.cookie(LIVE_CHECKOUT_COOKIE, signLiveClaim(claim, config), cookieOptions);
        }
        return res.json({ available: true, mode: 'live', sandbox: false, amount: 650, currency: 'gbp' });
      }
      const result = await start({ claim, config, stripe, pool });
      res.cookie(LIVE_PENDING_COOKIE, result.sessionId, cookieOptions);
      return res.json({ url: result.url, pending: !!result.pending });
    } catch {
      return res.status(503).json({ available: false, error: 'Checkout is temporarily unavailable. Voucher access is unchanged.' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid checkout request.' }));
  return app;
}
