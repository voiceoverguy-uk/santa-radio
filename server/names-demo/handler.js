import { readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const assetPath = /^\/names-data\/(names-[a-f0-9]{64}\.json)$/;
const filenamePattern = /^names-[a-f0-9]{64}\.json$/;
const pagePolicy = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev";

function encodingFor(header = '') {
  const choices = new Map(header.toLowerCase().split(',').filter(Boolean).map(value => {
    const [name, ...params] = value.trim().split(';');
    const q = params.find(param => param.trim().startsWith('q='));
    const quality = q ? Number(q.trim().slice(2)) : 1;
    return [name.trim(), Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0];
  }));
  const compressed = ['br', 'gzip'].map(name => [name, choices.get(name) ?? choices.get('*') ?? 0])
    .sort((a, b) => b[1] - a[1]);
  const explicitIdentity = choices.get('identity');
  if (explicitIdentity !== undefined && explicitIdentity > compressed[0][1]) return '';
  if (compressed[0][1] > 0) return compressed[0][0];
  if ((explicitIdentity ?? (choices.get('*') === 0 ? 0 : 1)) > 0) return '';
  return null;
}

export function createNamesDemoHandler({ directory = root } = {}) {
  return async (req, res) => {
    const fail = (status, message) => {
      res.setHeader('Cache-Control', 'private, no-store');
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: message }));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const url = new URL(req.url, 'http://server');
    if (url.search) return fail(403, 'URL searches and alternate export modes are unavailable.');
    if (url.pathname === '/api/names-demo') {
      return fail(410, 'Individual searches are retired. Open /names to search in your browser.');
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return fail(405, 'Use GET or HEAD.');
    }
    try {
      if (url.pathname === '/names') {
        const manifest = JSON.parse(await readFile(new URL('./asset-manifest.json', directory), 'utf8'));
        if (!filenamePattern.test(manifest.filename)) throw new Error('Invalid asset pointer');
        const html = (await readFile(new URL('./page.html', directory), 'utf8'))
          .replaceAll('__NAMES_ASSET_URL__', `/names-data/${manifest.filename}`);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('CDN-Cache-Control', 'no-store');
        res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': pagePolicy });
        return res.end(req.method === 'HEAD' ? undefined : html);
      }
      const match = assetPath.exec(url.pathname);
      if (!match) return fail(404, 'Not found.');
      const encoding = encodingFor(req.headers['accept-encoding']);
      if (encoding === null) return fail(406, 'No acceptable encoding.');
      const suffix = encoding === 'br' ? '.br' : encoding === 'gzip' ? '.gz' : '';
      const bytes = await readFile(new URL(`./assets/${match[1]}${suffix}`, directory));
      const etag = `"${match[1]}-${encoding || 'identity'}"`;
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('ETag', etag);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (encoding) res.setHeader('Content-Encoding', encoding);
      if (req.headers['if-none-match']?.split(/\s*,\s*/).some(value => value === etag || value === '*')) {
        return res.writeHead(304).end();
      }
      res.setHeader('Content-Length', bytes.length);
      res.writeHead(200);
      return res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      return fail(error.code === 'ENOENT' && url.pathname !== '/names' ? 404 : 503,
        'The names list is unavailable. Please try again later.');
    }
  };
}

const handler = createNamesDemoHandler();
export default handler;

export function namesDemoMiddleware(req, res, next) {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://server').pathname).replaceAll('\\', '/'); }
  catch { return res.writeHead(400).end(); }
  if (path.includes('/server/names-demo')) return res.writeHead(404).end('Not found');
  if (path === '/names' || path === '/api/names-demo' || path.startsWith('/names-data/')) return handler(req, res);
  return next();
}
