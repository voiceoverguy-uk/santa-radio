import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { clerkMiddleware } from '@clerk/express';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { authorize } from './name-requests.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { competitionState, demoBallot, requestLimit, manageCompetition, staffCompetition, rememberedDemo } from './contenders-store.js';
import { bobEntry, defaultSettings, secureMediaLink, sourceContenderCatalogue } from '../src/lib/contenders.js';
import waveformCatalogue from '../src/lib/contender-waveforms.json' with { type: 'json' };
import { normalizeVotingEmail } from './contender-consent.js';
import { preparePreviewVoteNotification } from './contender-song-notification.js';
import { contenderFailureDiagnostic } from './contender-diagnostics.js';

export function privateDigest(value) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw Object.assign(new Error('Signing unavailable'), { code: 'CONTENDERS_SIGNING_UNAVAILABLE' });
  }
  return createHmac('sha256', process.env.SESSION_SECRET).update(`contenders:${value}`).digest('hex');
}
export function validateManagement(body) {
  if (body?.action === 'notification-review') return /^[a-f0-9-]{36}$/.test(body.id || '') &&
    ['accepted','not-accepted'].includes(body.decision) && body.acknowledged === true;
  if (body?.action === 'settings') {
    const s = body.settings;
    const validDate = value => typeof value === 'string' && value.length <= 40 &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
    if (!s || !['scheduled','closed','unavailable'].includes(s.availability) ||
      !['open','closed','unavailable'].includes(s.demoAvailability) ||
      !(s.repeatDemo === undefined || typeof s.repeatDemo === 'boolean') ||
      !validDate(s.opensAt) || !validDate(s.closesAt) ||
      Date.parse(s.opensAt) >= Date.parse(s.closesAt) ||
      !(s.submissionCutoff === null || validDate(s.submissionCutoff))) return false;
    body.settings = { opensAt: new Date(s.opensAt).toISOString(), closesAt: new Date(s.closesAt).toISOString(),
      availability: s.availability, demoAvailability: s.demoAvailability,
      repeatDemo: s.repeatDemo === true,
      submissionCutoff: s.submissionCutoff === null ? null : new Date(s.submissionCutoff).toISOString() };
    return true;
  }
  if (body?.action === 'invalidate') return /^[a-f0-9-]{36}$/.test(body.id || '');
  if (body?.action !== 'entry') return false;
  const e = body.entry;
  return e && /^[a-z0-9][a-z0-9-]{0,79}$/.test(e.id || '') && ['demo','live'].includes(e.mode) &&
    (e.id !== 'bob-the-elf' || e.mode === 'demo') &&
    typeof e.artist === 'string' && e.artist.trim().length > 0 && e.artist.length <= 120 &&
    typeof e.title === 'string' && e.title.trim().length > 0 && e.title.length <= 160 &&
    (e.description === undefined || (typeof e.description === 'string' && e.description.length <= 180)) &&
    secureMediaLink(e.audio) && secureMediaLink(e.artwork) && typeof e.approved === 'boolean' &&
    !(e.mode === 'live' && (e.audio === bobEntry.audio || e.artwork === bobEntry.artwork));
}
export function createContendersHandler({ read = competitionState, vote = demoBallot, limit = requestLimit,
  digest = privateDigest, checkAdmin = authorize, manage = manageCompetition,
  staffRead = staffCompetition, remember = rememberedDemo,
  logDiagnostic = event => console.error(JSON.stringify(event)) } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex');
    const staff = req.method === 'PATCH' || req.query?.staff === '1';
    let stage = 'request_setup';
    try {
      if (!['GET','POST','PATCH'].includes(req.method)) return res.status(405).json({error:'Method not allowed.'});
      if (req.method !== 'GET') {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { /* Reject missing/malformed origins. */ }
        const protocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() || req.protocol;
        if (!origin || origin.host !== getClerkProxyHost(req) || origin.protocol !== `${protocol}:` ||
          req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Please use this website to vote.'});
      }
      if (staff) {
        const allowed = await checkAdmin(req);
        if (allowed !== 200) return res.status(allowed).json({error:'Approved staff access is required.'});
      }
      const source = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      stage = 'request_signing';
      const bucket = digest(`limit:${req.method}:${source}:${Math.floor(Date.now()/3600000)}`);
      stage = 'rate_limit_storage';
      await limit(bucket, req.method === 'GET' ? 300 : 30);
      if (req.method === 'GET') {
        stage = 'competition_state';
        const data = await (staff ? staffRead() : read());
        if (!staff) {
          stage = 'ballot_cookie';
          const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('contenders-demo='))?.slice(16);
          const [key,signature] = (cookie || '').split('.');
          if (/^[a-f0-9]{64}$/.test(key || '') && /^[a-f0-9]{64}$/.test(signature || '') &&
              timingSafeEqual(Buffer.from(signature),Buffer.from(digest(`demo-cookie:${key}`)))) {
            stage = 'ballot_restore';
            data.viewerBallot = await remember(key);
          }
        }
        return res.json(data);
      }
      if (req.method === 'PATCH') {
        if (!validateManagement(req.body)) return res.status(400).json({error:'Check the competition settings or entry details.'});
        stage = 'competition_management';
        await manage(req.body);
        stage = 'competition_state';
        return res.json(await staffRead());
      }
      const b = req.body;
      if (!b || b.mode !== 'demo') return res.status(503).json({error:'Real voting is not enabled in this preview. No ballot was created.'});
      const identity = normalizeVotingEmail(b.email);
      if (!['submit','prepare','confirm'].includes(b.action) || typeof b.entryId !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{0,79}$/.test(b.entryId) || !identity || b.website ||
        b.testDelivery !== undefined ||
        !(b.marketingOptIn === undefined || typeof b.marketingOptIn === 'boolean')) {
        return res.status(400).json({error:'Check your email address and chosen song.'});
      }
      const repeatAttempt = b.attemptId !== undefined;
      if (repeatAttempt && (typeof b.attemptId !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(b.attemptId))) {
        return res.status(400).json({error:'Please start a new demo test ballot.'});
      }
      stage = 'competition_state';
      if (repeatAttempt && (await read()).settings?.repeatDemo !== true) {
        return res.status(409).json({error:'Repeat demo testing is switched off. Reload to use the one-ballot demo.'});
      }
      stage = 'vote_signing';
      const voterKey = digest(repeatAttempt ? `demo-repeat:${identity}:${b.attemptId}` : `demo-voter:${identity}`);
      const voteArgs = {entryId:b.entryId,voterKey,repeatAttempt,marketingOptIn:b.marketingOptIn === true,
        prepareNotification: preparePreviewVoteNotification};
      // One visitor action, while retaining the existing atomic reservation,
      // duplicate guards and uncertain-result protections inside the store.
      stage = 'demo_submission';
      let result = await vote({...voteArgs,action:b.action === 'submit' ? 'prepare' : b.action});
      if (b.action === 'submit' && result.state === 'confirmation') {
        result = await vote({...voteArgs,action:'confirm'});
      }
      stage = 'ballot_cookie';
      res.append('Set-Cookie', `contenders-demo=${voterKey}.${digest(`demo-cookie:${voterKey}`)}; Path=/api/christmas-contenders; HttpOnly; SameSite=Lax; Max-Age=2592000${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
      return res.json(result);
    } catch (error) {
      if ([400,409,429].includes(error.status)) return res.status(error.status).json({error:error.message});
      // Never log addresses, identities, bodies, secrets or raw database errors.
      try { logDiagnostic(contenderFailureDiagnostic(error, stage)); } catch { /* Logging must not change the response. */ }
      if (req.method === 'GET' && !staff) return res.status(503).json({
        settings:defaultSettings,entries:sourceContenderCatalogue.map(entry => ({
          ...entry, total:null, waveform:waveformCatalogue[entry.audio] || null,
        })),ready:false,status:'unavailable',
        demoStatus:'unavailable',serverNow:new Date().toISOString(),realVotingEnabled:false,
        launchDependency:'Shared storage, schema or signing is unavailable. The approved source catalogue is shown, but totals are unknown and no ballots can be recorded.',
      });
      return res.status(503).json({error:'Shared voting storage, schema or signing is unavailable. Please try later.'});
    }
  };
}
const app = express();
app.disable('x-powered-by');
const auth = clerkMiddleware(req => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? '', process.env.CLERK_PUBLISHABLE_KEY),
}));
app.use((req,res,next) => req.method === 'PATCH' || req.query.staff === '1' ? auth(req,res,next) : next());
app.use(express.json({limit:'8kb'}));
app.use(createContendersHandler());
app.use((error,_req,res,_next) => res.status(error.status === 413 ? 413 : 400).json({error:'Please send a valid, bounded request.'}));
export default app;
