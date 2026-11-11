import { clerkMiddleware } from '@clerk/express';
import { clerkPublishableKey } from '../src/lib/clerkPublishableKey.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { privateResponse } from './santa-name-security.js';

const clerk = clerkMiddleware(req => ({
  publishableKey: clerkPublishableKey(getClerkProxyHost(req) ?? '', process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
}));
export function staffAuth(req, res, next) {
  privateResponse(res);
  // An anonymous request is not malformed input. Do not invoke handshake or
  // configuration-dependent authentication for a request with no credential.
  const cookie = String(req.headers.cookie || '');
  if (!req.headers.authorization && !/(?:^|;\s*)__session(?:_[^=;]+)?=/.test(cookie)) {
    return res.status(401).json({ error: 'Sign in with an approved staff account.' });
  }
  return clerk(req, res, error => error
    ? res.status(503).json({ error: 'Staff sign-in is temporarily unavailable.' })
    : next());
}
