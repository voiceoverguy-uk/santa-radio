import express from 'express';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { createClerkClient } from '@clerk/backend';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { normaliseRequestedName, nameRequestConfirmation } from '../src/lib/santaNameRequests.js';
import { saveNameRequest, listNameRequests } from './name-request-store.js';

const COOKIE = 'santa-name-request-visitor';
const digest = value => createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex');
export function approvedAdmin(user, configured = process.env.SANTA_REQUEST_ADMIN_EMAILS || '') {
  const primary = user?.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
  return primary?.verification?.status === 'verified' &&
    configured.split(/[\s,;]+/).map(email => email.toLowerCase()).includes(primary.emailAddress.toLowerCase());
}
async function authorize(req) {
  const { userId } = getAuth(req);
  if (!userId) return 401;
  const user = await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUser(userId);
  return approvedAdmin(user) ? 200 : 403;
}
function visitor(req, res) {
  if (!process.env.SESSION_SECRET) throw new Error('Request control is not configured');
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
export function createNameRequestHandler({ checkAdmin = authorize, save = saveNameRequest, list = listNameRequests, identify = visitor } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    try {
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== getClerkProxyHost(req)) return res.status(403).json({ error: 'Please request the name from this website.' });
        const name = normaliseRequestedName(req.body?.name);
        if (!name) return res.status(400).json({ error: 'Enter a first name using letters, spaces, apostrophes or hyphens (up to 80 characters).' });
        const { visitorKey, bucketKey } = identify(req, res);
        const result = await save(name, visitorKey, bucketKey);
        return res.json({ ...result, name: name.name, message: nameRequestConfirmation() });
      }
      if (req.method === 'GET') {
        const allowed = await checkAdmin(req);
        if (allowed !== 200) return res.status(allowed).json({ error: allowed === 401 ? 'Sign in to view name requests.' : 'This account is not approved to view name requests.' });
        const url = new URL(req.originalUrl || req.url, 'http://server');
        const page = Math.max(1, Math.min(1000000, parseInt(url.searchParams.get('page'), 10) || 1));
        const q = (url.searchParams.get('q') || '').normalize('NFKC').trim().toLocaleLowerCase('en-GB').slice(0, 80);
        return res.json(await list(page, q));
      }
      return res.set('Allow', 'GET, POST').status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
      if (error.status === 429) return res.set('Retry-After', String(error.retryAfter)).status(429).json({ error: error.message });
      console.error('Name request service unavailable');
      return res.status(503).json({ error: 'Name requests are temporarily unavailable. Please try again later.' });
    }
  };
}
const app = express();
app.disable('x-powered-by');
const auth = clerkMiddleware(req => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? '', process.env.CLERK_PUBLISHABLE_KEY),
}));
app.use((req, res, next) => req.method === 'GET' ? auth(req, res, next) : next());
app.use(express.json({ limit: '2kb' }));
app.use(createNameRequestHandler());
app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'Please send a valid, short name request.' }));
export default app;
