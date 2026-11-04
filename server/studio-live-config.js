// Live website sales only. Never use a workspace/preview key as a fallback.
export const LIVE_STUDIO_OFFER = 'santa-message-maker-one-child-v1';
export const LIVE_STUDIO_PRODUCT = 'prod_VWf75hpXU4wuRq';
export const LIVE_STUDIO_PRICE = 'price_1UVbmo8OzIo5fGDTEfPyRcBq';
export const LIVE_STUDIO_ACCOUNT = 'acct_1SSOVl8OzIo5fGDT';
export const LIVE_STUDIO_ORIGIN = 'https://www.santaradio.co.uk';
export const liveProduction = (env = process.env) => env.VERCEL === '1' && env.VERCEL_ENV === 'production';

export function liveStudioConfig(env = process.env, { sales = false, email = false } = {}) {
  if (!liveProduction(env)) throw new Error('STUDIO_LIVE_PRODUCTION_ONLY');
  if (env.STUDIO_LIVE_ORIGIN !== LIVE_STUDIO_ORIGIN
    || env.STUDIO_LIVE_ACCOUNT_ID !== LIVE_STUDIO_ACCOUNT
    || env.STUDIO_LIVE_PRODUCT_ID !== LIVE_STUDIO_PRODUCT
    || env.STUDIO_LIVE_PRICE_ID !== LIVE_STUDIO_PRICE) throw new Error('STUDIO_LIVE_OFFER_CONFIGURATION_REQUIRED');
  if (!env.DATABASE_URL || (env.STUDIO_RETURN_SECRET || '').length < 32) {
    throw new Error('STUDIO_LIVE_CREDENTIALS_REQUIRED');
  }
  // Existing paid sessions and voucher users must survive a new-sales shutoff,
  // missing Stripe key or email outage. Those credentials are sales-only gates.
  if (sales && !/^(sk|rk)_live_[A-Za-z0-9]+$/.test(env.STRIPE_LIVE_SECRET_KEY || '')) {
    throw new Error('STUDIO_LIVE_STRIPE_CREDENTIAL_REQUIRED');
  }
  if (sales && (env.STUDIO_LIVE_SALES_ENABLED !== 'true'
    || env.STUDIO_LIVE_DELIVERY_APPROVED !== LIVE_STUDIO_OFFER)) throw new Error('STUDIO_LIVE_SALES_DISABLED');
  if ((sales || email) && (!/^whsec_[A-Za-z0-9]+$/.test(env.STUDIO_LIVE_WEBHOOK_SECRET || '')
    || !/^we_[A-Za-z0-9]+$/.test(env.STUDIO_LIVE_WEBHOOK_ID || '')
    || !/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY || '')
    || env.STUDIO_EMAIL_SENDER_APPROVED !== 'true'
    || env.STUDIO_EMAIL_FROM !== 'santa@santaradio.co.uk'
    || (env.CRON_SECRET || '').length < 32
    || env.STUDIO_EMAIL_RETRY_APPROVED !== 'true')) throw new Error('STUDIO_LIVE_DELIVERY_CONFIGURATION_REQUIRED');
  return {
    origin: LIVE_STUDIO_ORIGIN, productId: LIVE_STUDIO_PRODUCT, priceId: LIVE_STUDIO_PRICE,
    accountId: LIVE_STUDIO_ACCOUNT, offer: LIVE_STUDIO_OFFER, secret: env.STUDIO_RETURN_SECRET,
    webhookId: env.STUDIO_LIVE_WEBHOOK_ID, webhookSecret: env.STUDIO_LIVE_WEBHOOK_SECRET,
    emailFrom: env.STUDIO_EMAIL_FROM, emailKey: env.RESEND_API_KEY, cronSecret: env.CRON_SECRET,
  };
}

export function sameLiveOrigin(req, config) {
  return req.headers.host === new URL(config.origin).host
    && req.headers.origin === config.origin && req.headers['sec-fetch-site'] !== 'cross-site';
}

export function liveHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}
