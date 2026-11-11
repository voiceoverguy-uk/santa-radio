import { databasePool } from './name-request-store.js';
import { liveStripeClient } from './studio-live-stripe.js';

// Completed Checkout totals are immutable. Cache only amounts, never customer data.
const amounts = new Map();
export async function paidStatistics({pool=databasePool(), stripeClient=liveStripeClient, cache=amounts}={}) {
  const {rows}=await pool.query(`SELECT p.checkout_session_id,
    COALESCE(cardinality(a.operations),0)::integer AS creations
    FROM public.santa_studio_live_purchases p
    LEFT JOIN public.santa_studio_creation_allowances a
      ON a.access_key=encode(sha256(convert_to('studio-purchase:' || p.checkout_session_id,'UTF8')),'hex')`);
  const result={purchases:rows.length,creations:rows.reduce((n,r)=>n+r.creations,0),grossPence:null};
  try {
    const missing=rows.filter(r=>!cache.has(r.checkout_session_id));
    if(missing.length) {
      const stripe=await stripeClient();
      // Bound parallel requests; stop rather than show a partial revenue total.
      const deadline=Date.now()+20000;
      for(let i=0;i<missing.length;i+=4) {
        if(Date.now()>deadline)throw new Error('STRIPE_REPORT_TIMEOUT');
        await Promise.all(missing.slice(i,i+4).map(async row=>{
          const s=await stripe.checkout.sessions.retrieve(row.checkout_session_id,{}, {timeout:8000,maxNetworkRetries:0});
          if(!s.livemode||s.payment_status!=='paid'||s.currency!=='gbp'||!Number.isSafeInteger(s.amount_total)||s.amount_total<0)throw new Error('INVALID_PAID_TOTAL');
          cache.set(row.checkout_session_id,s.amount_total);
        }));
      }
    }
    result.grossPence=rows.reduce((n,r)=>n+cache.get(r.checkout_session_id),0);
  } catch { /* Counts remain available if Stripe is temporarily unavailable. */ }
  if(cache.size>10000)cache.clear();
  return result;
}
