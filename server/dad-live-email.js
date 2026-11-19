
import { sendNameNotifications } from './name-request-email.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { STUDIO_PATH } from '../src/lib/dadRoute.js';
import { databasePool } from './name-request-store.js';
import { liveStudioConfig, liveHeaders, sameLiveOrigin } from './dad-live-config.js';
import { liveStripeClient } from './dad-live-stripe.js';
import { consumeLiveAttempt, digest, emailDigest, returnToken, queueReturnEmail, transaction } from './dad-live-store.js';
import { cookieOptions, LIVE_ACCESS_COOKIE, tokenPattern } from './dad-live-access.js';


export async function sendStudioReturnEmail({ config, email, token, key, fetcher = fetch }) {
  // Fragment tokens never reach CDN/server access logs or Referer headers.
  const link = `${config.origin}${STUDIO_PATH}#studio-return=${token}`;
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${config.emailKey}`, 'Content-Type': 'application/json',
      'User-Agent': 'SantaRadioStudio', 'Idempotency-Key': key },
    // Resend domain click/open tracking is disabled: preserve direct private links.
    // Keep a plain-text alternative for clients that do not display HTML.
    body: JSON.stringify({
      from: `Santa Radio <${config.emailFrom}>`, to: [email], subject: 'Your private Santa Radio Studio access',
      
      text: `Thank you for your Santa Radio Dad Studio purchase. Your purchase includes one personalised Dad message creation as an MP4.\n\nOpen your private Dad Studio:\n${link}\n\nThis private link works once within 24 hours. Request a fresh link on the Dad Studio page using your purchase email if needed. Returning preserves your unused creation; it does not reset it. Download your MP4 before leaving the page. Recordings are not saved.`,
    }),
  });
  if (!response.ok || typeof (await response.json()).id !== 'string') throw new Error('STUDIO_RETURN_EMAIL_NOT_ACCEPTED');
}

// One row per invocation bounds serverless execution. SKIP LOCKED and a stable
// Resend idempotency key protect concurrent webhook/cron delivery and retries.
export async function deliverStudioReturn({
  config = liveStudioConfig(process.env, { email: true }), stripe, pool = databasePool(), send = sendStudioReturnEmail,
  sessionId = null,
} = {}) {
  stripe ||= await liveStripeClient(config);
  return transaction(pool, async client => {
    const { rows: [row] } = await client.query(`SELECT e.*,p.email_sha256 FROM public.santa_dad_live_email e
      JOIN public.santa_dad_live_purchases p USING(checkout_session_id)
      WHERE e.sent_at IS NULL AND e.next_attempt_at<=clock_timestamp()
      AND ($1::text IS NULL OR e.checkout_session_id=$1)
      ORDER BY e.next_attempt_at FOR UPDATE OF e SKIP LOCKED LIMIT 1`, [sessionId]);
    if (!row) return { sent: false };
    try {
      const session = await stripe.checkout.sessions.retrieve(row.checkout_session_id);
      const email = session.customer_details?.email;
      if (session.id !== row.checkout_session_id || session.livemode !== true
        || typeof email !== 'string' || emailDigest(email, config) !== row.email_sha256) throw new Error('STUDIO_RETURN_RECIPIENT_INVALID');
      // Link life starts when delivery is attempted, not when a long outage
      // originally queued it. Never persist the raw bearer token or email.
      let nonce = row.nonce;
      if (new Date(row.token_expires_at).getTime() <= Date.now()) {
        nonce = randomBytes(32).toString('base64url');
        await client.query(`UPDATE public.santa_dad_live_email SET nonce=$2,token_sha256=$3,
          token_expires_at=clock_timestamp()+interval '24 hours' WHERE id=$1`,
        [row.id, nonce, digest(returnToken(nonce, config))]);
      }
      const token = returnToken(nonce, config);
      await send({ config, email, token, key: `studio-return:${row.id}:${nonce}` });
      await client.query(`UPDATE public.santa_dad_live_email SET sent_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1`, [row.id]);
      await client.query(`INSERT INTO public.santa_dad_live_email_health(sender) VALUES($1)
        ON CONFLICT(sender) DO UPDATE SET verified_at=clock_timestamp()`, [config.emailFrom]);
      return { sent: true };
    } catch {
      // A send accepted before a lost DB commit is safely retried with the same
      // provider key. Backoff is durable; keep the queue retryable indefinitely.
      await client.query(`UPDATE public.santa_dad_live_email SET attempts=attempts+1,
        next_attempt_at=clock_timestamp()+make_interval(secs => LEAST(3600,60*power(2,LEAST(attempts,6)))::int)
        WHERE id=$1`, [row.id]);
      return { sent: false, retry: true };
    }
  });
}

export function createStudioReturnHandler({
  getConfig = liveStudioConfig, getPool = databasePool, consume = consumeLiveAttempt,
  getEmailConfig = () => liveStudioConfig(process.env, { email: true }),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    liveHeaders(res);
    if (req.method !== 'POST') return res.set('Allow', 'POST').status(405).end();
    try { req.studioConfig = getConfig(); }
    catch { return res.status(503).json({ error: 'Return access is temporarily unavailable. ' }); }
    if (!sameLiveOrigin(req, req.studioConfig)) return res.status(403).json({ error: 'Open Studio on Santa Radio to continue.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Expected JSON.' });
    next();
  });
  app.use(express.json({ strict: true, limit: '1kb', inflate: false }));
  app.use(async (req, res) => {
    try {
      const config = req.studioConfig, pool = getPool();
      const body = req.body;
      if (!body || Object.keys(body).length !== 1) return res.status(400).json({ error: 'Enter your purchase email or use your private email link.' });
      if (!await consume(req, config, 'return', pool)) return res.set('Retry-After', '900').status(429).json({ error: 'Please wait 15 minutes before trying again.' });
      if (typeof body.token === 'string' && tokenPattern.test(body.token)) {
        const accessToken = randomBytes(32).toString('base64url');
        const granted = await transaction(pool, async client => {
          const { rows: [row] } = await client.query(`UPDATE public.santa_dad_live_email
            SET consumed_at=clock_timestamp() WHERE token_sha256=$1 AND consumed_at IS NULL
            AND sent_at IS NOT NULL AND token_expires_at>clock_timestamp() RETURNING checkout_session_id`, [digest(body.token)]);
          if (!row) return false;
          await client.query(`INSERT INTO public.santa_dad_live_sessions(token_sha256,checkout_session_id) VALUES($1,$2)`,
            [digest(accessToken), row.checkout_session_id]);
          return true;
        });
        if (!granted) return res.status(410).json({ error: 'This link has expired or was already used. Request a fresh link using your purchase email.' });
        res.cookie(LIVE_ACCESS_COOKIE, accessToken, cookieOptions);
        return res.json({ authorized: true });
      }
      if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return res.status(400).json({ error: 'Enter the email address used for your purchase.' });
      }
      // Email delivery may be down, but redemption of a previously sent link
      // and existing paid sessions must not depend on sender availability.
      getEmailConfig();
      const emailKey = emailDigest(body.email, config);
      await transaction(pool, async client => {
        const { rows } = await client.query(`SELECT p.checkout_session_id,
          (SELECT e.id FROM public.santa_dad_live_email e WHERE e.checkout_session_id=p.checkout_session_id
            AND e.consumed_at IS NOT NULL ORDER BY e.consumed_at DESC LIMIT 1) AS last_consumed
          FROM public.santa_dad_live_purchases p WHERE p.email_sha256=$1
          ORDER BY p.granted_at DESC LIMIT 1 FOR UPDATE OF p`, [emailKey]);
        if (rows[0]) await queueReturnEmail(client, rows[0].checkout_session_id,
          `return:${emailKey}:${Math.floor(Date.now() / 900000)}:${rows[0].last_consumed || 'first'}`, config);
      });
      // No account/purchase enumeration; sending happens through the durable worker.
      return res.json({ requested: true, message: 'If this email has a confirmed purchase, a private return link will be sent. Please check your inbox and spam folder.' });
    } catch {
      return res.status(503).json({ error: 'Return access is temporarily unavailable. Please try again. Your purchase has not expired.' });
    }
  });
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid return request.' }));
  return app;
}

