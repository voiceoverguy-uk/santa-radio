import Stripe from 'stripe';
import { StripeSync, runMigrations } from 'stripe-replit-sync';

export function requireSandboxWorkspace(env = process.env) {
  if (env.REPLIT_DEPLOYMENT === '1' || env.VERCEL === '1' || !env.REPL_IDENTITY) {
    throw new Error('STRIPE_SANDBOX_WORKSPACE_ONLY');
  }
}

export function sandboxCredentials(data) {
  const rows = data?.items?.filter(item => item.connector_name === 'stripe' && !item.disabled) || [];
  if (rows.length !== 1) throw new Error('STRIPE_CONNECTION_AMBIGUOUS_OR_MISSING');
  const settings = rows[0].settings;
  // The native connector currently calls these fields secret/publishable.
  // Accept the older documented names as well, without a live-key fallback.
  const secretKey = settings?.secret ?? settings?.secret_key;
  if (typeof secretKey !== 'string') throw new Error('STRIPE_MANAGED_SECRET_MISSING');
  if (!/^(sk|rk)_test_/.test(secretKey)) throw new Error('STRIPE_TEST_KEY_REQUIRED');
  return { secretKey };
}

async function credentials() {
  requireSandboxWorkspace();
  const host = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!host) throw new Error('STRIPE_CONNECTOR_ENVIRONMENT_MISSING');
  const response = await fetch(
    `https://${host}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    { headers: { Accept: 'application/json', X_REPLIT_TOKEN: `repl ${process.env.REPL_IDENTITY}` },
      signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new Error(`STRIPE_CONNECTOR_HTTP_${response.status}`);
  return sandboxCredentials(await response.json());
}

async function verifiedClient() {
  const { secretKey } = await credentials();
  const stripe = new Stripe(secretKey, { apiVersion: '2020-08-27', timeout: 20000, maxNetworkRetries: 2 });
  if ((await stripe.balance.retrieve()).livemode !== false) throw new Error('STRIPE_SANDBOX_REQUIRED');
  return { stripe, secretKey };
}

export async function getUncachableStripeClient() {
  return (await verifiedClient()).stripe;
}

// Sync's own logger may print upstream objects. Keep operational output bounded
// and never print raw Stripe errors, keys, webhook secrets, contact data or URLs.
const quietLogger = { info() {}, warn() {}, error() {}, debug() {} };

export async function getStripeSync() {
  const { secretKey } = await verifiedClient();
  if (!process.env.DATABASE_URL) throw new Error('STRIPE_DATABASE_REQUIRED');
  return new StripeSync({
    stripeSecretKey: secretKey,
    stripeApiVersion: '2020-08-27',
    poolConfig: { connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 1000 },
    logger: quietLogger,
  });
}

export async function initializeSandboxStripe() {
  // Explicit workspace preparation only; never migrate a published app at startup.
  await getUncachableStripeClient();
  if (!process.env.DATABASE_URL) throw new Error('STRIPE_DATABASE_REQUIRED');
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (!domain || !/^[a-z0-9.-]+\.replit\.dev$/.test(domain)) throw new Error('STRIPE_WORKSPACE_DOMAIN_REQUIRED');
  await runMigrations({ databaseUrl: process.env.DATABASE_URL });
  const sync = await getStripeSync();
  const webhook = await sync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
  await sync.syncBackfill({ object: 'all' });
  return { webhookId: webhook.id, livemode: webhook.livemode };
}
