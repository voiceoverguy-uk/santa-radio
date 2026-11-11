import express from 'express';
import Stripe from 'stripe';
import { liveStudioConfig, liveHeaders } from './studio-live-config.js';
import { liveStripeClient } from './studio-live-stripe.js';
import { databasePool } from './name-request-store.js';
import { reconcileLivePurchase, transaction, digest } from './studio-live-store.js';
import { deliverStudioReturn } from './studio-live-email.js';
import { syncPaidStudioContact } from './studio-paid-contacts.js';

export async function processLiveStudioEvent(event, { config, stripe, pool = databasePool() }) {
  // A correct signature is necessary, but also bind health/reconciliation to
  // the configured live account by retrieving the event through that account.
  const canonical = await stripe.events.retrieve(event.id);
  if (canonical.id !== event.id || canonical.livemode !== true || canonical.type !== event.type) {
    throw new Error('STUDIO_LIVE_EVENT_ACCOUNT_MISMATCH');
  }
  const relevant = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(canonical.type);
  let session;
  if (relevant) session = await stripe.checkout.sessions.retrieve(canonical.data.object.id, {
    expand: ['payment_intent', 'line_items.data.price.product'],
  });
  return transaction(pool, async client => {
    const inserted = await client.query(`INSERT INTO public.santa_studio_live_events(event_id)
      VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id`, [event.id]);
    if (!inserted.rowCount) {
      // A committed payment may still need its idempotent contact sync retried.
      const saved = session ? await client.query('SELECT 1 FROM public.santa_studio_live_purchases WHERE checkout_session_id=$1', [session.id]) : null;
      return { duplicate: true, sessionId: saved?.rowCount ? session.id : null };
    }
    let authorized = false;
    if (session) {
      if (session.id !== canonical.data.object.id) throw new Error('STUDIO_LIVE_EVENT_SESSION_MISMATCH');
      authorized = await reconcileLivePurchase(client, session, config);
    }
    await client.query(`INSERT INTO public.santa_studio_live_webhook_health(endpoint_id,secret_sha256) VALUES($1,$2)
      ON CONFLICT(endpoint_id) DO UPDATE SET verified_at=clock_timestamp(),secret_sha256=EXCLUDED.secret_sha256`,
    [config.webhookId, digest(config.webhookSecret)]);
    return { authorized, sessionId: authorized ? session.id : null };
  });
}

export function createLiveWebhookHandler({
  getConfig = liveStudioConfig, getStripe = liveStripeClient, getPool = databasePool,
  verify = (body, signature, secret) => Stripe.webhooks.constructEvent(body, signature, secret),
  process = processLiveStudioEvent, deliver = deliverStudioReturn, syncContact = syncPaidStudioContact,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { liveHeaders(res); res.set('X-Studio-Webhook-Mode', 'live'); next(); });
  app.use((req, res, next) => {
    if (req.method !== 'POST') return res.set('Allow', 'POST').status(405).end();
    if (typeof req.headers['stripe-signature'] !== 'string') return res.status(400).json({ error: 'Missing Stripe signature.' });
    next();
  });
  app.use(express.raw({ type: 'application/json', limit: '1mb', inflate: false }));
  app.use(async (req, res) => {
    let config, event;
    try {
      config = getConfig();
      if (!config.webhookSecret || !config.webhookId) throw new Error('STUDIO_WEBHOOK_NOT_CONFIGURED');
    } catch { return res.status(503).json({ error: 'Payment notifications are not configured.' }); }
    try {
      if (!Buffer.isBuffer(req.body)) throw new Error('Raw JSON required');
      event = verify(req.body, req.headers['stripe-signature'], config.webhookSecret);
      if (event.livemode !== true || !/^evt_[A-Za-z0-9]+$/.test(event.id || '')) throw new Error('Live notifications required');
    } catch { return res.status(400).json({ error: 'Invalid live payment notification.' }); }
    try {
      const stripe = await getStripe(config), pool = getPool();
      const result = await process(event, { config, stripe, pool });
      // Entitlement and outbox are already committed; an email outage must not
      // roll back successful payment. The scheduled worker retries delivery.
      if (result.sessionId) {
        try {
          const emailConfig = liveStudioConfig(globalThis.process.env, { email: true });
          await deliver({ config: emailConfig, stripe, pool, sessionId: result.sessionId });
        } catch { /* Durable outbox remains pending; no raw provider logging. */ }
        // Failure returns 503 for Stripe's webhook retry, after paid access commits.
        // Duplicate deliveries retry this idempotent sync without granting twice.
        await syncContact({ config, stripe, pool, sessionId: result.sessionId });
      }
      return res.json({ received: true });
    } catch { return res.status(503).json({ error: 'Payment notification could not be processed. Please retry.' }); }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid notification body.' }));
  return app;
}
