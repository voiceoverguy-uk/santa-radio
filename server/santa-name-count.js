import { santaNameLibrary } from './santa-name-library.js';
import { consumeNameAccess, privateResponse } from './santa-name-security.js';

// Deliberately separate from lookup: only this explicitly approved aggregate
// is public. Never project catalogue records, filenames or origin URLs here.
export function createSantaNameCountHandler(library = santaNameLibrary, { limit = consumeNameAccess } = {}) {
  return async (req, res) => {
    privateResponse(res);
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, { error: 'Method not allowed.' });
    }
    if (new URL(req.url, 'http://server').search) {
      return send(400, { error: 'This endpoint accepts no search parameters.' });
    }
    try {
      await limit(req, 'count');
      const total = await library.count();
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid aggregate.');
      return send(200, { total });
    } catch (error) {
      if (error.status === 429) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        return send(429, { error: 'Too many requests. Please try again shortly.' });
      }
      return send(503, { error: 'The recorded-name total is temporarily unavailable.' });
    }
  };
}

export default createSantaNameCountHandler();
