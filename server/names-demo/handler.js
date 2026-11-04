import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createDemoSearch } from './snapshot.js';
import { consumeNameAccess, privateResponse, readNameJson } from '../santa-name-security.js';
import { BLOCKED_NAME_NOTE, isBlockedName } from '../../src/lib/nameLanguage.js';

export function createNamesDemoHandler({ search = createDemoSearch(), limit = consumeNameAccess } = {}) {
  return async (req, res) => {
    privateResponse(res);
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url, 'http://server');
    if (url.search) return send(403, { error: 'URL-based searches and bulk exports are not available.' });
    if (url.pathname === '/names' && ['GET', 'HEAD'].includes(req.method)) {
      const html = await readFile(new URL('./page.html', import.meta.url), 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev",
      });
      return res.end(req.method === 'HEAD' ? undefined : html);
    }
    if (req.method !== 'POST' || url.pathname !== '/api/names-demo') {
      res.setHeader('Allow', 'POST');
      return send(405, { error: 'Use the name search on /names.' });
    }
    try {
      await limit(req, 'search'); // Existing shared anti-harvesting buckets; no new tables.
      const data = await readNameJson(req);
      const query = typeof data.query === 'string' ? data.query.normalize('NFKC').trim() : '';
      if (Object.keys(data).some(key => key !== 'query') || [...query].length > 80 ||
          [...query].filter(letter => /\p{L}/u.test(letter)).length < 2 ||
          !/^[\p{L}\p{M}][\p{L}\p{M} '’\-]*$/u.test(query)) {
        return send(400, { error: 'Enter at least two letters of a name, without wildcards.' });
      }
      if (isBlockedName(query)) return send(400, { error: BLOCKED_NAME_NOTE });
      const start = performance.now();
      const names = (await search(query)).slice(0, 10);
      res.setHeader('Server-Timing', `snapshot-search;dur=${(performance.now() - start).toFixed(3)}`);
      return send(200, { names });
    } catch (error) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return send(error.status || 503, { error: error.status ? error.message :
        'The saved name search is unavailable. Please try again later.' });
    }
  };
}

const handler = createNamesDemoHandler();
export default handler;

// Exact routes, and a development-server guard against Vite source/raw access.
export function namesDemoMiddleware(req, res, next) {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://server').pathname).replaceAll('\\', '/'); }
  catch { return res.writeHead(400).end(); }
  if (path.includes('/server/names-demo')) return res.writeHead(404).end('Not found');
  if (path === '/names' || path === '/api/names-demo') return handler(req, res);
  return next();
}
