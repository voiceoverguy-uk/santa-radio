import pg from 'pg';
import { trackIdentity } from '../src/lib/radio-track-identity.js';
let pool;
export function historyPool() {
  // Deliberately no DATABASE_URL fallback: production storage must be chosen.
  if (!process.env.RADIO_HISTORY_DATABASE_URL) throw new Error('Radio history database is not configured');
  return pool ||= new pg.Pool({ connectionString: process.env.RADIO_HISTORY_DATABASE_URL, max: 3,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000 });
}
export const COVERAGE_GAP_MS = 90000;
export function observationDecision(previous, track, now, gapMs = COVERAGE_GAP_MS) {
  const identity = trackIdentity(track);
  const continuous = Boolean(previous.observed_at) && +now > +new Date(previous.observed_at) &&
    +now - +new Date(previous.observed_at) <= gapMs;
  return { identity, continuous, count: continuous && Boolean(identity) && identity !== previous.identity };
}
export async function collectOnce({ pool: db = historyPool(), read, cadenceMs = 15000 }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Lock BEFORE fetching; overlapping workers cannot commit older snapshots
    // after newer ones. No queue of blocked workers or duplicate reads.
    const lock = await client.query('SELECT pg_try_advisory_xact_lock(20261021, 202) AS acquired');
    if (!lock.rows[0].acquired) { await client.query('ROLLBACK'); return { skipped: true }; }
    const result = await client.query('SELECT * FROM radio_history_checkpoint WHERE id=1 FOR UPDATE');
    const previous = result.rows[0];
    if (!previous) throw new Error('Radio history schema is not prepared');
    const { rows: [{ now }] } = await client.query('SELECT clock_timestamp() AS now');
    if (previous.attempted_at && +now - +previous.attempted_at < cadenceMs) {
      await client.query('ROLLBACK'); return { skipped: true };
    }
    let track;
    try { track = await read(); }
    catch {
      await client.query('UPDATE radio_history_checkpoint SET attempted_at=$1,last_error=true WHERE id=1', [now]);
      await client.query('COMMIT');
      return { failed: true };
    }
    const { rows: [{ observed }] } = await client.query('SELECT clock_timestamp() AS observed');
    const decision = observationDecision(previous, track, observed);
    if (decision.count) await client.query(
      'INSERT INTO radio_history_plays(observed_at,identity,artist,title) VALUES($1,$2,$3,$4)',
      [observed, decision.identity, track.artist.trim().replace(/\s+/g, ' '), track.title.trim().replace(/\s+/g, ' ')]);
    if (decision.continuous) await client.query(
      'INSERT INTO radio_history_coverage(started_at,ended_at) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [previous.observed_at, observed]);
    await client.query(`UPDATE radio_history_checkpoint SET attempted_at=$1,observed_at=$1,
      identity=$2,first_observed_at=COALESCE(first_observed_at,$1),last_error=false WHERE id=1`,
    [observed, decision.identity]);
    await client.query('COMMIT');
    return { counted: decision.count, baseline: !decision.continuous };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function readChart(window, db = historyPool(), now = new Date()) {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: [checkpoint] } = await client.query('SELECT * FROM radio_history_checkpoint WHERE id=1');
    const { rows: songs } = await client.query(`SELECT
      (array_agg(artist ORDER BY observed_at,id))[1] AS artist,
      (array_agg(title ORDER BY observed_at,id))[1] AS title, count(*)::integer AS count
      FROM radio_history_plays WHERE observed_at >= $1 AND observed_at < $2
      GROUP BY identity ORDER BY count(*) DESC, identity COLLATE "C" ASC LIMIT 10`, [window.start, window.end]);
    const { rows: [coverage] } = await client.query(`SELECT COALESCE(sum(
      EXTRACT(EPOCH FROM (LEAST(ended_at,$2::timestamptz)-GREATEST(started_at,$1::timestamptz)))),0)::float8 AS seconds
      FROM radio_history_coverage WHERE ended_at > $1 AND started_at < $2`, [window.start, window.end]);
    await client.query('COMMIT');
    const duration = (+new Date(window.end) - +new Date(window.start)) / 1000;
    const complete = coverage.seconds >= duration - 0.001;
    const started = checkpoint?.first_observed_at && +checkpoint.first_observed_at < +new Date(window.end);
    return { ...window, songs, state: !started ? 'initial' : !complete ? 'partial' : songs.length ? 'complete' : 'empty',
      coverage: { seconds: coverage.seconds, duration, complete,
        firstObservedAt: checkpoint?.first_observed_at ?? null, lastObservedAt: checkpoint?.observed_at ?? null,
        collectorHealthy: Boolean(checkpoint?.observed_at) && +now - +checkpoint.observed_at <= COVERAGE_GAP_MS && !checkpoint.last_error } };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
