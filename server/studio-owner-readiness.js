import { createHmac } from 'node:crypto';
import { liveStudioConfig } from './studio-live-config.js';
import { liveStripeClient, verifyLiveOffer, stripeStage, stripeCredentialShape } from './studio-live-stripe.js';
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

const SAFE_TOKEN = /^[a-z0-9_.-]{1,80}$/i;
// Authenticated owner report only. Never return connection strings or roles.
export async function ownerLaunchState(pool, env = process.env) {
  const state = { database: null, publicSales: null,
    salesEnvironmentEnabled: env.STUDIO_LIVE_SALES_ENABLED === 'true',
    deliveryApproved: env.STUDIO_LIVE_DELIVERY_APPROVED === 'santa-message-maker-one-child-v1' };
  const identifier = value => typeof value === 'string' && SAFE_TOKEN.test(value) ? value : null;
  try {
    const { rows: [row] } = await pool.query(`SELECT current_database() AS name,
      current_setting('neon.project_id', true) AS project,
      current_setting('neon.branch_id', true) AS branch,
      current_setting('neon.endpoint_id', true) AS endpoint,
      pg_is_in_recovery() AS recovery,
      current_setting('transaction_read_only') AS read_only`);
    state.database = { name: identifier(row.name), project: identifier(row.project),
      branch: identifier(row.branch), endpoint: identifier(row.endpoint),
      writable: row.recovery === false && row.read_only === 'off' };
    const sales = await pool.query("SELECT enabled FROM public.santa_studio_live_sales_settings WHERE key='public'");
    state.publicSales = { rowExists: sales.rows.length === 1, enabled: sales.rows[0]?.enabled === true };
  } catch { state.error = 'STUDIO_LAUNCH_STATE_UNAVAILABLE'; }
  return state;
}
// Fixed diagnostic fields only. Stripe messages can contain partial key text,
// request details or account data, so they are never returned.
export function safeCheckFailure(error) {
  const failure = {};
  if (SAFE_TOKEN.test(error?.studioStage || '')) failure.stage = error.studioStage;
  if (/^STUDIO_[A-Z0-9_]{1,70}$/.test(error?.message || '')) failure.code = error.message;
  for (const key of ['type', 'code', 'decline_code']) {
    const value = error?.[key] ?? error?.raw?.[key];
    if (typeof value === 'string' && SAFE_TOKEN.test(value)) failure[key === 'code' ? 'stripeCode' : key] = value;
  }
  if (Number.isInteger(error?.statusCode) && error.statusCode >= 100 && error.statusCode <= 599) failure.status = error.statusCode;
  return Object.keys(failure).length ? failure : { code: 'UNCLASSIFIED' };
}

export async function ownerReadiness({
  config = ownerConfig(), pool = databasePool(), stripe, fetcher = fetch, env = process.env,
} = {}) {
  const checks = {}, failures = {};
  let pendingEmailCount = null;
  const check = async (name, work) => {
    try { await work(); checks[name] = true; } catch (error) { checks[name] = false; failures[name] = safeCheckFailure(error); }
  };
  await check('database', async () => { await liveStoreReady(pool); await studioAllowanceReady(pool); });
  await check('outboxCount', async () => {
    try {
      // Same pool and unsent predicate as deliverStudioReturn. Include deferred
      // retries: next_attempt_at controls when to send, not whether mail is unsent.
      const { rows } = await pool.query('SELECT count(*) AS count FROM public.santa_studio_live_email WHERE sent_at IS NULL');
      const value = rows?.[0]?.count;
      if (!/^(0|[1-9][0-9]*)$/.test(String(value))) throw new Error();
      const count = Number(value);
      if (!Number.isSafeInteger(count)) throw new Error();
      pendingEmailCount = count;
    } catch {
      throw new Error('STUDIO_OUTBOX_COUNT_UNAVAILABLE');
    }
  });
  await check('stripe', async () => { stripe ||= await liveStripeClient(config); await verifyLiveOffer(stripe, config); });
  await check('webhookEndpoint', async () => {
    if (!stripe) throw new Error('STUDIO_STRIPE_CLIENT_UNAVAILABLE');
    const e = await stripeStage('webhook', () => stripe.webhookEndpoints.retrieve(config.webhookId));
    if (e.livemode !== true) throw new Error('STUDIO_WEBHOOK_NOT_LIVE');
    if (e.status !== 'enabled') throw new Error('STUDIO_WEBHOOK_DISABLED');
    if (e.url !== `${config.origin}/api/stripe/webhook`) throw new Error('STUDIO_WEBHOOK_URL_MISMATCH');
    if (!webhookEvents.every(t => e.enabled_events.includes(t) || e.enabled_events.includes('*'))) throw new Error('STUDIO_WEBHOOK_EVENTS_MISSING');
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
    if (!r.rowCount) throw new Error('STUDIO_WEBHOOK_DELIVERY_NOT_RECORDED');
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
  return { checks, failures, pendingEmailCount, launch: await ownerLaunchState(pool, env), stripeCredential: stripeCredentialShape(env.STRIPE_LIVE_SECRET_KEY), canaryReady, deliveryReady: canaryReady && checks.webhookDelivery };
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
