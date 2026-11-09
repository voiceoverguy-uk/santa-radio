import { createHmac } from 'node:crypto';
import { liveStudioConfig } from './studio-live-config.js';
import { liveStripeClient, verifyLiveOffer } from './studio-live-stripe.js';
import { liveStoreReady, digest, transaction } from './studio-live-store.js';
import { studioAllowanceReady } from './studio-creation-allowance.js';
import { probeSignature, webhookEvents } from './studio-live-readiness.js';
import { databasePool } from './name-request-store.js';
import { startOwnerCanary } from './studio-live-checkout.js';
import { LIVE_CHECKOUT_COOKIE, LIVE_PENDING_COOKIE, cookieOptions, signLiveClaim } from './studio-live-access.js';

// Owner-only bootstrap: checking delivery must not require approving delivery
// first. No public route uses this configuration and process.env is unchanged.
export function ownerConfig(env = process.env) {
  return liveStudioConfig({ ...env, STUDIO_EMAIL_RETRY_APPROVED: 'true' }, { email: true });
}

export async function ownerReadiness({
  config = ownerConfig(), pool = databasePool(), stripe, fetcher = fetch, env = process.env,
} = {}) {
  const checks = {};
  const check = async (name, work) => {
    try { await work(); checks[name] = true; } catch { checks[name] = false; }
  };
  await check('database', async () => { await liveStoreReady(pool); await studioAllowanceReady(pool); });
  await check('stripe', async () => { stripe ||= await liveStripeClient(config); await verifyLiveOffer(stripe, config); });
  await check('webhookEndpoint', async () => {
    if (!stripe) throw new Error('Unavailable');
    const e = await stripe.webhookEndpoints.retrieve(config.webhookId);
    if (e.livemode !== true || e.status !== 'enabled' || e.url !== `${config.origin}/api/stripe/webhook`
      || !webhookEvents.every(t => e.enabled_events.includes(t) || e.enabled_events.includes('*'))) throw new Error('Unavailable');
  });
  await check('renderer', async () => {
    const r = await fetcher(`${config.origin}/api/santa-studio-message`, {
      headers: { 'X-Studio-Delivery-Probe': probeSignature(config) },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    const data = await r.json();
    if (!r.ok || data.ready !== true || data.offer !== config.offer) throw new Error('Unavailable');
  });
  await check('webhookDelivery', async () => {
    const r = await pool.query('SELECT 1 FROM public.santa_studio_live_webhook_health WHERE endpoint_id=$1 AND secret_sha256=$2',
      [config.webhookId, digest(config.webhookSecret)]);
    if (!r.rowCount) throw new Error('Unavailable');
  });
  await check('sender', async () => {
    const r = await pool.query("SELECT 1 FROM public.santa_studio_live_email_health WHERE sender=$1 AND verified_at>clock_timestamp()-interval '48 hours'", [config.emailFrom]);
    if (!r.rowCount) throw new Error('Unavailable');
  });
  await check('worker', async () => {
    const r = await pool.query("SELECT 1 FROM public.santa_studio_live_worker_health WHERE worker='email-retry' AND verified_at>clock_timestamp()-interval '15 minutes'");
    if (!r.rowCount) throw new Error('Unavailable');
  });
  checks.retryApproved = env.STUDIO_EMAIL_RETRY_APPROVED === 'true';
  const canaryReady = ['database', 'stripe', 'webhookEndpoint', 'renderer', 'sender', 'worker', 'retryApproved'].every(k => checks[k]);
  return { checks, canaryReady, deliveryReady: canaryReady && checks.webhookDelivery };
}

export async function probeOwnerWorker({ config = ownerConfig(), fetcher = fetch } = {}) {
  const r = await fetcher(`${config.origin}/api/santa-studio-email-retry`, {
    headers: { Authorization: `Bearer ${config.cronSecret}`, 'X-Studio-Simulator-Only': '1' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  const data = await r.json();
  if (!r.ok || data.simulatorAccepted !== true || data.workerVerified !== true) throw new Error('STUDIO_WORKER_PROBE_FAILED');
  return { simulatorAccepted: true, workerVerified: true };
}

// Does not drain the outbox. Lock it while checking and sending the simulator,
// so a concurrent purchase cannot turn this into a customer-email test.
export async function simulateOwnerEmail({ config = ownerConfig(), pool = databasePool(), fetcher = fetch } = {}) {
  return transaction(pool, async client => {
    await client.query('LOCK TABLE public.santa_studio_live_email IN SHARE ROW EXCLUSIVE MODE');
    const pending = await client.query('SELECT 1 FROM public.santa_studio_live_email WHERE sent_at IS NULL LIMIT 1');
    if (pending.rowCount) throw new Error('STUDIO_OUTBOX_NOT_EMPTY');
    const r = await fetcher('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${config.emailKey}`, 'Content-Type': 'application/json',
        'User-Agent': 'SantaRadioStudio', 'Idempotency-Key': `studio-owner-simulator:${Math.floor(Date.now() / 60000)}` },
      body: JSON.stringify({ from: `Santa Radio <${config.emailFrom}>`,
        to: ['delivered+studio-health@resend.dev'], subject: 'Studio sender readiness check',
        text: 'Owner-requested simulated delivery only. No customer data, purchase or access link.' }),
    });
    if (!r.ok || typeof (await r.json()).id !== 'string') throw new Error('STUDIO_SIMULATOR_FAILED');
    await client.query(`INSERT INTO public.santa_studio_live_email_health(sender) VALUES($1)
      ON CONFLICT(sender) DO UPDATE SET verified_at=clock_timestamp()`, [config.emailFrom]);
    return { simulatorAccepted: true };
  });
}

export async function ownerCanary(req, res, {
  config = ownerConfig(), pool = databasePool(), readiness = ownerReadiness,
  getStripe = liveStripeClient, start = startOwnerCanary,
} = {}) {
  const stripe = await getStripe(config);
  const report = await readiness({ config, pool, stripe });
  if (!report.canaryReady) return res.status(409).json({ error: 'Other readiness checks must pass before the owner canary.', ...report });
  const claim = createHmac('sha256', config.secret).update('studio-owner-canary-v1').digest('base64url');
  const result = await start({ claim, config, stripe, pool });
  res.cookie(LIVE_CHECKOUT_COOKIE, signLiveClaim(claim, config), cookieOptions);
  res.cookie(LIVE_PENDING_COOKIE, result.sessionId, cookieOptions);
  return res.json({ url: result.url, pending: !!result.pending });
}
