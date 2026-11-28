import { validOwnerToken } from './studio-owner-handler.js';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { videoAssets } from './santa-video-assets.js';

const chunkSize = 2 * 1024 * 1024;

export default async function santaVideos(req, res, { development = false } = {}) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const requestUrl = new URL(req.url, 'http://localhost');
  if (requestUrl.pathname === '/santa-videos' || requestUrl.pathname === '/santa-videos/') {
    res.writeHead(307, { Location: '/santa-dashboard#video-stitcher' });
    return res.end();
  }
  if (!validOwnerToken(req)) {
    res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(req.method === 'HEAD' ? undefined : 'Open the video stitcher from your unlocked Dashboard.');
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  try {
    const asset = new URL(req.url, 'http://localhost').searchParams.get('asset');
    if (asset === 'choices') {
      const [{ workshopCatalogue }, { planningCatalogue }] = await Promise.all([
        import('./santa-workshop-catalogue.js'), import('./santa-videos-planning.js'),
      ]);
      const catalogue = planningCatalogue(await workshopCatalogue());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(catalogue));
    }
    if (asset === 'source' || asset === 'bells') {
      const { filename, path, type, size } = videoAssets[asset];
      const file = new URL(`./santa-videos/${filename}`, import.meta.url);
      const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
      if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'Content-Length': size }); return res.end(); }
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || `bytes=0-${chunkSize - 1}`);
      const start = range ? Number(range[1]) : -1;
      const requestedEnd = range?.[2] ? Number(range[2]) : size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); return res.end();
      }
      const end = Math.min(requestedEnd, start + chunkSize - 1, size - 1);
      let stream;
      if (development) {
        const local = await stat(file);
        if (local.size !== size) throw Error('Video source size mismatch');
        stream = createReadStream(file, { start, end });
      } else {
        const { get } = await import('@vercel/blob');
        const blob = await get(path, { access: 'private', headers: { Range: `bytes=${start}-${end}` }, abortSignal: AbortSignal.timeout(30000) });
        if (!blob?.stream || blob.headers.get('content-range') !== `bytes ${start}-${end}/${size}`) {
          await blob?.stream?.cancel();
          throw Error('Video asset range unavailable');
        }
        stream = Readable.fromWeb(blob.stream);
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy());
      stream.pipe(res); return;
    }
    if (asset) { res.writeHead(404); return res.end('Not found'); }
    const html = (await readFile(new URL('./santa-videos/page.html', import.meta.url), 'utf8'))
      .replace('__SCRIPT_URL__', development ? '/src/santa-videos/client.js' : '/assets/santa-videos.js?v=planning-1');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch {
    if (res.headersSent) return res.destroy();
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('The video stitcher is temporarily unavailable. Please try again.');
  }
}

export function santaVideosMiddleware(options = {}) {
  return (req, res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/santa-videos' || pathname === '/santa-videos/' || pathname === '/api/santa-videos') return santaVideos(req, res, options);
    next();
  };
}
