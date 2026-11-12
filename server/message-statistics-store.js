import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { databasePool } from './contenders-database.js';
const WEEK = 7 * 86400000;
const signature = (body, secret) => createHmac('sha256', secret).update(`message-statistics:${body}`).digest('hex');
export function receiptToken(id, now = Date.now(), secret = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new Error('Statistics signing unavailable');
  const body = `${id}.${now + WEEK}`;
  return `${body}.${signature(body, secret)}`;
}
export function verifyReceipt(token, now = Date.now(), secret = process.env.SESSION_SECRET) {
  if (!secret || typeof token !== 'string' || token.length > 200) return null;
  const [id, expires, sig] = token.split('.');
  if (!/^[a-f0-9-]{36}$/.test(id || '') || !/^\d{13}$/.test(expires || '') || !/^[a-f0-9]{64}$/.test(sig || '')
    || Number(expires) <= now || Number(expires) > now + WEEK) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(signature(`${id}.${expires}`, secret))) ? id : null;
}
export async function recordCreation(name, pool = databasePool(), now = new Date()) {
  const id = randomUUID();
  const token = receiptToken(id, now.getTime());
  // One atomic statement: counters and the receipt either both persist or neither does.
  await pool.query(`WITH receipt AS (
    INSERT INTO santa_message_receipts(id,name,created_at) VALUES($1,$2,$3) RETURNING name,created_at
  ) INSERT INTO santa_message_daily(day,name,creations)
    SELECT (created_at AT TIME ZONE 'Europe/London')::date,name,1 FROM receipt
    ON CONFLICT(day,name) DO UPDATE SET creations=santa_message_daily.creations+1`, [id,name,now]);
  return token;
}
export function recordDownload(id, pool = databasePool(), now = new Date()) {
  return recordEngagement(id, 'download', pool, now);
}
export async function recordEngagement(id, action, pool = databasePool(), now = new Date()) {
  const columns = { download: ['downloaded_at', 'download_clicks'], listen: ['listened_at', 'listens'], share: ['shared_at', 'shares'] }[action];
  if (!columns) throw new Error('Invalid engagement action');
  const [timestamp, counter] = columns;
  // Count the first download click per recording. Replays/retries do not inflate totals.
  const result = await pool.query(`WITH clicked AS (
    UPDATE santa_message_receipts SET ${timestamp}=$2 WHERE id=$1 AND ${timestamp} IS NULL
      AND created_at > $2::timestamptz-interval '7 days' RETURNING name
  ) INSERT INTO santa_message_daily(day,name,${counter})
    SELECT ($2::timestamptz AT TIME ZONE 'Europe/London')::date,name,1 FROM clicked
    ON CONFLICT(day,name) DO UPDATE SET ${counter}=santa_message_daily.${counter}+1 RETURNING name`, [id,now]);
  return result.rowCount > 0;
}
export async function statisticsReport(pool = databasePool()) {
  // Short-lived random receipts are solely for deduplication; retain only aggregates long term.
  await pool.query("DELETE FROM santa_message_receipts WHERE created_at < now()-interval '7 days'");
  const [daily,names,votes,since] = await Promise.all([
    pool.query(`SELECT days.day::date::text AS day, COALESCE(sum(s.creations),0)::integer AS creations, COALESCE(sum(s.download_clicks),0)::integer AS downloads, COALESCE(sum(s.listens),0)::integer AS listens, COALESCE(sum(s.shares),0)::integer AS shares
      FROM generate_series((now() AT TIME ZONE 'Europe/London')::date-29,(now() AT TIME ZONE 'Europe/London')::date,interval '1 day') AS days(day)
      LEFT JOIN santa_message_daily s ON s.day=days.day::date GROUP BY days.day ORDER BY days.day DESC`),
    pool.query(`SELECT name,sum(creations)::integer AS creations,sum(download_clicks)::integer AS downloads,sum(listens)::integer AS listens,sum(shares)::integer AS shares
      FROM santa_message_daily WHERE day >= (now() AT TIME ZONE 'Europe/London')::date-29
      GROUP BY name ORDER BY creations DESC,name LIMIT 30`),
    pool.query(`SELECT e.artist,e.title,count(b.id)::integer AS votes FROM christmas_contenders_entries e
      LEFT JOIN christmas_contenders_ballots b ON b.competition=e.competition AND b.entry_id=e.id AND b.mode=e.mode AND b.state='confirmed'
      WHERE e.mode='live' AND e.approved GROUP BY e.competition,e.id,e.artist,e.title ORDER BY votes DESC,e.artist`),
    pool.query('SELECT min(day)::text AS since FROM santa_message_daily'),
  ]);
  return {daily:daily.rows,names:names.rows,votes:votes.rows,since:since.rows[0].since,updatedAt:new Date().toISOString()};
}
export async function safeRecordCreation(name) {
  // Return the receipt whenever the insert succeeds. Racing a short timer could
  // count a creation but discard its receipt while Neon was waking up.
  try { return await recordCreation(name); }
  catch { console.warn('[message-statistics] recording unavailable'); return ''; }
}

