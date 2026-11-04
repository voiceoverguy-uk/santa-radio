import { createHash, randomUUID } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { workshopSession } from './santa-workshop-access.js';
import { studioClaimFromRequest } from './santa-studio-purchase.js';
import { liveProduction } from './studio-live-config.js';
import { singleCookie, LIVE_ACCESS_COOKIE, LIVE_PENDING_COOKIE, LIVE_CHECKOUT_COOKIE } from './studio-live-access.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const problem = (status, message) => Object.assign(new Error(message), { status });

// Called only AFTER authorization. Neither shared tester code nor IP is an
// entitlement identity. A checkout claim keeps its identity across cookies.
export function studioGenerationKey(req) {
  const tester = workshopSession(req);
  if (tester) return tester.generationKey;
  if (liveProduction()) {
    const identity = singleCookie(req, LIVE_ACCESS_COOKIE)
      || `${singleCookie(req, LIVE_PENDING_COOKIE) || ''}:${singleCookie(req, LIVE_CHECKOUT_COOKIE) || ''}`;
    if (identity === ':') throw problem(403, 'Please reopen Studio to check your access.');
    return hash(`studio-live:${identity}`);
  }
  const claim = studioClaimFromRequest(req);
  if (!claim) throw problem(403, 'Please reopen Studio to check your access.');
  return hash(`sandbox:${claim.sessionId}:${claim.claimToken}`);
}

export function studioIdentity(choices, category) {
  return { name: choices.name, category, place: choices.place, region: choices.region || '' };
}
// Correlation only, not an access capability. Allows clients to distinguish
// sequence 1 in a new authorised tester session from sequence 1 in the old one.
export const studioGenerationEpoch = key => hash(`studio-response:${key}`);
export function studioRequestHash(choices) {
  return hash(JSON.stringify(['name', 'age', 'activity', 'achievement', 'treat', 'place', 'region', 'talent']
    .map(key => key === 'talent'
      ? choices.talent?.skip ? ['skip'] : [choices.talent?.category, choices.talent?.id]
      : choices[key] || '')));
}
export function generationStatus(row) {
  return { successes: row?.successes || 0, remaining: 2 - (row?.successes || 0),
    locked: row?.locked_identity || null, choices: row?.latest_choices || null,
    pending: !!row?.pending };
}

export function createStudioGenerationStore(pool = databasePool()) {
  const transaction = async work => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  };
  return {
    async status(key) {
      const result = await pool.query(`SELECT *, reserved_until > clock_timestamp() AS pending
        FROM public.santa_studio_generation_access WHERE access_key=$1`, [key]);
      return generationStatus(result.rows[0]);
    },
    async recovery(key) {
      const result = await pool.query(`SELECT r.operation, r.sequence, a.latest_choices AS choices,
        CASE WHEN octet_length(r.audio)>0 THEN r.audio ELSE NULL END AS legacy_audio
        FROM public.santa_studio_generation_results r
        JOIN public.santa_studio_generation_access a ON a.access_key=r.access_key
        WHERE r.access_key=$1 ORDER BY r.sequence DESC LIMIT 1`, [key]);
      const row = result.rows[0];
      if (!row) return null;
      const { legacy_audio, ...metadata } = row;
      return legacy_audio?.length ? { ...metadata, legacyAudio: legacy_audio } : metadata;
    },
    async reserve(key, operation, choices, identity) {
      return transaction(async client => {
        await client.query(`INSERT INTO public.santa_studio_generation_access(access_key)
          VALUES($1) ON CONFLICT DO NOTHING`, [key]);
        const { rows: [row] } = await client.query(`SELECT *, reserved_until > clock_timestamp() AS pending
          FROM public.santa_studio_generation_access WHERE access_key=$1 FOR UPDATE`, [key]);
        const requestHash = studioRequestHash(choices);
        const previous = await client.query(`SELECT request_hash, sequence FROM public.santa_studio_generation_results
          WHERE access_key=$1 AND operation=$2`, [key, operation]);
        if (previous.rowCount) {
          if (previous.rows[0].request_hash !== requestHash) throw problem(409, 'This request was already used for different choices.');
        }
        if (row.locked_identity && Object.keys(row.locked_identity)
          .some(key => row.locked_identity[key] !== identity[key])) {
          throw problem(409, 'The recorded name and full destination are locked after your first message.');
        }
        if (!previous.rowCount && row.successes >= 2) throw problem(409, 'Both messages have been created. No further generation is available; you can still download your recording.');
        if (row.pending) throw problem(409, 'A message is already being prepared for this access. Please wait and check again.');
        const reservation = randomUUID();
        await client.query(`UPDATE public.santa_studio_generation_access SET reservation=$2,
          operation=$3, request_hash=$4, reserved_until=clock_timestamp()+interval '150 seconds'
          WHERE access_key=$1`, [key, reservation, operation, requestHash]);
        return { reservation, replay: previous.rowCount > 0, sequence: previous.rows[0]?.sequence };
      });
    },
    async succeed(key, reservation, choices, identity) {
      return transaction(async client => {
        const { rows: [row] } = await client.query(`SELECT *, reserved_until > clock_timestamp() AS pending
          FROM public.santa_studio_generation_access WHERE access_key=$1 FOR UPDATE`, [key]);
        if (!row || row.reservation !== reservation || !row.pending) {
          throw problem(409, 'This preparation expired. Please check your current recording and try again.');
        }
        const previous = await client.query(`SELECT sequence FROM public.santa_studio_generation_results
          WHERE access_key=$1 AND operation=$2`, [key, row.operation]);
        if (previous.rowCount) {
          await client.query(`UPDATE public.santa_studio_generation_access SET reservation=NULL,
            operation=NULL, request_hash=NULL, reserved_until=NULL WHERE access_key=$1 AND reservation=$2`,
          [key, reservation]);
          return previous.rows[0].sequence;
        }
        // Metadata only. Keep the legacy NOT NULL column compatible with
        // existing deployments, but never persist a newly rendered MP3.
        // Existing user data is intentionally not read, rewritten or deleted.
        await client.query(`INSERT INTO public.santa_studio_generation_results
          (access_key,operation,request_hash,sequence,audio,created_at) VALUES($1,$2,$3,$4,$5,clock_timestamp())`,
        [key, row.operation, row.request_hash, row.successes + 1, Buffer.alloc(0)]);
        await client.query(`UPDATE public.santa_studio_generation_access SET successes=successes+1,
          locked_identity=COALESCE(locked_identity,$3), latest_choices=$4,
          reservation=NULL, operation=NULL, request_hash=NULL, reserved_until=NULL
          WHERE access_key=$1 AND reservation=$2`, [key, reservation, identity, choices]);
        return row.successes + 1;
      });
    },
    async release(key, reservation) {
      await pool.query(`UPDATE public.santa_studio_generation_access SET reservation=NULL,
        operation=NULL,request_hash=NULL,reserved_until=NULL WHERE access_key=$1 AND reservation=$2`,
      [key, reservation]);
    },
  };
}

// Lazy construction: importing a handler must not require a configured DB.
let store;
export const studioGenerationStore = new Proxy({}, {
  get: (_target, method) => (...args) => (store ||= createStudioGenerationStore())[method](...args),
});
