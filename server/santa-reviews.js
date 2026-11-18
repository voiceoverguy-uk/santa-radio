import express from 'express';
import { randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { requestContact, sealContact, openContact } from './name-request-contact.js';
import { sameSiteRequest } from './santa-message-access.js';
import { validOwnerToken } from './studio-owner-handler.js';
import { verifyReceipt } from './message-statistics-store.js';
import { consumeNameAccess } from './santa-name-security.js';
import { validateSantaReview } from '../src/lib/santaReviewValidation.js';

const fields = 'id,display_name AS "displayName",rating,body,consent,reward_email_requested AS "rewardEmail",state,email_state AS "emailState",featured,created_at AS "createdAt"';
export function reviewRewardEmail() {
  const url = 'https://www.santaradio.co.uk/bespoke-personalised-message-from-santa';
  const text = `Thank you for your honest review. We’ve received your review.\n\nYour 20% discount code: REVIEW20\n\nEnter REVIEW20 in the promotion-code box at Stripe Checkout for 20% off the £6.50 bespoke Santa message package (£5.20 after discount). Includes two message creations and personalised digital gifts.\n\n${url}\n\nThis reward is for your feedback, regardless of your star rating. This is the one-off reward email you requested, not a newsletter signup.\nSanta Radio`;
  return { text, html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Santa message discount</title></head><body style="font-family:Arial,sans-serif;background:#f6ecd8;color:#173b2c;padding:24px"><main style="max-width:560px;margin:auto;background:white;padding:28px;border-radius:12px"><h1>Thank you for your review</h1><p>We’ve received your review. Here’s your 20% discount:</p><p style="font-size:30px;font-weight:bold;letter-spacing:2px">REVIEW20</p><p>Enter this code at <strong>Stripe Checkout</strong> for the bespoke Santa message package.</p><p><strong>£5.20 with your discount</strong> (usually £6.50). Two message creations and personalised digital gifts.</p><p><a href="${url}" style="background:#9b111e;color:white;padding:14px 18px;display:inline-block;border-radius:8px">Explore bespoke messages</a></p><p style="font-size:13px">This reward is for honest feedback, regardless of your star rating. You requested this one-off reward email; it does not subscribe you to marketing.</p><p>Santa Radio</p></main></body></html>` };
}
export async function emailReviewReward(id, { pool = databasePool(), fetcher = fetch, apiKey = process.env.BREVO_API_KEY } = {}) {
  const optedOut = await pool.query("UPDATE santa_message_reviews SET contact=NULL WHERE id=$1 AND NOT reward_email_requested RETURNING id", [id]);
  if (optedOut.rowCount) return {ok:true,message:'No discount email requested; no email sent.'};
  if (!apiKey) throw Object.assign(new Error('Reward email is not configured. The review has not been sent.'), { status: 503 });
  // Claim before sending: concurrent approvals and retries cannot send twice.
  const claimed = await pool.query(`UPDATE santa_message_reviews SET email_state='sending'
    WHERE id=$1 AND reward_email_requested AND email_state IN ('not_sent','failed') RETURNING contact`, [id]);
  if (!claimed.rowCount) return { ok: true, message: 'Already processed or awaiting a delivery check. No duplicate email sent.' };
  let state = 'uncertain';
  try {
    const email = openContact(claimed.rows[0].contact)?.email;
    if (!email) { state = 'failed'; throw new Error('Contact unavailable'); }
    const content = reviewRewardEmail();
    const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { name: 'Santa Radio', email: 'santa@santaradio.co.uk' }, to: [{ email }],
        subject: 'Your 20% Santa message discount', textContent: content.text, htmlContent: content.html }),
      signal: AbortSignal.timeout(10000),
    });
    state = response.ok ? 'sent' : response.status >= 400 && response.status < 500 ? 'failed' : 'uncertain';
  } catch { /* Ambiguous delivery must be checked with the provider, never blindly retried. */ }
  await pool.query(`UPDATE santa_message_reviews SET email_state=$2,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,
    contact=CASE WHEN $2='sent' THEN NULL ELSE contact END WHERE id=$1`, [id, state]);
  return { ok: true, message: state === 'sent' ? 'Discount email accepted for delivery.' : state === 'failed' ? 'Email was not accepted. Fix email delivery, then retry.' : 'Delivery is uncertain; check Brevo before taking further action.' };
}

export function createReviewsHandler({ pool = databasePool, contact = requestContact, owner = validOwnerToken,
  receipt = verifyReceipt, limit = consumeNameAccess, send = emailReviewReward } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req,res,next) => { res.set('Cache-Control','private, no-store').set('X-Robots-Tag','noindex, nofollow'); next(); });
  app.use(express.json({ limit: '12kb', inflate: false }));
  app.use(async (req,res) => {
    try {
      if (!['GET','POST','PATCH'].includes(req.method)) return res.status(405).json({ error:'Method not allowed.' });
      if (req.method !== 'GET' && !sameSiteRequest(req)) return res.status(403).json({ error:'Please use the Santa Radio website or dashboard app.' });
      if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({error:'Expected JSON.'});
      const view = req.query?.view;
      if (req.method === 'GET' && view === 'featured') {
        const db = pool();
        const filter = "featured AND consent AND state='approved'";
        const count = Number((await db.query(`SELECT count(*) AS total FROM santa_message_reviews WHERE ${filter}`)).rows[0].total);
        if (!count) return res.json({reviews:[],nextOffset:0});
        const requested = /^\d{1,9}$/.test(String(req.query.offset || '0')) ? Number(req.query.offset || 0) : 0;
        const offset = requested % count;
        const select = `SELECT id,display_name AS "displayName",rating,body FROM santa_message_reviews WHERE ${filter} ORDER BY created_at,id`;
        const rows = (await db.query(`${select} LIMIT 3 OFFSET $1`,[offset])).rows;
        const remaining = Math.min(3,count) - rows.length;
        if (remaining > 0) rows.push(...(await db.query(`${select} LIMIT $1`,[remaining])).rows);
        return res.json({reviews:rows,nextOffset:(offset + rows.length) % count});
      }
      if (view === 'admin' || req.method === 'PATCH') {
        if (!owner(req)) return res.status(401).json({ error:'Owner access required.' });
        if (req.method === 'GET') {
          const offset = /^\d{1,6}$/.test(String(req.query.offset || '0')) ? Number(req.query.offset || 0) : 0;
          const rows = await pool().query(`SELECT ${fields} FROM santa_message_reviews ORDER BY created_at DESC LIMIT 51 OFFSET $1`, [offset]);
          return res.json({ reviews: rows.rows.slice(0,50), more: rows.rows.length > 50 });
        }
        if (req.method !== 'PATCH') return res.status(405).json({error:'Method not allowed.'});
        const { id, action } = req.body || {};
        if (!/^[a-f0-9-]{36}$/.test(id || '')) return res.status(400).json({error:'Choose a review.'});
        if (action === 'retry') return res.json(await send(id,{pool:pool()}));
        let result;
        if (action === 'approve') result = await pool().query("UPDATE santa_message_reviews SET state='approved',reviewed_at=now(),featured=true WHERE id=$1 AND consent AND state IN ('pending','approved')",[id]);
        else if (action === 'reject') result = await pool().query("UPDATE santa_message_reviews SET state='rejected',reviewed_at=now(),featured=false WHERE id=$1 AND state='pending'",[id]);
        else if (action === 'feature') result = await pool().query("UPDATE santa_message_reviews SET featured=true WHERE id=$1 AND state='approved' AND consent",[id]);
        else if (action === 'unfeature') result = await pool().query('UPDATE santa_message_reviews SET featured=false WHERE id=$1',[id]);
        else return res.status(400).json({error:'Unknown action.'});
        return result.rowCount ? res.json({ok:true,message:'Review updated.'}) : res.status(409).json({error:'This review is no longer eligible for that action. Refresh the list.'});
      }
      // The encrypted contact belongs to the existing email-verified free-message session.
      const contactRequest = Object.create(req);
      contactRequest.body = {...req.body, source:'free'};
      const adult = await contact(contactRequest);
      if (!adult) return res.status(401).json({error:'Please verify your adult email through the free message page first.'});
      if (req.method === 'GET') {
        const existing = await pool().query('SELECT state,reward_email_requested FROM santa_message_reviews WHERE recipient_key=$1',[adult.identity]);
        return res.json({eligible:true,submitted:existing.rowCount > 0,rewardEmail:existing.rows[0]?.reward_email_requested === true});
      }
      if (req.method !== 'POST') return res.status(405).end();
      await limit(req,'request');
      const review = validateSantaReview(req.body);
      if (review.error) return res.status(400).json({error:review.error});
      const recording = receipt(req.body.receipt);
      if (!recording) return res.status(400).json({error:'Open the review invitation after downloading your free message. The invitation lasts seven days.'});
      const saved = await pool().query(`INSERT INTO santa_message_reviews(id,recipient_key,contact,receipt_id,display_name,rating,body,consent,reward_email_requested)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(recipient_key) DO NOTHING RETURNING id`,
        [randomUUID(),adult.identity,review.rewardEmail ? sealContact({email:adult.email}) : null,recording,review.displayName,review.rating,review.body,review.consent,review.rewardEmail]);
      let delivery;
      if (saved.rowCount && review.rewardEmail) {
        try { delivery = await send(saved.rows[0].id,{pool:pool()}); }
        catch { delivery = {message:'Your review is saved. Your discount email is awaiting delivery.'}; }
      }
      return res.json({ok:true,duplicate:!saved.rowCount,rewardEmail:review.rewardEmail,message:delivery?.message});
    } catch (error) { return res.status(error.status || 503).json({error:error.status ? error.message : 'Reviews are temporarily unavailable. Please try again.'}); }
  });
  app.use((_err,_req,res,_next) => res.status(400).json({error:'Invalid review request.'}));
  return app;
}
export default createReviewsHandler();
