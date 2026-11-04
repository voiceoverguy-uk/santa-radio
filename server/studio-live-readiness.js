import { createHmac } from 'node:crypto';
import { liveStudioConfig } from './studio-live-config.js';
import { liveStripeClient, verifyLiveOffer } from './studio-live-stripe.js';
import { liveStoreReady, digest } from './studio-live-store.js';
import { databasePool } from './name-request-store.js';
import { studioAllowanceReady } from './studio-creation-allowance.js';

export const probeSignature = config => createHmac('sha256', config.secret).update('studio-live-delivery-probe').digest('base64url');
export const webhookEvents = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];

export async function studioLiveReadiness({
  config = liveStudioConfig(process.env, { sales: true }), stripe, pool = databasePool(), fetcher = fetch,
} = {}) {
  stripe ||= await liveStripeClient(config);
  await verifyLiveOffer(stripe, config);
  await liveStoreReady(pool);
  await studioAllowanceReady(pool);
  const sales = await pool.query("SELECT enabled FROM public.santa_studio_live_sales_settings WHERE key='public'");
  if (sales.rows[0]?.enabled !== true) throw new Error('STUDIO_LIVE_SALES_DISABLED');
  const endpoint = await stripe.webhookEndpoints.retrieve(config.webhookId);
  if (endpoint.id !== config.webhookId || endpoint.livemode !== true || endpoint.status !== 'enabled'
    || endpoint.url !== `${config.origin}/api/stripe/webhook`
    || !webhookEvents.every(type => endpoint.enabled_events?.includes(type) || endpoint.enabled_events?.includes('*'))) {
    throw new Error('STUDIO_LIVE_WEBHOOK_NOT_READY');
  }
  const health = await pool.query('SELECT 1 FROM public.santa_studio_live_webhook_health WHERE endpoint_id=$1 AND secret_sha256=$2',
    [config.webhookId, digest(config.webhookSecret)]);
  if (!health.rowCount) throw new Error('STUDIO_LIVE_WEBHOOK_DELIVERY_NOT_VERIFIED');
  const emailHealth = await pool.query(`SELECT 1 FROM public.santa_studio_live_email_health
    WHERE sender=$1 AND verified_at > clock_timestamp()-interval '48 hours'`, [config.emailFrom]);
  if (!emailHealth.rowCount) throw new Error('STUDIO_LIVE_EMAIL_DELIVERY_NOT_VERIFIED');
  const worker = await pool.query(`SELECT 1 FROM public.santa_studio_live_worker_health
    WHERE worker='email-retry' AND verified_at>clock_timestamp()-interval '15 minutes'`);
  if (!worker.rowCount) throw new Error('STUDIO_LIVE_EMAIL_RETRY_NOT_RUNNING');
  const webhookProbe = await fetcher(`${config.origin}/api/stripe/webhook`, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (webhookProbe.status !== 405 || webhookProbe.headers.get('x-studio-webhook-mode') !== 'live') {
    throw new Error('STUDIO_LIVE_WEBHOOK_UNREACHABLE');
  }
  const response = await fetcher(`${config.origin}/api/santa-studio-message`, {
    headers: { 'X-Studio-Delivery-Probe': probeSignature(config) },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  if (!response.ok || body.ready !== true || body.offer !== config.offer) throw new Error('STUDIO_LIVE_RENDERER_NOT_READY');
  return { available: true, mode: 'live', amount: 650, currency: 'gbp' };
}
