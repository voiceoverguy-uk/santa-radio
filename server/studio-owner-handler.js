import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { authorize } from './name-requests.js';
import { liveHeaders, sameLiveOrigin } from './studio-live-config.js';
import { ownerConfig, ownerReadiness, ownerCanary, probeOwnerWorker } from './studio-owner-readiness.js';
import { consumeLiveAttempt } from './studio-live-store.js';

export function ownerTokenRequest(req) {
  return typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer studio-owner.');
}
export function validOwnerToken(req, env = process.env) {
  const token = req.headers.authorization?.slice('Bearer studio-owner.'.length);
  const expected = env.STUDIO_OWNER_TOKEN;
  if (!ownerTokenRequest(req) || !/^[A-Za-z0-9_-]{43,200}$/.test(expected || '')
    || !/^[A-Za-z0-9_-]{43,200}$/.test(token || '')) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(token), hash(expected));
}
const authorizeOwner = req => ownerTokenRequest(req)
  ? Promise.resolve(validOwnerToken(req) ? 200 : 401) : authorize(req);

export function createOwnerHandler({
  checkAdmin = authorizeOwner, getConfig = ownerConfig, report = ownerReadiness,
  simulator = probeOwnerWorker, canary = ownerCanary, consume = consumeLiveAttempt,
} = {}) {
  const app = express();
  app.use(async (req, res, next) => {
    liveHeaders(res);
    try {
      const allowed = await checkAdmin(req);
      if (allowed !== 200) return res.status(allowed).json({ error: 'Approved owner sign-in required.' });
      if (!['GET', 'POST'].includes(req.method)) return res.status(405).end();
      const config = getConfig();
      if (req.headers.host !== new URL(config.origin).host || req.headers['sec-fetch-site'] === 'cross-site'
        || req.method === 'POST' && !sameLiveOrigin(req, config)) return res.status(403).end();
      if (req.method === 'POST' && !req.is('application/json')) return res.status(415).end();
      if (!await consume(req, config, 'owner-readiness')) return res.status(429).json({ error: 'Please wait before checking again.' });
      req.ownerConfig = config;
      next();
    } catch { res.status(503).json({ error: 'Owner diagnostics unavailable. Check production configuration and staff sign-in.' }); }
  });
  app.use(express.json({ limit: '1kb', strict: true, inflate: false }));
  app.use(async (req, res) => {
    try {
      const options = { config: req.ownerConfig };
      if (req.method === 'GET') return res.json(await report(options));
      if (!req.body || Object.keys(req.body).length !== 1) return res.status(400).end();
      if (req.body.action === 'simulator') return res.json(await simulator(options));
      if (req.body.action === 'canary') return await canary(req, res, options);
      return res.status(400).end();
    } catch { return res.status(503).json({ error: 'Check failed. No public sales were enabled. Inspect readiness again; the simulator refuses a non-empty outbox.' }); }
  });
  app.use((_error, _req, res, _next) => res.status(400).json({ error: 'Invalid owner request.' }));
  return app;
}
