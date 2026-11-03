import { randomBytes, createHash } from 'node:crypto';

export const auditionPath = '/preview/studio-voice-reverb';
const controls = `document.querySelectorAll('audio').forEach(audio => {
  audio.addEventListener('play', () => document.querySelectorAll('audio').forEach(other => {
    if (other !== audio) other.pause();
  }));
  audio.addEventListener('error', () => {
    document.getElementById('status').textContent = 'The audition could not be loaded. Refresh this preview and try again.';
  });
});`;

function page(token) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>Studio voice reverb audition</title>
<style>
:root{color-scheme:dark;font:17px/1.6 system-ui,sans-serif;background:#102620;color:#faf6ea}
body{max-width:660px;margin:0 auto;padding:40px 22px}h1{line-height:1.2;font-size:2rem}
.preview{color:#e6c67b;font-size:.8rem;text-transform:uppercase;letter-spacing:.12em}
section{border:1px solid #b99e5a;border-radius:12px;padding:18px 22px;margin:24px 0}
h2{font-size:1.2rem;margin:0 0 8px}p{margin:8px 0 18px}audio{display:block;width:100%}
.note{color:#d5dcd6;font-size:.9rem}a{color:#e6c67b}
</style></head><body><main>
<div class="preview">Development preview only</div><h1>Studio voice reverb audition</h1>
<p>The same short Santa passage and sleigh bells in both versions. Only Santa’s voice receives the room effect.</p>
<section><h2 id="original-label">Original</h2><p class="note">Current Studio voice preparation and bell balance.</p>
<audio controls preload="none" aria-labelledby="original-label" src="${auditionPath}/${token}/original.mp3"></audio></section>
<section><h2 id="reverb-label">Subtle reverb</h2><p class="note">A quiet, warm room around the voice. Bells stay unchanged.</p>
<audio controls preload="none" aria-labelledby="reverb-label" src="${auditionPath}/${token}/reverb.mp3"></audio></section>
<p id="status" role="status" class="note">Press Play to compare. The first play may take a few seconds to prepare. Playing one version pauses the other.</p>
<p class="note">Use the same device volume for both. Neither version plays automatically.
This is not a personalised message. No changes have been applied to the real Studio or free message maker.</p>
</main><script>${controls}</script></body></html>`;
}

// Explicit opt-in by Vite configureServer only; preview/build/production fail closed.
export function createAuditionMiddleware({ development = false, render } = {}) {
  const token = randomBytes(24).toString('hex');
  let pending;
  return async (req, res, next) => {
    const pathname = new URL(req.url, 'http://audition').pathname;
    if (pathname !== auditionPath && !pathname.startsWith(`${auditionPath}/`)) return next();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (status, type, body) => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!development || process.env.NODE_ENV !== 'development') {
      return send(404, 'text/plain', 'Audition unavailable.');
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, 'text/plain', 'Use the audition playback controls.');
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'text/plain', 'Open the audition in Preview.');
    if (pathname === auditionPath || pathname === `${auditionPath}/`) {
      const hash = createHash('sha256').update(controls).digest('base64');
      res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${hash}'; media-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev`);
      return send(200, 'text/html; charset=utf-8', page(token));
    }
    const variant = ['original', 'reverb'].find(label => pathname === `${auditionPath}/${token}/${label}.mp3`);
    if (!variant) return send(404, 'text/plain', 'Audition unavailable.');
    try {
      // Single flight; bounded fixed pair in process memory, never a message archive.
      pending ||= (async () => {
        const renderer = render || (await import('./studio-reverb-audition-render.js')).renderStudioAudition;
        return renderer();
      })().catch(error => { pending = undefined; throw error; });
      const { samples } = await pending;
      const audio = samples[variant];
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start = match?.[1] ? Number(match[1]) : 0;
        let end = match?.[2] ? Number(match[2]) : audio.length - 1;
        if (match && !match[1] && match[2]) {
          start = Math.max(0, audio.length - Number(match[2]));
          end = audio.length - 1;
        }
        if (!match || (!match[1] && !match[2]) || start > end || start >= audio.length) {
          res.setHeader('Content-Range', `bytes */${audio.length}`);
          return send(416, 'text/plain', 'Requested range unavailable.');
        }
        end = Math.min(end, audio.length - 1);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${audio.length}`);
        return send(206, 'audio/mpeg', audio.subarray(start, end + 1));
      }
      return send(200, 'audio/mpeg', audio);
    } catch {
      // Do not disclose FFmpeg output, filesystem locations or source metadata.
      return send(503, 'text/plain', 'Audition preparation failed. Please refresh and try again.');
    }
  };
}
