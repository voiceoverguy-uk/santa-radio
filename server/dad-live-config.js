import { liveStudioConfig as baseConfig, liveProduction, liveHeaders, sameLiveOrigin } from './studio-live-config.js';
export { liveProduction, liveHeaders, sameLiveOrigin };
export const DAD_OFFER = 'santa-dad-one-message-v1';
export function liveStudioConfig(env = process.env, options = {}) {
 const base = baseConfig(env, options);
 if (!/^prod_[A-Za-z0-9]+$/.test(env.DAD_STUDIO_PRODUCT_ID || '') || !/^price_[A-Za-z0-9]+$/.test(env.DAD_STUDIO_PRICE_ID || '')) throw Error('DAD_PAYMENT_NOT_CONFIGURED');
 if (options.sales && env.DAD_STUDIO_SALES_ENABLED !== 'true') throw Error('DAD_SALES_DISABLED');
 return {...base, offer:DAD_OFFER, productId:env.DAD_STUDIO_PRODUCT_ID, priceId:env.DAD_STUDIO_PRICE_ID, publishableKey:null};
}
