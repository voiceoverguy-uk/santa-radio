import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { santaNameLibrary } from './santa-name-library.js';
import { santaMessageDownloadName } from '../src/lib/santaMessageDownloadName.js';
import { renderArgs } from '../scripts/santa-audio-filters.mjs';
import { eligibleArabella } from './santa-saved-cache.js';
import { consumeNameAccess, privateResponse, verifyNameToken } from './santa-name-security.js';
import { authorizeFreeMessage, reserveFreeMessage, finishFreeMessage } from './santa-message-access.js';
import { resolveFreeEnding } from './santa-free-ending.js';

const execute = promisify(execFile);
const sources = fileURLToPath(new URL('./santa-audio/', import.meta.url));
let active = 0;

// The previous default cache publishes permanent public MP3 URLs. Keep that
// publisher disconnected until the origin offers private cache storage.
export function createSantaMessageHandler(library = santaNameLibrary, cache = null, {
  limit = consumeNameAccess, verify = verifyNameToken,
  authorize = authorizeFreeMessage, reserve = reserveFreeMessage, finish = finishFreeMessage,
  now = () => new Date(),
  render = renderArgs, bells = join(sources, 'sleighbells.mp3'),
} = {}) {
return async function santaMessage(req, res) {
  privateResponse(res);
  const fail = (status, error) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error }));
  };
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(405, 'Use Create message to request a recording.');
  }
  if (!req.headers['content-type']?.startsWith('application/json')) return fail(415, 'Expected JSON.');
  if (active >= 2) return fail(429, 'Santa is preparing other messages. Please try again in a moment.');
  active++;
  let directory;
  let lease;
  let allowanceFinished = false;
  const started = performance.now();
  let renderMs;
  try {
    await limit(req, 'message');
    const session = await authorize(req);
    // Vercel parses JSON before calling the function; the local Node server
    // supplies a readable stream instead. Support both without rereading it.
    let body = req.body;
    if (body === undefined) {
      body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 1024) return fail(413, 'Request is too large.');
      }
    }
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    else if (body !== null && typeof body === 'object') body = JSON.stringify(body);
    if (typeof body !== 'string') return fail(400, 'Invalid request.');
    if (Buffer.byteLength(body) > 1024) return fail(413, 'Request is too large.');
    let data;
    try { data = JSON.parse(body); } catch { return fail(400, 'Invalid request.'); }
    if (data?.outro !== 1 && data?.outro !== 2) return fail(400, 'Invalid outro selection.');
    if (!data?.name || verify(data.selectionToken, 'message') !== data.name) {
      return fail(403, 'Please search and choose the recorded name again before creating a message.');
    }
    const recording = await library.resolve(data?.name);
    if (!recording) return fail(400, 'That name is not available yet. Choose a suggested name.');
    lease = await reserve(session);
    // Resolve once at generation time, not module load or browser-page load.
    const outro = resolveFreeEnding(data.outro, now());
    let prepared;
    if (cache && eligibleArabella(recording)) {
      try { prepared = await cache.prepare(recording, library, outro); }
      catch { console.info('[santa-cache]', { event: 'prepare', code: 'REVISION_UNAVAILABLE' }); }
    }
    const generate = async () => {
      directory = await mkdtemp(join(tmpdir(), 'santa-message-'));
      const output = join(directory, 'message.mp3');
      let nameClip = join(sources, 'names', `${recording.id}.wav`);
      if (recording.source === 'hosted') {
        nameClip = join(directory, 'name.wav');
        await library.download(recording, nameClip, prepared?.sourceBytes);
      }
      const renderStarted = performance.now();
      // Execute the audio worker directly. Timing out a Node wrapper leaves its
      // synchronous FFmpeg child alive, competing with subsequent requests.
      await execute(ffmpegPath, render(
        join(sources, 'prepared', 'intro.wav'), nameClip,
        join(sources, 'prepared', `outro-${outro}.wav`), bells, output, true,
      ), { timeout: 90000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 });
      renderMs = Math.round(performance.now() - renderStarted);
      const audio = await readFile(output);
      if (prepared && performance.now() - started < 95000) await cache.publish(prepared, audio);
      return audio;
    };
    const audio = cache && eligibleArabella(recording)
      ? await cache.singleFlight(prepared?.identity.key || `${recording.id}-${outro}`, generate) : await generate();
    const downloadName = santaMessageDownloadName(recording.name);
    const asciiFilename = downloadName.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]/g, '_');
    await finish(lease, true);
    allowanceFinished = true;
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(downloadName).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(audio);
    console.info('[santa-message] complete', {
      renderMs, totalMs: Math.round(performance.now() - started), bytes: audio.length,
    });
  } catch (error) {
    if (error.status === 429) {
      res.setHeader('Retry-After', String(error.retryAfter || 60));
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: error.message, availableAt: error.availableAt || 0 }));
    }
    if (error.status === 401 || error.status === 403) return fail(error.status, error.message);
    // Log operational codes only, never submitted names or contact details.
    console.error('[santa-message] rendering failed', {
      code: typeof error.code === 'number' ? error.code : ['ENOENT', 'EACCES', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(error.code) ? error.code : 'RENDER_FAILED',
      signal: error.signal === 'SIGKILL' ? 'SIGKILL' : null,
      totalMs: Math.round(performance.now() - started),
    });
    if (!res.headersSent && !res.destroyed) fail(503, error.code?.startsWith?.('INDEX') ?
      'The hosted name list is unavailable. Please refresh the names and try again.' :
      'The recording could not be loaded or mixed. Please try again.');
  } finally {
    active--;
    if (lease && !allowanceFinished) await finish(lease, false).catch(() => {});
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
};
}

export default createSantaMessageHandler();
