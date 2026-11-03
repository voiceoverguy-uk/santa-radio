import express from 'express';
import { staffAuth } from './staff-auth.js';
import { authorize } from './name-requests.js';
import { privateResponse } from './santa-name-security.js';
import { workshopUsageReport } from './santa-workshop-usage-store.js';

export function createWorkshopUsageHandler({ checkAdmin = authorize, read = workshopUsageReport } = {}) {
  return async (req, res) => {
    privateResponse(res);
    if (req.method !== 'GET') return res.set('Allow', 'GET').status(405).json({ error: 'Use the private usage report.' });
    try {
      const allowed = await checkAdmin(req);
      if (allowed !== 200) return res.status(allowed).json({ error: 'Approved staff access is required to view voucher usage.' });
      return res.json(await read());
    } catch {
      return res.status(503).json({ error: 'Voucher usage is temporarily unavailable. Please try again.' });
    }
  };
}

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => { privateResponse(res); next(); });
app.use(staffAuth);
app.use(createWorkshopUsageHandler());
export default app;
