import { randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { COMPETITION, votingStatus } from '../src/lib/contenders.js';
import waveformCatalogue from '../src/lib/contender-waveforms.json' with { type: 'json' };
import { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_SOURCE } from './contender-consent.js';

const problem = (message, status = 400) => Object.assign(new Error(message), { status });
export async function competitionState(client = databasePool(), staff = false) {
  const settings = (await client.query('SELECT settings FROM christmas_contenders_settings WHERE competition=$1', [COMPETITION])).rows[0]?.settings;
  if (!settings) throw problem('Competition storage is not ready.', 503);
  await client.query('SELECT ballot_id FROM christmas_contenders_notifications LIMIT 0');
  const entries = (await client.query(`SELECT e.id,e.id AS anchor,e.mode,e.artist,e.title,e.artwork,e.audio,e.approved${staff ? ',e.description' : ''},
    (SELECT count(*)::integer FROM christmas_contenders_ballots b WHERE b.competition=e.competition
      AND b.mode=e.mode AND b.entry_id=e.id AND b.state='confirmed') AS total
    FROM christmas_contenders_entries e WHERE e.competition=$1 ${staff ? '' : 'AND e.approved=true'} ORDER BY e.id,e.mode`, [COMPETITION])).rows;
  return { settings, entries: entries.map(entry => ({...entry, waveform: waveformCatalogue[entry.audio] || null})),
    status: votingStatus(settings), demoStatus: settings.demoAvailability,
    ready: true, serverNow: new Date().toISOString(), realVotingEnabled: false,
    emailPolicy: 'syntax-only',
    launchDependency: 'Real voting is not enabled in this preview. Launch requires an explicit owner-approved release, not email verification.' };
}
export async function requestLimit(bucket, maximum, now = Date.now()) {
  const expires = new Date((Math.floor(now / 3600000) + 1) * 3600000);
  const result = await databasePool().query(`INSERT INTO christmas_contenders_limits(bucket,attempts,expires_at)
    VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET attempts=christmas_contenders_limits.attempts+1
    WHERE christmas_contenders_limits.attempts < $3 RETURNING attempts`, [bucket, expires, maximum]);
  if (!result.rowCount) throw problem('Too many requests. Please try again later.', 429);
  // Bounded housekeeping; request buckets contain no raw addresses.
  await databasePool().query(`DELETE FROM christmas_contenders_limits WHERE bucket IN
    (SELECT bucket FROM christmas_contenders_limits WHERE expires_at < now() LIMIT 100)`);
}
export async function demoBallot({ action, entryId, voterKey, repeatAttempt = false, marketingOptIn = false,
  prepareNotification = () => async () => ({delivery:'simulated'}) }, pool = databasePool()) {
  const client = await pool.connect();
  let claim;
  let forward;
  try {
    await client.query('BEGIN');
    // Settings lock serializes availability edits with confirmations.
    const row = (await client.query('SELECT settings FROM christmas_contenders_settings WHERE competition=$1 FOR SHARE', [COMPETITION])).rows[0];
    if (!row) throw problem('Competition storage is not ready.', 503);
    if (row.settings.demoAvailability !== 'open') throw problem('Demo voting is closed or unavailable.', 409);
    if (repeatAttempt && row.settings.repeatDemo !== true) throw problem('Repeat demo testing is switched off.', 409);
    const entry = (await client.query(`SELECT id,artist,title FROM christmas_contenders_entries
      WHERE competition=$1 AND mode='demo' AND id=$2 AND approved=true FOR SHARE`, [COMPETITION, entryId])).rows[0];
    if (!entry) throw problem('Please choose an approved demo recording.');
    if (action === 'prepare') {
      await client.query(`INSERT INTO christmas_contenders_ballots(id,competition,mode,voter_key,entry_id,state,expires_at)
        VALUES($1,$2,'demo',$3,$4,'pending',now()+interval '15 minutes')
        ON CONFLICT(competition,mode,voter_key) DO NOTHING`, [randomUUID(), COMPETITION, voterKey, entryId]);
    }
    const ballot = (await client.query(`SELECT id,state,entry_id,expires_at FROM christmas_contenders_ballots
      WHERE competition=$1 AND mode='demo' AND voter_key=$2 FOR UPDATE`, [COMPETITION, voterKey])).rows[0];
    if (!ballot) throw problem('Start the demo ballot before confirming.');
    if (ballot.state !== 'pending') {
      await client.query('COMMIT');
      return {state:'already-voted',reference:ballot.id};
    }
    const notification = (await client.query(`SELECT state,started_at < now()-interval '2 minutes' AS stalled
      FROM christmas_contenders_notifications WHERE ballot_id=$1 FOR UPDATE`, [ballot.id])).rows[0];
    if (notification && ['sending','unknown','accepted','simulated'].includes(notification.state)) {
      const delivery = notification.state === 'sending' && notification.stalled ? 'unknown' : notification.state;
      if (delivery === 'unknown') await client.query(`UPDATE christmas_contenders_notifications SET state='unknown',updated_at=now() WHERE ballot_id=$1`, [ballot.id]);
      await client.query('COMMIT');
      return {state:'pending',reference:ballot.id,delivery};
    }
    if (action === 'prepare') {
      await client.query(`UPDATE christmas_contenders_ballots SET entry_id=$2,expires_at=now()+interval '15 minutes' WHERE id=$1`, [ballot.id, entryId]);
      await client.query('COMMIT');
      return {state:'confirmation',reference:ballot.id};
    }
    if (ballot.entry_id !== entryId || new Date(ballot.expires_at).getTime() <= Date.now()) throw problem('This demo confirmation expired or changed. Start again.', 409);
    // Preflight the complete provider payload before claiming a send. The closure
    // holds contact fields only in request memory; no payload is written to SQL.
    forward = prepareNotification({voteReference:ballot.id,artist:entry.artist,title:entry.title});
    claim = {id:ballot.id,attempt:randomUUID()};
    await client.query(`INSERT INTO christmas_contenders_notifications
      (ballot_id,state,attempt_id,marketing_opt_in,consented_at,consent_source,consent_text)
      VALUES($1,'sending',$2,$3,CASE WHEN $3 THEN now() ELSE NULL END,$4,$5)
      ON CONFLICT(ballot_id) DO UPDATE SET state='sending',attempt_id=EXCLUDED.attempt_id,
      started_at=now(),updated_at=now(),marketing_opt_in=EXCLUDED.marketing_opt_in,
      consented_at=EXCLUDED.consented_at,consent_source=EXCLUDED.consent_source,consent_text=EXCLUDED.consent_text`,
    [claim.id,claim.attempt,marketingOptIn,marketingOptIn ? MARKETING_CONSENT_SOURCE : null,marketingOptIn ? MARKETING_CONSENT_TEXT : null]);
    // Durable sending claim precedes any external work. Concurrent confirmations
    // and crash retries must observe this and never initiate a second send.
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }

  let delivery;
  try { delivery = (await forward()).delivery; }
  catch { delivery = 'unknown'; } // Ambiguous: never automatically resend.
  if (!['simulated','accepted','failed','unknown'].includes(delivery)) delivery = 'unknown';
  const final = await pool.connect();
  try {
    await final.query('BEGIN');
    const ballot = (await final.query('SELECT state FROM christmas_contenders_ballots WHERE id=$1 FOR UPDATE', [claim.id])).rows[0];
    const current = (await final.query('SELECT state,attempt_id FROM christmas_contenders_notifications WHERE ballot_id=$1 FOR UPDATE', [claim.id])).rows[0];
    let state = 'pending';
    if (ballot.state !== 'pending') state = 'already-voted';
    else if (current.attempt_id === claim.attempt && current.state === 'sending') {
      await final.query('UPDATE christmas_contenders_notifications SET state=$2,updated_at=now() WHERE ballot_id=$1', [claim.id,delivery]);
      if (['accepted','simulated'].includes(delivery)) {
        await final.query(`UPDATE christmas_contenders_ballots SET state='confirmed',confirmed_at=now() WHERE id=$1 AND state='pending'`, [claim.id]);
        state = 'success';
      } else if (delivery === 'failed') state = 'error';
    } else delivery = current.state;
    await final.query('COMMIT');
    return {state,delivery,reference:claim.id};
  } catch (error) { await final.query('ROLLBACK').catch(() => {}); throw error; }
  finally { final.release(); }
}
export async function manageCompetition(body, pool = databasePool()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT competition FROM christmas_contenders_settings WHERE competition=$1 FOR UPDATE', [COMPETITION]);
    if (body.action === 'settings') {
      await client.query('UPDATE christmas_contenders_settings SET settings=$2 WHERE competition=$1', [COMPETITION, body.settings]);
    } else if (body.action === 'entry') {
      const e = body.entry;
      // Mode and anchor are immutable; switching modes means a distinct identity.
      // Stored screening/editorial information is private and never cleared by entry edits.
      await client.query(`INSERT INTO christmas_contenders_entries(competition,id,mode,artist,title,artwork,audio,approved)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(competition,mode,id) DO UPDATE SET
        artist=EXCLUDED.artist,title=EXCLUDED.title,artwork=EXCLUDED.artwork,audio=EXCLUDED.audio,approved=EXCLUDED.approved`,
      [COMPETITION,e.id,e.mode,e.artist,e.title,e.artwork,e.audio,e.approved]);
    } else if (body.action === 'invalidate') {
      await client.query(`UPDATE christmas_contenders_ballots SET state='invalidated' WHERE competition=$1 AND id=$2 AND state='confirmed'`, [COMPETITION,body.id]);
    } else if (body.action === 'notification-review') {
      const ballot = (await client.query(`SELECT state FROM christmas_contenders_ballots
        WHERE id=$1 AND competition=$2 AND mode='demo' FOR UPDATE`, [body.id,COMPETITION])).rows[0];
      const notification = (await client.query(`SELECT state,started_at < now()-interval '2 minutes' AS stalled
        FROM christmas_contenders_notifications WHERE ballot_id=$1 FOR UPDATE`, [body.id])).rows[0];
      if (!ballot || ballot.state !== 'pending' || !notification ||
          !(notification.state === 'unknown' || (notification.state === 'sending' && notification.stalled))) {
        throw problem('Only unresolved, uncertain demo notifications can be reconciled.',409);
      }
      // Preview-only staff simulation; no real inbox receipt or delivery claim.
      await client.query(`UPDATE christmas_contenders_notifications SET state=$2,updated_at=now() WHERE ballot_id=$1`,
        [body.id,body.decision === 'accepted' ? 'simulated' : 'failed']);
      if (body.decision === 'accepted') await client.query(`UPDATE christmas_contenders_ballots SET state='confirmed',confirmed_at=now() WHERE id=$1 AND state='pending'`, [body.id]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function staffCompetition() {
  const data = await competitionState(databasePool(), true);
  data.ballots = (await databasePool().query(`SELECT b.id,b.mode,b.entry_id AS "entryId",b.state,b.confirmed_at AS "confirmedAt",
      CASE WHEN n.state='sending' AND n.started_at < now()-interval '2 minutes' THEN 'unknown' ELSE n.state END AS delivery,
      n.marketing_opt_in AS "marketingOptIn",n.consented_at AS "consentedAt"
    FROM christmas_contenders_ballots b LEFT JOIN christmas_contenders_notifications n ON n.ballot_id=b.id
    WHERE b.competition=$1 ORDER BY COALESCE(b.confirmed_at,n.updated_at,b.expires_at) DESC LIMIT 100`, [COMPETITION])).rows;
  return data;
}
export async function rememberedDemo(voterKey) {
  const row = (await databasePool().query(`SELECT b.state,b.entry_id AS "entryId",b.id AS reference,
      CASE WHEN n.state='sending' AND n.started_at < now()-interval '2 minutes' THEN 'unknown' ELSE n.state END AS delivery
    FROM christmas_contenders_ballots b LEFT JOIN christmas_contenders_notifications n ON n.ballot_id=b.id
    WHERE b.competition=$1 AND b.mode='demo' AND b.voter_key=$2`, [COMPETITION,voterKey])).rows[0];
  return row || null;
}
