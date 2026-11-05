import { randomBytes } from 'node:crypto';
import { createSantaMessageHandler } from './santa-message.js';

export const freeBellsAuditionPath = '/preview/free-message-bells';
export const studioBellsAuditionPath = '/preview/studio-message-bells';

// Fixed local control only. This is not wired to the public message API and
// cannot accept visitor names, bypass their allowances, or publish a greeting.
export async function renderFreeBellsAudition() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Development audition unavailable.');
  const record = { id: 'arabella', name: 'Arabella', source: 'local' };
  const handler = createSantaMessageHandler({ resolve: async () => record }, null, {
    limit: async () => {}, authorize: async () => ({ subject: 'fixed-development-audition' }),
    verify: () => record.id, reserve: async () => ({}), finish: async () => {},
  });
  let status;
  let audio;
  await handler({
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: { name: record.id, selectionToken: 'fixed-development-control', outro: 1 },
  }, {
    setHeader() {},
    writeHead(code) { status = code; },
    end(body) { audio = body; },
  });
  if (status !== 200 || !Buffer.isBuffer(audio)) throw new Error('Controlled audition failed.');
  return audio;
}

// Vite development only. No files, archives, production routes or remote reads.
// A single in-memory example expires after one hour, or on server restart.
export function createFreeBellsAudition({ development = false, studio = false,
  render = studio
    ? async () => (await import('./studio-bells-audition-render.js')).renderStudioBellsAudition()
    : renderFreeBellsAudition, lifetimeMs = 60 * 60 * 1000 } = {}) {
  const auditionPath = studio ? studioBellsAuditionPath : freeBellsAuditionPath;
  const title = studio ? 'Studio message bells audition' : 'Free message bells audition';
  const token = randomBytes(24).toString('hex');
  const audioPath = `${auditionPath}/${token}/${studio ? 'closing-passage' : 'arabella'}.mp3`;
  let pending, expired = false, timer;
  return async (req, res, next) => {
    const path = new URL(req.url, 'http://audition').pathname;
    if (path !== auditionPath && !path.startsWith(`${auditionPath}/`)) return next();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (code, type, body) => {
      res.writeHead(code, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!development || process.env.NODE_ENV !== 'development') return send(404, 'text/plain', 'Audition unavailable.');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, 'text/plain', 'Use the playback control.');
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'text/plain', 'Open this page in Preview.');
    if (path === auditionPath) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev");
      return send(200, 'text/html; charset=utf-8', `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>${title}</title>
<style>:root{color-scheme:dark;font:17px/1.6 system-ui;background:#102620;color:#faf6ea}
body{max-width:660px;margin:40px auto;padding:22px}h1{line-height:1.2}audio{width:100%}
.note{color:#d5dcd6}strong{color:#e6c67b}</style></head><body><main>
<p><strong>Development preview only</strong></p><h1>${title}</h1>
<p>Bells now receive 6 dB after loudness control — 2 dB above the previous website mix, before peak protection.</p>
<p id="label">${studio ? 'Fixed closing passage — real Studio voice preparation and mixer, without personalisation or reverb.' : 'Arabella — real free-message pipeline, with the current seasonal ending.'}</p>
<audio controls preload="none" aria-labelledby="label" src="${audioPath}"></audio>
<p>${studio ? 'Listen for the one-second bells lead-in, bells through Santa’s pauses and the existing Studio ending fade. This excerpt uses no customer allowance.' : 'Listen for the one-second bells fade-in before the complete voice recordings, continuous bells through Santa’s pauses, and the one-second bells-only fade-out after the full ending.'}</p>
<p class="note">Automated timing, repeat and peak checks are not human listening approval.
Press Play to prepare this one controlled example. It may take a few seconds.
The temporary audio expires one hour after preparation, or when Preview restarts.</p>
<p class="note">Both website mixes are updated; iPhone audio is unchanged. Previously generated MP3s are unchanged;
recreate a message to use the new mix. No permanent greeting archive is created.</p>
<p><a style="color:#e6c67b" href="${studio ? freeBellsAuditionPath : studioBellsAuditionPath}">${studio ? 'Free message' : 'Studio message'} bells audition</a></p>
</main></body></html>`);
    }
    if (path !== audioPath) return send(404, 'text/plain', 'Audition unavailable.');
    if (expired) return send(410, 'text/plain', 'This temporary audition has expired. Restart Preview to prepare a new one.');
    try {
      pending ||= render().then(audio => {
        timer = setTimeout(() => { expired = true; pending = undefined; }, lifetimeMs);
        timer.unref();
        return audio;
      }).catch(error => { pending = undefined; throw error; });
      const audio = await pending;
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
      return send(503, 'text/plain', 'The audition could not be prepared. Refresh and try again.');
    }
  };
}
