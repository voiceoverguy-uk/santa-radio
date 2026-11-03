import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { hasStudioAccess, workshopCatalogue, WORKSHOP_ROOT } from './santa-workshop-catalogue.js';
import { santaNameLibrary } from './santa-name-library.js';
import { consumeNameAccess, privateResponse, readNameJson } from './santa-name-security.js';
import { renderStudioMessage } from './santa-studio-render.js';
import { selectedWorkshopRegion, workshopDestinationCategory } from '../src/lib/workshopDestinations.js';
import { studioGenerationStore, studioGenerationKey, studioIdentity } from './santa-studio-generation.js';
import { workshopSession } from './santa-workshop-access.js';

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
  generations = studioGenerationStore, accessKey = studioGenerationKey,
} = {}) {
  let active = 0;
  return async (req, res) => {
    privateResponse(res);
    const send = (status, error) => {
      if (res.destroyed || res.headersSent) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error }));
    };
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, 'Use Create message in Studio.'); }
    if ((req.method === 'POST' && !sameStudioOrigin(req)) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'Please open Studio on this website and try again.');
    if (active >= 2) { res.setHeader('Retry-After', '10'); return send(429, 'Santa is preparing other messages. Please retry in a moment.'); }
    active++;
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, executionMs);
    req.once?.('aborted', abort);
    res.once?.('close', abort);
    let directory;
    let key, reservation;
    const audioResponse = (audio, sequence) => {
      if (sequence) res.setHeader('X-Studio-Generation', String(sequence));
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg', 'Content-Length': audio.length,
        'Content-Disposition': 'attachment; filename="santa-studio-message.mp3"',
      });
      res.end(audio);
    };
    try {
      if (!await withinDeadline(() => authorize(req), controller.signal)) throw problem(403, 'Your Studio access needs checking. Please reopen Studio and try again.');
      key = await accessKey(req);
      if (req.method === 'GET') {
        await withinDeadline(() => limit(req, 'studioRead'), controller.signal);
        if (new URL(req.url || '/', 'http://studio').searchParams.get('audio') === '1') {
          const audio = await withinDeadline(() => generations.audio(key), controller.signal);
          if (!audio) throw problem(404, 'No completed recording is available yet.');
          return audioResponse(audio);
        }
        const status = await withinDeadline(() => generations.status(key), controller.signal);
        const recording = status.locked && await withinDeadline(() => library.resolve(status.locked.name), controller.signal);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ...status, testerCanStartAnother: !!workshopSession(req), record: recording
          ? { id: recording.id, name: recording.name, variant: recording.variant || '' } : null }));
      }
      await withinDeadline(() => limit(req, 'studioMessage'), controller.signal);
      const operation = req.headers['idempotency-key'];
      if (typeof operation !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(operation)) {
        throw problem(400, 'Please confirm your choices using Create message in Studio.');
      }
      const data = await withinDeadline(() => readNameJson(req), controller.signal);
      // A stable opaque recording ID is re-resolved privately under Studio
      // authorization. No expired browser capability, spelling or URL is used.
      const talent = data.talent;
      const talentObject = talent && typeof talent === 'object' && !Array.isArray(talent);
      const skipTalent = talentObject && Object.keys(talent).length === 1 && talent.skip === true;
      const selectedTalent = talentObject && Object.keys(talent).length === 2
        && ['sports', 'funny'].includes(talent.category)
        && typeof talent.id === 'string' && /^c-[a-f0-9]{64}$/.test(talent.id);
      if (![7, 8].includes(Object.keys(data).length) || Object.keys(data).some(key => !['name', 'talent', ...categories, 'region'].includes(key))
        || ('region' in data && (typeof data.region !== 'string' || !/^c-[a-f0-9]{64}$/.test(data.region)))
        || typeof data.name !== 'string' || !/^(?:f-[a-f0-9]{64}|[a-z0-9][a-z0-9'-]{0,79})$/.test(data.name)
        || categories.some(key => typeof data[key] !== 'string' || !/^c-[a-f0-9]{64}$/.test(data[key]))
        || (!skipTalent && !selectedTalent)) {
        throw problem(400, 'Please check all seven Studio choices, including choosing or skipping Talent, and try again.');
      }
      const inventory = await withinDeadline(catalogue, controller.signal);
      const selected = Object.fromEntries(categories.map(category => {
        const record = inventory.categories[category].find(item => item.id === data[category]);
        if (!record) throw problem(400, 'A recorded choice is no longer available. Please choose it again.');
        return [category, record];
      }));
      const identity = studioIdentity(data, workshopDestinationCategory(selected.place));
      if (data.region) {
        const region = selectedWorkshopRegion(inventory, data.place, data.region);
        if (!region) throw problem(400, 'That county or state is no longer available for this country. Please choose it again.');
        selected.place = region;
      }
      if (selectedTalent) {
        const record = inventory.categories[talent.category]?.find(item => item.id === talent.id);
        if (!record) throw problem(400, 'That talent recording is no longer available. Please choose it again or skip this section.');
        selected.talent = record;
      }
      const recording = await withinDeadline(() => library.resolve(data.name), controller.signal);
      if (!recording || recording.id !== data.name) throw problem(400, 'That exact recorded name is no longer available. Please choose it again.');
      controller.signal.throwIfAborted();
      const reserved = await withinDeadline(() => generations.reserve(key, operation, data, identity), controller.signal);
      if (reserved.audio) return audioResponse(reserved.audio, reserved.sequence);
      reservation = reserved.reservation;
      controller.signal.throwIfAborted();
      directory = await mkdtemp(join(tmpdir(), 'santa-studio-'));
      let name = join(localNames, `${recording.id}.wav`);
      if (recording.source === 'hosted') {
        name = join(directory, 'name.wav');
        await library.download(recording, name, undefined, { signal: controller.signal });
      }
      const paths = {};
      // Sequential downloads bound memory and total in-flight upstream work.
      for (const category of [...categories, ...(selectedTalent ? ['talent'] : [])]) {
        controller.signal.throwIfAborted();
        const record = selected[category];
        const url = `${WORKSHOP_ROOT}${record.file.split('/').map(encodeURIComponent).join('/')}`;
        paths[category] = join(directory, `${category}.${record.file.split('.').at(-1).toLowerCase()}`);
        await download(url, paths[category], controller.signal);
      }
      const { audio } = await render({ name, choices: paths, directory, signal: controller.signal });
      controller.signal.throwIfAborted();
      // Commit the retrievable MP3 and allowance together. A lost response can
      // be recovered by GET without spending the visitor's correction.
      const sequence = await generations.succeed(key, reservation, data, identity, audio);
      audioResponse(audio, sequence);
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
      if (reservation) await generations.release(key, reservation).catch(() => {});
      if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
      active--;
    }
  };
}
export default createStudioMessageHandler();
