import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { hasStudioAccess, workshopCatalogue, WORKSHOP_ROOT } from './santa-workshop-catalogue.js';
import { santaNameLibrary } from './santa-name-library.js';
import { consumeNameAccess, privateResponse, readNameJson } from './santa-name-security.js';
import { renderStudioMessage } from './santa-studio-render.js';
import { selectedWorkshopRegion } from '../src/lib/workshopDestinations.js';

const categories = ['age', 'activity', 'achievement', 'treat', 'place'];
const localNames = fileURLToPath(new URL('./santa-audio/names/', import.meta.url));
const problem = (status, message) => Object.assign(new Error(message), { status });

// Also bound operations (access DB, catalogue and incoming JSON) that do not
// themselves accept an AbortSignal. No rendering begins after their deadline.
async function withinDeadline(operation, signal) {
  signal.throwIfAborted();
  let abort;
  try {
    return await Promise.race([operation(), new Promise((_, reject) => {
      abort = () => reject(new Error('Preparation cancelled.'));
      signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}

export async function downloadStudioClip(url, destination, signal, fetcher = fetch) {
  const response = await fetcher(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    redirect: 'error', cache: 'no-store',
  });
  const maximum = 20 * 1024 * 1024;
  if (!response.ok || response.redirected || Number(response.headers.get('content-length')) > maximum) throw new Error('Recording unavailable.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Recording unavailable.');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) throw new Error('Recording too large.');
      chunks.push(Buffer.from(value));
    }
    if (!size) throw new Error('Empty recording.');
    await writeFile(destination, Buffer.concat(chunks), { flag: 'wx', mode: 0o600 });
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function sameStudioOrigin(req) {
  try {
    const protocol = req.headers['x-forwarded-proto']?.split(',')[0].trim()
      || (req.socket?.encrypted ? 'https' : 'http');
    return new URL(req.headers.origin).origin === `${protocol}://${req.headers.host}`
      && req.headers['sec-fetch-site'] !== 'cross-site';
  } catch { return false; }
}

export function createStudioMessageHandler({
  authorize = hasStudioAccess, limit = consumeNameAccess, catalogue = workshopCatalogue,
  library = santaNameLibrary, download = downloadStudioClip, render = renderStudioMessage,
  executionMs = 110000,
} = {}) {
  let active = 0;
  return async (req, res) => {
    privateResponse(res);
    const send = (status, error) => {
      if (res.destroyed || res.headersSent) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, 'Use Create message in Studio.'); }
    if (!sameStudioOrigin(req)) return send(403, 'Please open Studio on this website and try again.');
    if (active >= 2) { res.setHeader('Retry-After', '10'); return send(429, 'Santa is preparing other messages. Please retry in a moment.'); }
    active++;
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, executionMs);
    req.once?.('aborted', abort);
    res.once?.('close', abort);
    let directory;
    try {
      if (!await withinDeadline(() => authorize(req), controller.signal)) throw problem(403, 'Your Studio access needs checking. Please reopen Studio and try again.');
      await withinDeadline(() => limit(req, 'studioMessage'), controller.signal);
      const data = await withinDeadline(() => readNameJson(req), controller.signal);
      // A stable opaque recording ID is re-resolved privately under Studio
      // authorization. No expired browser capability, spelling or URL is used.
      if (![6, 7].includes(Object.keys(data).length) || Object.keys(data).some(key => !['name', ...categories, 'region'].includes(key))
        || ('region' in data && (typeof data.region !== 'string' || !/^c-[a-f0-9]{64}$/.test(data.region)))
        || typeof data.name !== 'string' || !/^(?:f-[a-f0-9]{64}|[a-z0-9][a-z0-9'-]{0,79})$/.test(data.name)
        || categories.some(key => typeof data[key] !== 'string' || !/^c-[a-f0-9]{64}$/.test(data[key]))) {
        throw problem(400, 'Please check all six Studio choices and try again.');
      }
      const inventory = await withinDeadline(catalogue, controller.signal);
      const selected = Object.fromEntries(categories.map(category => {
        const record = inventory.categories[category].find(item => item.id === data[category]);
        if (!record) throw problem(400, 'A recorded choice is no longer available. Please choose it again.');
        return [category, record];
      }));
      if (data.region) {
        const region = selectedWorkshopRegion(inventory, data.place, data.region);
        if (!region) throw problem(400, 'That county or state is no longer available for this country. Please choose it again.');
        selected.place = region;
      }
      const recording = await withinDeadline(() => library.resolve(data.name), controller.signal);
      if (!recording || recording.id !== data.name) throw problem(400, 'That exact recorded name is no longer available. Please choose it again.');
      controller.signal.throwIfAborted();
      directory = await mkdtemp(join(tmpdir(), 'santa-studio-'));
      let name = join(localNames, `${recording.id}.wav`);
      if (recording.source === 'hosted') {
        name = join(directory, 'name.wav');
        await library.download(recording, name, undefined, { signal: controller.signal });
      }
      const paths = {};
      // Sequential downloads bound memory and total in-flight upstream work.
      for (const category of categories) {
        controller.signal.throwIfAborted();
        const record = selected[category];
        const url = `${WORKSHOP_ROOT}${record.file.split('/').map(encodeURIComponent).join('/')}`;
        paths[category] = join(directory, `${category}.${record.file.split('.').at(-1).toLowerCase()}`);
        await download(url, paths[category], controller.signal);
      }
      const { audio } = await render({ name, choices: paths, directory, signal: controller.signal });
      controller.signal.throwIfAborted();
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg', 'Content-Length': audio.length,
        'Content-Disposition': 'attachment; filename="santa-studio-message.mp3"',
      });
      res.end(audio);
    } catch (error) {
      if (error.status === 429) res.setHeader('Retry-After', String(error.retryAfter || 60));
      // Never send/log FFmpeg stderr, source paths, identities or upstream URLs.
      send(error.status || 503, error.status ? error.message
        : controller.signal.aborted ? 'Preparation was cancelled or took too long. Please try again.'
          : 'A recording could not be loaded or mixed. Please try again.');
    } finally {
      clearTimeout(timer);
      req.removeListener?.('aborted', abort);
      res.removeListener?.('close', abort);
      controller.abort();
      if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
      active--;
    }
  };
}
export default createStudioMessageHandler();
