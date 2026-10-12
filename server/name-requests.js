import express from 'express';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { createClerkClient } from '@clerk/backend';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { normaliseRequestedName, nameRequestConfirmation } from '../src/lib/santaNameRequests.js';
import { saveNameRequest, listNameRequests, recordNameRequest } from './name-request-store.js';

const COOKIE = 'santa-name-request-visitor';
const digest = value => createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex');
export function approvedAdmin(user) {
  const primary = user?.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
  return primary?.verification?.status === 'verified' &&
    primary.emailAddress?.toLowerCase() === 'admin@santaradio.co.uk';
}
async function authorize(req) {
  const { userId } = getAuth(req);
  if (!userId) return 401;
  const user = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUser(userId);
  return approvedAdmin(user) ? 200 : 403;
}
function visitor(req, res) {
  if (!process.env.SESSION_SECRET) throw Object.assign(new Error('Request control is not configured'), { code: 'SIGNING_NOT_CONFIGURED' });
  const raw = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  let [id, signature] = (raw || '').split('.');
  const valid = /^[a-f0-9-]{36}$/.test(id || '') && /^[a-f0-9]{64}$/.test(signature || '') &&
    timingSafeEqual(Buffer.from(digest(id)), Buffer.from(signature));
  if (!valid) {
    id = randomUUID();
    const secure = req.secure || req.headers['x-forwarded-proto']?.split(',')[0] === 'https';
    res.append('Set-Cookie', `${COOKIE}=${id}.${digest(id)}; Path=/api/name-requests; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`);
  }
  return { visitorKey: digest(`visitor:${id}`), bucketKey: digest(`limit:${id}:${Math.floor(Date.now() / 3600000)}`) };
}
export function createNameRequestHandler({ checkAdmin = authorize, save = saveNameRequest, list = listNameRequests,
  record = recordNameRequest, identify = visitor } = {}) {
  return async (req, res) => {
    let stage = 'validation';
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    try {
      if (req.method === 'POST' || req.method === 'PATCH') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== getClerkProxyHost(req)) return res.status(403).json({ error: 'Please use this website to manage name requests.' });
      }
      if (req.method === 'POST') {
        const name = normaliseRequestedName(req.body?.name);
        if (!name) return res.status(400).json({ error: 'Enter a first name using letters, spaces, apostrophes or hyphens (up to 80 characters).' });
        if (req.body?.requestId !== undefined && (typeof req.body.requestId !== 'string' ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(req.body.requestId))) {
          return res.status(400).json({ error: 'Invalid request identifier. Please refresh and try again.' });
        }
        stage = 'visitor-signing';
        const { visitorKey, bucketKey } = identify(req, res);
        if (req.body?.requestId) name.submissionKey = digest(`submission:${req.body.requestId.toLowerCase()}`);
        stage = 'save';
        const result = await save(name, visitorKey, bucketKey);
        return res.json({ ...result, saved: true, name: name.name, message: nameRequestConfirmation() });
      }
      if (req.method === 'GET' || req.method === 'PATCH') {
        stage = 'authorization';
        const allowed = await checkAdmin(req);
        if (allowed !== 200) return res.status(allowed).json({ error: allowed === 401 ? 'Sign in to view name requests.' : 'This account is not approved to view name requests.' });
        if (req.method === 'PATCH') {
          const name = normaliseRequestedName(req.body?.name);
          if (!name || req.body?.action !== 'recorded') return res.status(400).json({ error: 'Choose a requested name to mark as recorded.' });
          stage = 'record';
          return res.json(await record(name.key));
        }
        const url = new URL(req.originalUrl || req.url, 'http://server');
        const page = Math.max(1, Math.min(1000000, parseInt(url.searchParams.get('page'), 10) || 1));
        const q = (url.searchParams.get('q') || '').normalize('NFKC').trim().toLocaleLowerCase('en-GB').slice(0, 80);
        const status = url.searchParams.get('status') || 'outstanding';
        if (!['outstanding', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid list selection.' });
        const download = url.searchParams.get('download') === 'txt';
        stage = download ? 'export' : 'list';
        const result = await list(page, q, status, download);
        if (!download) return res.json(result);
        const date = value => value ? new Date(value).toISOString() : '';
        const rows = result.requests.map(item => [item.name, item.count, date(item.firstRequestedAt),
          date(item.lastRequestedAt), date(item.recordedAt)].join('\t'));
        return res.set('Content-Type', 'text/plain; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="santa-name-requests-${status}.txt"`)
          .send(['First name\tRequests\tFirst requested (UTC)\tLatest request (UTC)\tRecorded (UTC)', ...rows].join('\r\n') + '\r\n');
      }
      return res.set('Allow', 'GET, POST, PATCH').status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
      if (error.status === 429) return res.set('Retry-After', String(error.retryAfter)).status(429).json({ error: error.message });
      if (error.status === 404) return res.status(404).json({ error: error.message });
      // Never log names, bodies, cookies, connection strings or raw error messages.
      console.error('Name request service unavailable', { stage,
        code: /^[A-Z0-9_]{1,40}$/.test(error.code || '') ? error.code : 'UNEXPECTED' });
      return res.status(503).json({ error: 'Name requests are temporarily unavailable. Please try again later.' });
    }
  };
}
const app = express();
app.disable('x-powered-by');
const auth = clerkMiddleware(req => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? '', process.env.CLERK_PUBLISHABLE_KEY),
}));
app.use((req, res, next) => ['GET', 'PATCH'].includes(req.method) ? auth(req, res, next) : next());
app.use(express.json({ limit: '2kb' }));
app.use(createNameRequestHandler());
app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Please send a valid, short name request.' }));
export default app;
