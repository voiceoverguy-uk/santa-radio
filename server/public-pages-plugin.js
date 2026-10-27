import { readFile, stat } from 'node:fs/promises';
import { publicPageHtml, sitemap, robots } from './public-html.js';
import { resolvePublicRequest } from '../src/seo/routes.js';
import { thumbnailFile } from './mug-thumbnails.js';
export default function publicPagesPlugin() {
  return {
    name: 'public-pages-ssr',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url, 'http://server').pathname;
        if (path.startsWith('/mugshot-thumbnails/')) {
          try {
            const file = await thumbnailFile(path);
            if (!file) { res.writeHead(404); return res.end(); }
            const body = await readFile(file);
            res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': body.length, 'Cache-Control': 'public, max-age=3600' });
            return res.end(req.method === 'HEAD' ? undefined : body);
          } catch (error) { return next(error); }
        }
        if (/^\/(?:images|artist-artwork|mugshot-images)\//.test(path)) {
          try { await stat(`public${decodeURIComponent(path)}`); }
          catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
        }
        if (!['GET', 'HEAD'].includes(req.method) || path.startsWith('/api/') || path.startsWith('/@') || path.startsWith('/src/') || path.startsWith('/node_modules/') || /\.[a-z0-9]+$/i.test(path) && !['/robots.txt', '/sitemap.xml'].includes(path)) return next();
        try {
          if (path === '/robots.txt' || path === '/sitemap.xml') {
            const body = path === '/robots.txt' ? robots() : sitemap();
            res.writeHead(200, { 'Content-Type': path === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8' });
            return res.end(req.method === 'HEAD' ? undefined : body);
          }
          const route = resolvePublicRequest(req.url);
          if (route.location) { res.writeHead(route.status, { Location: route.location }); return res.end(); }
          const { render } = await server.ssrLoadModule('/src/entry-server.jsx');
          const result = render(req.url);
          const template = await server.transformIndexHtml(req.url, await readFile('index.html', 'utf8'));
          if (result.noindex || result.status !== 200) res.setHeader('X-Robots-Tag', 'noindex, follow');
          res.writeHead(result.status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': path === '/santa-message-workshop' ? 'private, no-store' : 'no-cache' });
          res.end(req.method === 'HEAD' ? undefined : publicPageHtml(template, result));
        } catch (error) { server.ssrFixStacktrace(error); next(error); }
      });
    },
  };
}
