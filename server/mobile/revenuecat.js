import { ReplitConnectors } from '@replit/connectors-sdk';
import { createHash } from 'node:crypto';

export const productIdentifiers = {
  permanent: 'uk.co.santaradio.studio.permanent',
  single: 'uk.co.santaradio.studio.single',
};
export const purchaseKey = purchase => createHash('sha256')
  .update(`apple:${purchase.store_purchase_identifier}`).digest('hex');

// This project ships sandbox verification only. Promotional/Test Store grants,
// a claimed transaction id, client CustomerInfo, and production charges cannot
// open Studio. Enabling live commerce requires a separate authorised change.
export function verifiedPurchases(items, products, customerId, now = Date.now()) {
  const accepted = items.filter(p => p.object === 'purchase' && p.status === 'owned'
    && p.store === 'app_store' && p.environment === 'sandbox'
    && p.customer_id === customerId && p.quantity === 1
    && Number.isFinite(p.purchased_at) && p.purchased_at <= now
    && typeof p.store_purchase_identifier === 'string' && p.store_purchase_identifier.length > 0);
  const permanent = accepted.some(p => p.product_id === products.permanent);
  const single = [...new Map(accepted.filter(p => p.product_id === products.single)
    .map(p => [purchaseKey(p), purchaseKey(p)])).values()];
  return { permanent, single };
}

export function createPurchaseVerifier({
  project = process.env.REVENUECAT_PROJECT_ID,
  app = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID,
  request = async path => {
    // Construct per operation: the connector owns credential refresh.
    const response = await new ReplitConnectors().proxy('revenuecat', path, { method: 'GET', signal: AbortSignal.timeout(12000) });
    if (response.status === 404) return { missing: true };
    if (!response.ok) throw new Error('Purchase verification unavailable');
    return response.json();
  },
} = {}) {
  const list = async path => {
    const items = [];
    let next = path;
    const seen = new Set();
    for (let page = 0; next && page < 50; page++) {
      if (!next.startsWith(`/v2/projects/${encodeURIComponent(project)}/`) || seen.has(next)) throw new Error('Invalid purchase page');
      seen.add(next);
      const data = await request(next);
      if (data.missing) return [];
      if (data.object !== 'list' || !Array.isArray(data.items)) throw new Error('Invalid purchase response');
      items.push(...data.items);
      next = data.next_page;
      if (next && page === 49) throw new Error('Purchase history too large');
    }
    return items;
  };
  return async customerId => {
    if (!project || !app || !/^sr_[a-f0-9]{48}$/.test(customerId)) throw new Error('Purchase service is not configured');
    const base = `/v2/projects/${encodeURIComponent(project)}`;
    // Products are always resolved from RevenueCat, never a local product table.
    const products = await list(`${base}/products?limit=100`);
    const ids = Object.fromEntries(Object.entries(productIdentifiers).map(([kind, identifier]) => {
      const product = products.find(p => p.app_id === app && p.store_identifier === identifier
        && p.type === (kind === 'permanent' ? 'non_consumable' : 'consumable'));
      if (!product) throw new Error('Store products are not configured');
      return [kind, product.id];
    }));
    const purchases = await list(`${base}/customers/${encodeURIComponent(customerId)}/purchases?environment=sandbox&limit=100`);
    return verifiedPurchases(purchases, ids, customerId);
  };
}
