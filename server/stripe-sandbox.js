import { ReplitConnectors } from '@replit/connectors-sdk';

export const STUDIO_OFFER = 'santa-message-maker-family';

export function assertSandboxObject(value) {
  if (value?.livemode !== false) throw new Error('STRIPE_SANDBOX_REQUIRED');
  return value;
}

export function assertFamilyPrice(price) {
  assertSandboxObject(price);
  if (price.active !== true || price.unit_amount !== 650 || price.currency !== 'gbp'
    || price.type !== 'one_time' || price.recurring) throw new Error('STRIPE_FAMILY_PRICE_INVALID');
  return price;
}

// No raw credentials, browser API or live-mode fallback. Preparation is only
// callable from workspace scripts; this module is not mounted on a public route.
export async function createSandboxApi({ connectors = new ReplitConnectors(), env = process.env } = {}) {
  if (env.REPLIT_DEPLOYMENT === '1' || env.VERCEL === '1' || !env.REPL_IDENTITY) {
    throw new Error('STRIPE_SANDBOX_WORKSPACE_ONLY');
  }
  const request = async (path, { method = 'GET', fields, idempotencyKey } = {}) => {
    if (!path.startsWith('/v1/')) throw new Error('STRIPE_API_PATH_INVALID');
    const response = await connectors.proxy('stripe', path, {
      method,
      ...(fields ? { body: new URLSearchParams(fields).toString() } : {}),
      headers: {
        ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
    });
    if (!response.ok) throw new Error(`STRIPE_SANDBOX_API_HTTP_${response.status}`);
    return response.json();
  };
  assertSandboxObject(await request('/v1/balance'));
  return async (path, options = {}) => {
    // Recheck before every write, in case the attached connection changes.
    if (options.method && options.method !== 'GET') assertSandboxObject(await request('/v1/balance'));
    const result = await request(path, options);
    if (Array.isArray(result.data)) result.data.forEach(assertSandboxObject);
    else assertSandboxObject(result);
    return result;
  };
}

export async function prepareFamilyOffer(api) {
  const query = encodeURIComponent(`active:'true' AND metadata['offer']:'${STUDIO_OFFER}'`);
  const products = await api(`/v1/products/search?query=${query}&limit=100`);
  if (products.has_more || products.data.length > 1) throw new Error('STRIPE_FAMILY_PRODUCT_AMBIGUOUS');
  const product = products.data[0] || await api('/v1/products', {
    method: 'POST',
    idempotencyKey: 'santa-family-sandbox-product-v1',
    fields: {
      name: 'Santa Message Maker',
      description: 'Family bundle for up to three children. Sandbox payment preparation only; Studio outputs are not yet connected.',
      'metadata[offer]': STUDIO_OFFER,
      'metadata[environment]': 'sandbox',
    },
  });
  assertSandboxObject(product);
  const prices = await api(`/v1/prices?product=${encodeURIComponent(product.id)}&active=true&limit=100`);
  if (prices.has_more) throw new Error('STRIPE_FAMILY_PRICES_AMBIGUOUS');
  const matches = prices.data.filter(price => price.unit_amount === 650 && price.currency === 'gbp' && price.type === 'one_time');
  if (matches.length > 1) throw new Error('STRIPE_FAMILY_PRICES_AMBIGUOUS');
  const price = matches[0] || await api('/v1/prices', {
    method: 'POST',
    idempotencyKey: `santa-family-sandbox-price-650-gbp-${product.id}`,
    fields: { product: product.id, unit_amount: '650', currency: 'gbp', 'metadata[offer]': STUDIO_OFFER },
  });
  assertFamilyPrice(price);
  return { productId: product.id, priceId: price.id, amount: price.unit_amount, currency: price.currency, livemode: false };
}
