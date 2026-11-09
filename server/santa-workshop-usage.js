import express from 'express';
import { staffAuth } from './staff-auth.js';
import { authorize } from './name-requests.js';
import { privateResponse } from './santa-name-security.js';
import { workshopUsageReport } from './santa-workshop-usage-store.js';
import { studioStorageDiagnostic } from './studio-storage-diagnostic.js';
import { createOwnerHandler, ownerTokenRequest } from './studio-owner-handler.js';

export function createWorkshopUsageHandler({
  checkAdmin = authorize, read = workshopUsageReport, diagnose = studioStorageDiagnostic,
} = {}) {
  return async (req, res) => {
    privateResponse(res);
    if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).json({ error: 'Use the private usage report.' });
    try {
      const allowed = await checkAdmin(req);
      if (allowed !== 200) return res.status(allowed).json({ error: 'Approved staff access is required to view voucher usage.' });
      const diagnostic = new URL(req.originalUrl || req.url || '/', 'http://internal').searchParams.get('diagnostic');
      if (diagnostic !== null) {
        if (diagnostic !== 'recording-storage') return res.status(400).json({ error: 'Unknown diagnostic.' });
        if (req.headers['sec-fetch-site'] === 'cross-site') {
          return res.status(403).json({ error: 'Open this check from the private staff page.' });
        }
        return res.json(await diagnose());
      }
      return res.json(await read());
    } catch {
      return res.status(503).json({ error: 'Voucher usage is temporarily unavailable. Please try again.' });
    }
  };
}

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => { privateResponse(res); next(); });
const ownerHandler = createOwnerHandler();
app.use((req, res, next) => {
  const diagnostic = new URL(req.originalUrl || req.url || '/', 'http://internal').searchParams.get('diagnostic');
  if (diagnostic !== 'live-launch') return next();
  if (ownerTokenRequest(req)) return ownerHandler(req, res, next);
  return staffAuth(req, res, () => ownerHandler(req, res, next));
});
app.use(staffAuth);
app.use(createWorkshopUsageHandler());
export default app;
