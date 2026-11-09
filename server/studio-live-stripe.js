import Stripe from 'stripe';
import { liveStudioConfig } from './studio-live-config.js';

// Boolean-only shape diagnostics. Never returns characters, lengths or prefixes
// beyond the two supported key families.
export function stripeCredentialShape(value) {
  const key = typeof value === 'string' ? value : '';
  const body = key.replace(/^(sk|rk)_live_/, '');
  return {
    present: key.length > 0,
    supportedFamily: /^(sk|rk)_live_/.test(key),
    testMode: /^(sk|rk|pk)_test_/.test(key),
    publishableKey: /^pk_/.test(key),
    surroundingWhitespace: key !== key.trim(),
    internalWhitespace: /\s/.test(key.trim()),
    quotes: /["'`]/.test(key),
    unsupportedCharacters: /[^A-Za-z0-9]/.test(body),
    accepted: /^(sk|rk)_live_[A-Za-z0-9]+$/.test(key),
  };
}

export async function liveStripeClient(config = liveStudioConfig(), env = process.env,
  createClient = (key, options) => new Stripe(key, options)) {
  if (!/^(sk|rk)_live_[A-Za-z0-9]+$/.test(env.STRIPE_LIVE_SECRET_KEY || '')) throw new Error('STUDIO_LIVE_STRIPE_CREDENTIAL_REQUIRED');
  const stripe = createClient(env.STRIPE_LIVE_SECRET_KEY, { apiVersion: '2020-08-27', timeout: 12000, maxNetworkRetries: 1 });
  const [balance, account] = await Promise.all([
    stripeStage('balance', () => stripe.balance.retrieve()),
    stripeStage('account', () => stripe.accounts.retrieve()),
  ]);
  if (balance.livemode !== true) throw new Error('STUDIO_LIVE_KEY_NOT_LIVE');
  if (account.id !== config.accountId) throw new Error('STUDIO_LIVE_ACCOUNT_MISMATCH');
  if (account.charges_enabled !== true) throw new Error('STUDIO_LIVE_CHARGES_DISABLED');
  return stripe;
}

// Labels which Stripe call failed without changing the original error.
export async function stripeStage(stage, work) {
  try { return await work(); } catch (error) {
    if (error && typeof error === 'object') error.studioStage ??= stage;
    throw error;
  }
}

const id = value => typeof value === 'string' ? value : value?.id;
export async function verifyLiveOffer(stripe, config) {
  const price = await stripeStage('price', () => stripe.prices.retrieve(config.priceId, { expand: ['product'] }));
  const product = price.product;
  if (price.id !== config.priceId || price.livemode !== true || price.active !== true
    || price.type !== 'one_time' || price.recurring || price.currency !== 'gbp'
    // Recent Stripe SDKs decode decimal fields as Decimal objects. Compare
    // their exact string representation, never rounded floating-point values.
    || price.unit_amount !== 650 || price.unit_amount_decimal !== undefined && String(price.unit_amount_decimal) !== '650'
    || id(product) !== config.productId || product?.livemode !== true || product?.active !== true) {
    throw new Error('STUDIO_LIVE_PRICE_NOT_VERIFIED');
  }
  return price;
}

// Prefixes are syntactic checks only; mode is proven on every expanded object.
export function verifiedLiveSession(session, config) {
  const lines = session?.line_items, line = lines?.data?.[0], price = line?.price;
  const payment = session?.payment_intent, product = price?.product;
  return !!(session?.livemode === true && session.mode === 'payment' && session.status === 'complete'
    && session.payment_status === 'paid' && session.amount_total === 650 && session.amount_subtotal === 650
    && session.currency === 'gbp' && session.metadata?.offer === config.offer
    && /^[a-f0-9]{64}$/.test(session.metadata?.access_claim_sha256 || '')
    && lines?.has_more === false && lines.data.length === 1 && line?.quantity === 1
    && line.amount_total === 650 && line.amount_subtotal === 650
    && session.total_details?.amount_discount === 0 && session.total_details.amount_shipping === 0
    && session.total_details.amount_tax === 0
    && price?.id === config.priceId && price.livemode === true && price.unit_amount === 650
    && price.currency === 'gbp' && price.type === 'one_time' && !price.recurring
    && id(product) === config.productId && product?.livemode === true
    && payment?.id && payment.livemode === true && payment.status === 'succeeded'
    && payment.amount === 650 && payment.amount_received === 650 && payment.currency === 'gbp'
    && payment.amount_capturable === 0);
}
