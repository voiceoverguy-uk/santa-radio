import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { findSantaMessage } from '../src/data/santaMessages.js';
import { renderArgs } from '../scripts/santa-audio-filters.mjs';

const execute = promisify(execFile);
const sources = fileURLToPath(new URL('./santa-audio/', import.meta.url));
let active = 0;

export default async function santaMessage(req, res) {
  res.setHeader('Cache-Control', 'no-store');
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
  const started = performance.now();
  let renderMs;
  try {
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
    const recording = findSantaMessage(data?.name);
    if (!recording) return fail(400, 'That name is not available yet. Choose a suggested name.');
    directory = await mkdtemp(join(tmpdir(), 'santa-message-'));
    const output = join(directory, 'message.mp3');
    const renderStarted = performance.now();
    // Execute the audio worker directly. Timing out a Node wrapper leaves its
    // synchronous FFmpeg child alive, competing with subsequent requests.
    await execute(ffmpegPath, renderArgs(
      join(sources, 'prepared', 'intro.wav'), join(sources, 'names', `${recording.id}.wav`),
      join(sources, 'prepared', 'outro.wav'), join(sources, 'sleighbells.mp3'), output, true,
    ), { timeout: 90000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 });
    renderMs = Math.round(performance.now() - renderStarted);
    const audio = await readFile(output);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Content-Disposition': `attachment; filename="${recording.downloadName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(audio);
    console.info('[santa-message] complete', {
      renderMs, totalMs: Math.round(performance.now() - started), bytes: audio.length,
    });
  } catch (error) {
    // Log operational codes only, never submitted names or contact details.
    console.error('[santa-message] rendering failed', {
      code: typeof error.code === 'number' ? error.code : ['ENOENT', 'EACCES', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(error.code) ? error.code : 'RENDER_FAILED',
      signal: error.signal === 'SIGKILL' ? 'SIGKILL' : null,
      totalMs: Math.round(performance.now() - started),
    });
    if (!res.headersSent && !res.destroyed) fail(503, 'The message could not be mixed. Please try again.');
  } finally {
    active--;
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
