import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSantaMessage } from '../src/data/santaMessages.js';

const execute = promisify(execFile);
const sources = fileURLToPath(new URL('./santa-audio/', import.meta.url));
const renderer = fileURLToPath(new URL('../scripts/render-santa-message.mjs', import.meta.url));
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
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1024) return fail(413, 'Request is too large.');
    }
    let data;
    try { data = JSON.parse(body); } catch { return fail(400, 'Invalid request.'); }
    const recording = findSantaMessage(data?.name);
    if (!recording) return fail(400, 'That name is not available yet. Choose a suggested name.');
    directory = await mkdtemp(join(tmpdir(), 'santa-message-'));
    const output = join(directory, 'message.mp3');
    await execute(process.execPath, [renderer,
      join(sources, 'free-intro.wav'), join(sources, 'names', `${recording.id}.wav`),
      join(sources, 'free-outro.wav'), join(sources, 'sleighbells.mp3'), output,
    ], { timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
    const audio = await readFile(output);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Content-Disposition': `attachment; filename="${recording.downloadName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(audio);
  } catch {
    if (!res.headersSent && !res.destroyed) fail(503, 'The message could not be mixed. Please try again.');
  } finally {
    active--;
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
