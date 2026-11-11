import { votingCodeEmail } from './contenders-voting-email.js';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { databasePool } from './contenders-database.js';
import { COMPETITION, votingStatus } from '../src/lib/contenders.js';
import { normalizeVotingEmail } from './contender-consent.js';

const problem = (message, status = 400) => Object.assign(new Error(message), { status });
export const liveVotingConfigured = (env = process.env) => env.CONTENDERS_LIVE_ENABLED === 'true'
  && !!env.RESEND_API_KEY && env.STUDIO_EMAIL_SENDER_APPROVED === 'true'
  && env.STUDIO_EMAIL_FROM === 'santa@santaradio.co.uk';

export function voterIdentity(value) {
  const email = normalizeVotingEmail(value);
  if (!email) return null;
  let [local, domain] = email.split('@');
  // Gmail documents these as the same mailbox. Do not guess other providers' alias rules.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    domain = 'gmail.com'; local = local.split('+')[0].replaceAll('.', '');
  }
  return local ? `${local}@${domain}` : null;
}
export async function sendVotingCode({ email, code, id, artist, title }, fetcher = fetch, env = process.env) {
  if (!liveVotingConfigured(env)) throw problem('Voting is temporarily unavailable.', 503);
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json',
      'Idempotency-Key': `contenders-code:${id}` },
    body: JSON.stringify({ from: 'Santa Radio <santa@santaradio.co.uk>', to: [email],
      subject: 'Your Santa Radio voting code',
      ...votingCodeEmail(code, { artist, title }) }),
  });
  if (!response.ok || typeof (await response.json()).id !== 'string') throw problem('We couldn’t send your code. Please try again shortly.', 503);
}
async function openEntry(client, entryId) {
  const settings = (await client.query('SELECT settings FROM christmas_contenders_settings WHERE competition=$1 FOR SHARE', [COMPETITION])).rows[0]?.settings;
  if (!settings || votingStatus(settings) !== 'open') throw problem('Voting is not open.', 409);
  const entry = await client.query(`SELECT id,artist,title FROM christmas_contenders_entries
    WHERE competition=$1 AND mode='live' AND id=$2 AND approved=true FOR SHARE`, [COMPETITION, entryId]);
  if (!entry.rowCount) throw problem('Please select an available song.', 409);
  return entry.rows[0];
}
export async function requestVotingCode({ email, entryId, digest, limit, send = sendVotingCode }, pool = databasePool()) {
  const address = normalizeVotingEmail(email), identity = voterIdentity(email);
  if (!address || !identity) throw problem('Enter a valid email address.');
  const voterKey = digest(`live-voter:${identity}`);
  await limit(digest(`vote-email:${identity}:${Math.floor(Date.now()/3600000)}`), 3);
  await pool.query(`DELETE FROM christmas_contenders_verifications WHERE id IN
    (SELECT id FROM christmas_contenders_verifications WHERE expires_at < now() LIMIT 100)`);
  const id = randomUUID(), code = String(randomInt(0, 1000000)).padStart(6, '0');
  const client = await pool.connect();
  let selectedSong;
  try {
    await client.query('BEGIN');
    selectedSong = await openEntry(client, entryId);
    await client.query(`INSERT INTO christmas_contenders_verifications
      (id,competition,voter_key,entry_id,code_hash,expires_at)
      VALUES($1,$2,$3,$4,$5,now()+interval '15 minutes')`,
    [id, COMPETITION, voterKey, entryId, digest(`vote-code:${id}:${code}`)]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  // No email address, code or outbound payload is persisted or logged.
  // If delivery is uncertain, the uncounted challenge expires; a user can request a new one.
  await send({ email: address, code, id, artist: selectedSong.artist, title: selectedSong.title });
  return { state: 'verification', verificationId: id };
}
export async function confirmVotingCode({ id, code, digest }, pool = databasePool()) {
  if (!/^[a-f0-9-]{36}$/.test(id || '') || !/^\d{6}$/.test(code || '')) throw problem('Enter the six-digit code from your email.');
  const client = await pool.connect();
  let result, failure;
  try {
    await client.query('BEGIN');
    const row = (await client.query(`SELECT *, expires_at > now() AS fresh FROM christmas_contenders_verifications
      WHERE id=$1 AND competition=$2 FOR UPDATE`, [id, COMPETITION])).rows[0];
    if (!row || !row.fresh || row.attempts >= 5) {
      failure = problem('This code has expired or reached its attempt limit. Request a new code.', 409);
    } else {
      const actual = digest(`vote-code:${id}:${code}`);
      if (!timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(actual))) {
        await client.query('UPDATE christmas_contenders_verifications SET attempts=attempts+1 WHERE id=$1', [id]);
        failure = problem('That code doesn’t match. Check your email and try again.');
      } else {
        await openEntry(client, row.entry_id);
        const inserted = await client.query(`INSERT INTO christmas_contenders_ballots
          (id,competition,mode,voter_key,entry_id,state,expires_at,confirmed_at)
          VALUES($1,$2,'live',$3,$4,'confirmed',now(),now())
          ON CONFLICT(competition,mode,voter_key) DO NOTHING RETURNING id`,
        [randomUUID(), COMPETITION, row.voter_key, row.entry_id]);
        result = { state: inserted.rowCount ? 'success' : 'already-voted', voterKey: row.voter_key };
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  if (failure) throw failure;
  return result;
}
export async function rememberedLiveVote(voterKey, pool = databasePool()) {
  return (await pool.query(`SELECT state,entry_id AS "entryId",id AS reference FROM christmas_contenders_ballots
    WHERE competition=$1 AND mode='live' AND voter_key=$2`, [COMPETITION, voterKey])).rows[0] || null;
}
