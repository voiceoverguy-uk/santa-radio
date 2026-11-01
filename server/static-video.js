import { createReadStream } from 'node:fs';

// Keep byte-range support in the plain Node production server as well as the
// Vite/Vercel static hosts. Safari requests ranges when loading inline MP4s.
export function serveStaticVideo(req, res, file, info) {
  const headers = {
    'Content-Type': 'video/mp4',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Cache-Control': /-v\d+\.mp4$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
    return;
  }
  let start = 0, end = info.size - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    let valid = !!match && !!(match[1] || match[2]);
    if (valid) {
      if (!match[1]) {
        const suffix = Number(match[2]);
        valid = Number.isSafeInteger(suffix) && suffix > 0;
        start = Math.max(0, info.size - suffix);
      } else {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), end) : end;
        valid = Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end;
      }
      valid = valid && start < info.size;
    }
    if (!valid) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}`, 'Content-Length': 0 }).end();
      return;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }
  res.writeHead(status, { ...headers, 'Content-Length': end - start + 1 });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
