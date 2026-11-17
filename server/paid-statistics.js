import { databasePool } from './name-request-store.js';
import { liveStripeClient } from './studio-live-stripe.js';

// Completed Checkout totals are immutable. Cache only amounts, never customer data.
const amounts = new Map();
export async function paidStatistics({pool=databasePool(), stripeClient=liveStripeClient, cache=amounts, now=new Date()}={}) {
  const {rows}=await pool.query(`SELECT p.checkout_session_id, to_char(p.granted_at AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS day,
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
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const firstDay=rows.map(row=>row.day).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day || '')).sort()[0];
  const dayCount=firstDay ? Math.max(30,Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(firstDay+'T12:00:00Z'))/86400000)+1) : 30;
  result.daily=result.grossPence===null || rows.some(row=>!/^\d{4}-\d{2}-\d{2}$/.test(row.day || '')) ? null : Array.from({length:dayCount},(_,i)=>{
    const day=new Date(Date.parse(today+'T12:00:00Z')-(dayCount-1-i)*86400000).toISOString().slice(0,10);
    const matching=rows.filter(row=>row.day===day);
    return {day,payments:matching.length,grossPence:matching.reduce((total,row)=>total+cache.get(row.checkout_session_id),0)};
  });
  if(cache.size>10000)cache.clear();
  return result;
}
