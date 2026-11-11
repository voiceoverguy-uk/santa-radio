import { archiveRecording } from './message-account-store.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { hasStudioAccess, workshopCatalogue, WORKSHOP_ROOT } from './santa-workshop-catalogue.js';
import { santaNameLibrary } from './santa-name-library.js';
import { consumeNameAccess, privateResponse, readNameJson } from './santa-name-security.js';
import { renderStudioMessage } from './santa-studio-render.js';
import { selectedWorkshopRegion } from '../src/lib/workshopDestinations.js';
import { studioServiceFailure } from './studio-service-events.js';
import { workshopSession } from './santa-workshop-access.js';
import { studioDeliveryProbe } from './studio-delivery-probe.js';
import { studioAllowanceIdentity, studioAllowanceStore } from './studio-creation-allowance.js';

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
  reportFailure = studioServiceFailure,
  allowanceIdentity = studioAllowanceIdentity, allowances = studioAllowanceStore,
  archive = archiveRecording,
} = {}) {
  let active = 0;
  return async (req, res) => {
    privateResponse(res);
    if (await studioDeliveryProbe(req, res)) return;
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
    let identity, reservation;
    let stage = 'access';
    const audioResponse = (audio, selection) => {
      if (selection) res.setHeader('X-Studio-Selection', Buffer.from(JSON.stringify({
        ...selection,
      })).toString('base64'));
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg', 'Content-Length': audio.length,
        'Content-Disposition': 'attachment; filename="Santa-studio-message.mp3"',
      });
      res.end(audio);
    };
    try {
      if (!await withinDeadline(() => authorize(req), controller.signal)) throw problem(403, 'Your Studio access needs checking. Please reopen Studio and try again.');
      stage = 'allowance_identity';
      identity = await withinDeadline(() => allowanceIdentity(req), controller.signal);
      let data;
      if (req.method === 'GET') {
        const recovering = new URL(req.url || '/', 'http://studio').searchParams.get('audio') === '1';
        if (recovering && (req.headers['sec-fetch-site'] === 'same-site'
          || (req.headers.origin && !sameStudioOrigin(req)))) {
          throw problem(403, 'Please retrieve your recording from Studio on this website.');
        }
        stage = 'status_limit';
        await withinDeadline(() => limit(req, 'studioRead'), controller.signal);
        if (recovering) throw problem(410, 'Recordings are not saved. Please create a new message and download it before leaving this page.');
        stage = 'status';
        const allowance = identity ? await withinDeadline(() => allowances.status(identity), controller.signal) : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ temporary: true,
          testerCanStartAnother: !!workshopSession(req) && (!identity || identity.expiresAt !== null),
          ...(allowance || {}) }));
      } else {
        stage = 'access';
        await withinDeadline(() => limit(req, 'studioMessage'), controller.signal);
        data = await withinDeadline(() => readNameJson(req), controller.signal);
      }
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
      stage = 'catalogue';
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
      if (selectedTalent) {
        const record = inventory.categories[talent.category]?.find(item => item.id === talent.id);
        if (!record) throw problem(400, 'That talent recording is no longer available. Please choose it again or skip this section.');
        selected.talent = record;
      }
      const recording = await withinDeadline(() => library.resolve(data.name), controller.signal);
      if (!recording || recording.id !== data.name) throw problem(400, 'That exact recorded name is no longer available. Please choose it again.');
      if (identity) {
        const operation = req.headers['idempotency-key'];
        if (typeof operation !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation)) {
          throw problem(400, 'Please start this creation using Studio.');
        }
        // Await the reservation itself, even past cancellation, so a late DB
        // result always has a known fence that finally can release.
        reservation = await allowances.reserve(identity, operation);
      }
      controller.signal.throwIfAborted();
      directory = await mkdtemp(join(tmpdir(), 'santa-studio-'));
      stage = 'source';
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
      stage = 'render';
      const { audio } = await render({ name, choices: paths, directory, signal: controller.signal });
      controller.signal.throwIfAborted();
      if (!audio?.length || audio.length > 4_400_000) throw new Error('Invalid rendered MP3.');
      // Success boundary: full MP3 prepared and response about to be sent.
      // Disconnects after this commit are inherently uncertain, not proof of
      // browser receipt. Never roll back a committed slot after a send error.
      const archiveId = await archive(req, audio, req.headers['idempotency-key'], recording.name || data.name, controller.signal);
      controller.signal.throwIfAborted();
      if (reservation) await allowances.succeed(identity, reservation);
      if (archiveId) res.setHeader('X-Studio-Archive', archiveId);
      controller.signal.throwIfAborted();
      audioResponse(audio, { record: {
        id: recording.id, name: recording.name || '', variant: recording.variant || '',
      }, choices: data });
    } catch (error) {
      if (!error.status || error.status >= 500) {
        try { reportFailure(error, stage); } catch { /* Diagnostics never affect access. */ }
      }
      if (error.status === 429) res.setHeader('Retry-After', String(error.retryAfter || 60));
      // Never send/log FFmpeg stderr, source paths, identities or upstream URLs.
      send(error.status || 503, error.status ? error.message
        : controller.signal.aborted ? 'Preparation was cancelled or took too long. Please try again.'
          : req.method === 'GET' ? 'The recording check failed. Please try again.'
          : 'A recording could not be loaded or mixed. Please try again.');
    } finally {
      clearTimeout(timer);
      req.removeListener?.('aborted', abort);
      res.removeListener?.('close', abort);
      controller.abort();
      if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
      if (reservation) await allowances.release(identity, reservation).catch(() => {});
      active--;
    }
  };
}
export default createStudioMessageHandler();
