import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { verifiedLiveSession } from './studio-live-stripe.js';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const emailDigest = (email, config) => createHmac('sha256', config.secret)
  .update(`studio-live-email:${email.trim().toLowerCase()}`).digest('hex');
export const returnToken = (nonce, config) => createHmac('sha256', config.secret)
  .update(`studio-live-return:${nonce}`).digest('base64url');
export const transaction = async (pool, work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
};

// Schema and permissions, not just a successful DB connection. No CREATE/ALTER.
export async function liveStoreReady(pool = databasePool()) {
  const mode = await pool.query('SHOW transaction_read_only');
  if (mode.rows[0]?.transaction_read_only !== 'off') throw new Error('STUDIO_LIVE_STORAGE_READ_ONLY');
  const tables = {
    santa_studio_live_sales_settings: 'key,enabled',
    santa_studio_live_attempts: 'claim_sha256,checkout_session_id,generation',
    santa_studio_live_purchases: 'checkout_session_id,payment_intent_id,claim_sha256,email_sha256,granted_at',
    santa_studio_live_sessions: 'token_sha256,checkout_session_id',
    santa_studio_live_events: 'event_id',
    santa_studio_live_webhook_health: 'endpoint_id,secret_sha256,verified_at',
    santa_studio_live_worker_health: 'worker,verified_at',
    santa_studio_live_email_health: 'sender,verified_at',
    santa_studio_live_email: 'id,request_key,checkout_session_id,nonce,token_sha256,token_expires_at,consumed_at,sent_at,attempts,next_attempt_at',
    santa_studio_live_limits: 'bucket_key,attempts,expires_at',
  };
  for (const [table, columns] of Object.entries(tables)) {
    await pool.query(`SELECT ${columns} FROM public.${table} LIMIT 0`);
    const { rows } = await pool.query(`SELECT
      has_table_privilege(current_user,$1,'SELECT') AND has_table_privilege(current_user,$1,'INSERT')
      AND has_table_privilege(current_user,$1,'UPDATE') AND has_table_privilege(current_user,$1,'DELETE') AS allowed`, [`public.${table}`]);
    if (rows[0]?.allowed !== true) throw new Error('STUDIO_LIVE_STORAGE_PERMISSIONS_REQUIRED');
  }
  const constraints = await pool.query(`SELECT r.relname AS table_name,c.contype AS kind,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(num,ord)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ref.relname AS referenced FROM pg_constraint c
    JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    LEFT JOIN pg_class ref ON ref.oid=c.confrelid LEFT JOIN pg_index i ON i.indexrelid=c.conindid
    WHERE n.nspname='public' AND r.relname=ANY($1::text[]) AND c.convalidated
    AND (c.contype='f' OR i.indisvalid)`, [Object.keys(tables)]);
  const required = {
    sales_settings: [['p', 'key']],
    attempts: [['p', 'claim_sha256'], ['u', 'checkout_session_id']],
    purchases: [['p', 'checkout_session_id'], ['u', 'payment_intent_id']],
    sessions: [['p', 'token_sha256'], ['f', 'checkout_session_id', 'santa_studio_live_purchases']],
    events: [['p', 'event_id']], webhook_health: [['p', 'endpoint_id']], email_health: [['p', 'sender']],
    worker_health: [['p', 'worker']], limits: [['p', 'bucket_key']],
    email: [['p', 'id'], ['u', 'request_key'], ['u', 'token_sha256'], ['f', 'checkout_session_id', 'santa_studio_live_purchases']],
  };
  for (const [suffix, needed] of Object.entries(required)) for (const [kind, column, referenced] of needed) {
    if (!constraints.rows.some(row => row.table_name === `santa_studio_live_${suffix}` && row.kind === kind
      && row.columns.length === 1 && row.columns[0] === column && (!referenced || row.referenced === referenced))) {
      throw new Error('STUDIO_LIVE_STORAGE_CONSTRAINTS_REQUIRED');
    }
  }
}

export async function queueReturnEmail(client, sessionId, requestKey, config) {
  const nonce = randomBytes(32).toString('base64url');
  await client.query(`INSERT INTO public.santa_studio_live_email
    (id,request_key,checkout_session_id,nonce,token_sha256,token_expires_at)
    VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '24 hours')
    ON CONFLICT(request_key) DO NOTHING`,
  [randomUUID(), requestKey, sessionId, nonce, digest(returnToken(nonce, config))]);
}

// Called only with a fresh server-retrieved, expanded Stripe session.
// Lock the attempt so returns and duplicate/concurrent webhooks reconcile once.
export async function reconcileLivePurchase(client, session, config) {
  if (!verifiedLiveSession(session, config)) return false;
  const email = session.customer_details?.email;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('STUDIO_PURCHASE_EMAIL_REQUIRED');
  }
  const claim = session.metadata.access_claim_sha256;
  const { rows: [attempt] } = await client.query(`SELECT checkout_session_id FROM public.santa_studio_live_attempts
    WHERE claim_sha256=$1 FOR UPDATE`, [claim]);
  if (attempt?.checkout_session_id !== session.id) return false;
  await client.query(`INSERT INTO public.santa_studio_live_purchases
    (checkout_session_id,payment_intent_id,claim_sha256,email_sha256) VALUES($1,$2,$3,$4)
    ON CONFLICT DO NOTHING`, [session.id, session.payment_intent.id, claim, emailDigest(email, config)]);
  const { rowCount } = await client.query(`SELECT 1 FROM public.santa_studio_live_purchases
    WHERE checkout_session_id=$1 AND payment_intent_id=$2 AND claim_sha256=$3 AND email_sha256=$4`,
  [session.id, session.payment_intent.id, claim, emailDigest(email, config)]);
  if (!rowCount) return false;
  await queueReturnEmail(client, session.id, `initial:${session.id}`, config);
  return true;
}

export async function consumeLiveAttempt(req, config, purpose, pool = databasePool()) {
  const window = Math.floor(Date.now() / 900000);
  // Only Vercel's overwritten address header on the required production host.
  const address = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const addressHash = createHmac('sha256', config.secret).update(String(address)).digest('hex');
  return transaction(pool, async client => {
    await client.query('DELETE FROM public.santa_studio_live_limits WHERE expires_at<=clock_timestamp()');
    const limits = purpose === 'readiness' ? [2400, 120] : purpose === 'confirm' ? [1200, 60] : [120, 15];
    for (const [identity, max] of [['global', limits[0]], [addressHash, limits[1]]]) {
      const result = await client.query(`INSERT INTO public.santa_studio_live_limits(bucket_key,expires_at)
        VALUES($1,$2) ON CONFLICT(bucket_key) DO UPDATE SET attempts=santa_studio_live_limits.attempts+1
        WHERE santa_studio_live_limits.attempts<$3 RETURNING attempts`,
      [`${purpose}:${window}:${identity}`, new Date((window + 1) * 900000), max]);
      if (!result.rowCount) return false;
    }
    return true;
  });
}
