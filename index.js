import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import radioMetadata from './server/radio-metadata.js';
import santaMessage from './server/santa-message.js';
import { trackerPageHtml, isTrackerPreview } from './server/tracker-html.js';

const root = await realpath(fileURLToPath(new URL('./dist', import.meta.url)));
const index = resolve(root, 'index.html');
await stat(index); // Fail clearly if the required production build is missing.
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.pdf': 'application/pdf',
};

const server = createServer(async (req, res) => {
  try {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://server').pathname); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    if (pathname === '/api/radio-metadata') return await radioMetadata(req, res);
    if (pathname === '/api/santa-message') return await santaMessage(req, res);
    if (pathname.startsWith('/api/')) { res.writeHead(404).end('Not found'); return; }
    if (pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(404).end('Not found'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
    }
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    let info;
    try {
      file = await realpath(file);
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      info = await stat(file);
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
    if (!info?.isFile()) {
      if (extname(pathname)) { res.writeHead(404).end('Not found'); return; }
      file = index;
      info = await stat(index);
    }
    if (isTrackerPreview(pathname)) res.setHeader('X-Robots-Tag', 'noindex, follow');
    if (file === index && /^\/santa-tracker(?:\/preview)?\/?$/.test(pathname)) {
      const html = trackerPageHtml(await readFile(index, 'utf8'), pathname);
      res.writeHead(200, {
        'Content-Type': types['.html'], 'Content-Length': Buffer.byteLength(html),
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': file.startsWith(resolve(root, 'assets') + sep)
        ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    console.error('Request failed:', error.message);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Unable to serve this request');
  }
});

const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || 5000);
server.listen(port, '0.0.0.0', () => console.log(`Santa Radio production server listening on port ${port}`));
process.on('SIGTERM', () => server.close());
