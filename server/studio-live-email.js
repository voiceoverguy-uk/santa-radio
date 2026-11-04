import { randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { databasePool } from './name-request-store.js';
import { liveStudioConfig, liveHeaders, sameLiveOrigin } from './studio-live-config.js';
import { liveStripeClient } from './studio-live-stripe.js';
import { consumeLiveAttempt, digest, emailDigest, returnToken, queueReturnEmail, transaction } from './studio-live-store.js';
import { cookieOptions, LIVE_ACCESS_COOKIE, tokenPattern } from './studio-live-access.js';

export async function sendStudioReturnEmail({ config, email, token, key, fetcher = fetch }) {
  // Fragment tokens never reach CDN/server access logs or Referer headers.
  const link = `${config.origin}/santa-message-workshop#studio-return=${token}`;
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${config.emailKey}`, 'Content-Type': 'application/json',
      'User-Agent': 'SantaRadioStudio', 'Idempotency-Key': key },
    // Deliberately text-only: Resend's click rewriting applies to HTML, and
    // open tracking requires an HTML pixel. Do not add html/templates here
    // without revisiting tracking/privacy and the secure-link delivery checks.
    body: JSON.stringify({
      from: `Santa Radio <${config.emailFrom}>`, to: [email], subject: 'Your private Santa Radio Studio access',
      text: `Thank you for your Santa Radio Studio purchase. Your £6.50 purchase includes two successful message creations, each with personalised gifts for one child.\n\nOpen your private Studio:\n${link}\n\nThis link can be used once within 24 hours. Its expiry does not expire your purchase. If needed, request a fresh link on the Studio page using your purchase email. Returning preserves your remaining creation allowance; it does not reset it or recover recordings.\n\nKeep this link private. You do not need an account or voucher code.\n\nDownload your MP3, certificate, letter and Santa picture before leaving Studio. Recordings are temporary and are not saved for return visits.`,
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
    const { rows: [row] } = await client.query(`SELECT e.*,p.email_sha256 FROM public.santa_studio_live_email e
      JOIN public.santa_studio_live_purchases p USING(checkout_session_id)
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
        await client.query(`UPDATE public.santa_studio_live_email SET nonce=$2,token_sha256=$3,
          token_expires_at=clock_timestamp()+interval '24 hours' WHERE id=$1`,
        [row.id, nonce, digest(returnToken(nonce, config))]);
      }
      const token = returnToken(nonce, config);
      await send({ config, email, token, key: `studio-return:${row.id}:${nonce}` });
      await client.query(`UPDATE public.santa_studio_live_email SET sent_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1`, [row.id]);
      await client.query(`INSERT INTO public.santa_studio_live_email_health(sender) VALUES($1)
        ON CONFLICT(sender) DO UPDATE SET verified_at=clock_timestamp()`, [config.emailFrom]);
      return { sent: true };
    } catch {
      // A send accepted before a lost DB commit is safely retried with the same
      // provider key. Backoff is durable; keep the queue retryable indefinitely.
      await client.query(`UPDATE public.santa_studio_live_email SET attempts=attempts+1,
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
    catch { return res.status(503).json({ error: 'Return access is temporarily unavailable. Voucher access is unchanged.' }); }
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
          const { rows: [row] } = await client.query(`UPDATE public.santa_studio_live_email
            SET consumed_at=clock_timestamp() WHERE token_sha256=$1 AND consumed_at IS NULL
            AND sent_at IS NOT NULL AND token_expires_at>clock_timestamp() RETURNING checkout_session_id`, [digest(body.token)]);
          if (!row) return false;
          await client.query(`INSERT INTO public.santa_studio_live_sessions(token_sha256,checkout_session_id) VALUES($1,$2)`,
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
          (SELECT e.id FROM public.santa_studio_live_email e WHERE e.checkout_session_id=p.checkout_session_id
            AND e.consumed_at IS NOT NULL ORDER BY e.consumed_at DESC LIMIT 1) AS last_consumed
          FROM public.santa_studio_live_purchases p WHERE p.email_sha256=$1
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

const constantEqual = (a, b) => typeof a === 'string' && a.length === b.length
  && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createStudioEmailRetryHandler({
  getConfig = () => liveStudioConfig(process.env, { email: true }), getPool = databasePool,
  deliver = deliverStudioReturn, fetcher = fetch,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(async (req, res) => {
    liveHeaders(res);
    if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).end();
    try {
      const config = getConfig();
      if (!constantEqual(req.headers.authorization, `Bearer ${config.cronSecret}`)) return res.status(403).end();
      const pool = getPool();
      const result = await deliver({ config, pool });
      // A scheduled, simulated-delivery probe establishes/refreshes sender health
      // without contacting customers. At most once a day across all instances.
      if (!result.sent) await transaction(pool, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('studio-live-email-health'))");
        const recent = await client.query(`SELECT 1 FROM public.santa_studio_live_email_health
          WHERE sender=$1 AND verified_at>clock_timestamp()-interval '24 hours'`, [config.emailFrom]);
        if (recent.rowCount) return;
        const response = await fetcher('https://api.resend.com/emails', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${config.emailKey}`, 'Content-Type': 'application/json',
            'User-Agent': 'SantaRadioStudio', 'Idempotency-Key': `studio-sender-health:${Math.floor(Date.now() / 86400000)}` },
          body: JSON.stringify({ from: `Santa Radio <${config.emailFrom}>`, to: ['delivered+studio-health@resend.dev'],
            subject: 'Studio sender readiness check', text: 'Simulated-delivery readiness check. No customer data or access link.' }),
        });
        if (!response.ok || typeof (await response.json()).id !== 'string') throw new Error('STUDIO_SENDER_CHECK_FAILED');
        await client.query(`INSERT INTO public.santa_studio_live_email_health(sender) VALUES($1)
          ON CONFLICT(sender) DO UPDATE SET verified_at=clock_timestamp()`, [config.emailFrom]);
      });
      if (!result.retry) await pool.query(`INSERT INTO public.santa_studio_live_worker_health(worker) VALUES('email-retry')
        ON CONFLICT(worker) DO UPDATE SET verified_at=clock_timestamp()`);
      return res.status(result.retry ? 503 : 200).json({ processed: true, retry: !!result.retry });
    } catch { return res.status(503).json({ error: 'Email delivery needs attention. Queued messages remain retryable.' }); }
  });
  return app;
}
