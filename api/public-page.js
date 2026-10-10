import { readFile } from 'node:fs/promises';
import { resolvePublicRequest } from '../src/seo/routes.js';
import { publicPageHtml } from '../server/public-html.js';
// Vercel runs this only for document routes. Existing API/artwork endpoints stay intact.
export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
  const source = new URL(req.url, 'https://www.santaradio.co.uk');
  const path = source.searchParams.get('__sr_route') || source.pathname;
  source.searchParams.delete('__sr_route');
  const raw = path + (source.searchParams.size ? `?${source.searchParams}` : '');
  const route = resolvePublicRequest(raw);
  if (route.location) { res.setHeader('Location', route.location); return res.status(route.status).end(); }
  if (route.noindex || route.status !== 200) res.setHeader('X-Robots-Tag', 'noindex, follow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  if (req.method === 'HEAD') return res.status(route.status).end();
  if (path === '/santa-tracker' || path === '/santa-tracker/preview') {
    // Only the time-sensitive Tracker needs a runtime renderer.
    const { render } = await import('../dist/server/entry-server.js');
    const template = await readFile(new URL('../dist/server/shell.html', import.meta.url), 'utf8');
    res.setHeader('X-Santa-Page-Mode', 'dynamic-tracker');
    return res.status(route.status).end(publicPageHtml(template, render(raw)));
  }
  // Resolution above validates every successful pathname and handles aliases
  // before reading a file. Unknown/malformed requests receive the built 404.
  const pathname = route.status === 200 ? decodeURIComponent(path) : '/404';
  const file = new URL(`../dist/server/pages${pathname === '/' ? '' : pathname}/index.html`, import.meta.url);
  const html = await readFile(file, 'utf8');
  res.setHeader('X-Santa-Page-Mode', 'prerendered');
  return res.status(route.status).end(html);
}
