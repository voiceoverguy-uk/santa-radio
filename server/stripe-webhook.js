import express from 'express';
import { getStripeSync } from './stripeClient.js';

export function createStripeWebhookHandler({ getSync = getStripeSync } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use((req, res, next) => {
    if (req.method !== 'POST') return res.set('Allow', 'POST').status(405).end();
    if (typeof req.headers['stripe-signature'] !== 'string') {
      return res.status(400).json({ error: 'Missing Stripe signature.' });
    }
    next();
  });
  app.use(express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Raw JSON body required.' });
    // This is rejection-only. Authentication and processing remain entirely in
    // the package, which verifies the signature against its managed secret.
    try {
      if (JSON.parse(req.body.toString('utf8'))?.livemode !== false) {
        return res.status(400).json({ error: 'Sandbox notifications only.' });
      }
    } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
    try {
      const sync = await getSync();
      await sync.processWebhook(req.body, req.headers['stripe-signature']);
      res.json({ received: true });
    } catch (error) {
      const invalid = error.type === 'StripeSignatureVerificationError';
      res.status(invalid ? 400 : 503).json({
        error: invalid ? 'Invalid Stripe signature.' : 'Sandbox notification could not be processed.',
      });
    }
  });
  app.use((error, _req, res, _next) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid notification body.' });
  });
  return app;
}

export default createStripeWebhookHandler();
