import { writeFile } from 'node:fs/promises';
import { findSantaMessage, santaNames } from '../src/data/santaMessages.js';

export const NAMES_ROOT = 'https://stagcommunications.com/santaradio/names/';
export const NAMES_INDEX = `${NAMES_ROOT}names-index.php`;
const CACHE_MS = 60_000;
const FAIL_CACHE_MS = 10_000;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_WAV_BYTES = 10 * 1024 * 1024;
const ID = /^[a-z0-9][a-z0-9'-]{0,79}$/;
const FILE = /^[a-zA-Z0-9][a-zA-Z0-9'_-]{0,79}\.wav$/i;
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} '-]{0,79}$/u;
const key = input => input.normalize('NFKC').trim().toLocaleLowerCase('en-GB');
export const localRecords = santaNames.map(name => ({ ...findSantaMessage(name), source: 'local' }));

export class NameLibraryError extends Error {
  constructor(code) { super('Hosted name library unavailable'); this.code = code; }
}

// Do not follow redirects: even an approved URL must not redirect to another host.
export async function fetchLimited(url, limit, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, { redirect: 'error', signal: controller.signal });
    if (!response.ok || response.redirected) throw new NameLibraryError('UPSTREAM_STATUS');
    if (Number(response.headers.get('content-length')) > limit) throw new NameLibraryError('UPSTREAM_SIZE');
    const reader = response.body?.getReader();
    if (!reader) throw new NameLibraryError('UPSTREAM_EMPTY');
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) { await reader.cancel(); throw new NameLibraryError('UPSTREAM_SIZE'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof NameLibraryError) throw error;
    throw new NameLibraryError('UPSTREAM_FETCH');
  } finally { clearTimeout(timeout); }
}

export function parseNameIndex(bytes) {
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { throw new NameLibraryError('INDEX_JSON'); }
  if (data?.version !== 1 || !Array.isArray(data.names) || data.names.length > 20_000) throw new NameLibraryError('INDEX_FORMAT');
  const seen = new Set();
  return data.names.map(item => {
    if (!item || typeof item.id !== 'string' || !ID.test(item.id) ||
      typeof item.file !== 'string' || !FILE.test(item.file) ||
      item.file.slice(0, -4).toLowerCase().replace(/_/g, '-') !== item.id ||
      typeof item.name !== 'string' || !NAME.test(item.name) ||
      (item.aliases !== undefined && (!Array.isArray(item.aliases) || item.aliases.length > 12 ||
        item.aliases.some(alias => typeof alias !== 'string' || !NAME.test(alias)))) ||
      seen.has(item.id)) throw new NameLibraryError('INDEX_ENTRY');
    seen.add(item.id);
    return { id: item.id, name: item.name, file: item.file, aliases: item.aliases || [],
      source: 'hosted', downloadName: `Santa-message-for-${item.name}.mp3` };
  });
}

export function createNameLibrary({ fetcher = fetch, now = Date.now } = {}) {
  let cached;
  let expires = 0;
  let failedUntil = 0;
  let pending;
  const catalogue = async () => {
    if (cached && now() < expires) return cached;
    if (now() < failedUntil) throw new NameLibraryError('INDEX_UNAVAILABLE');
    if (!pending) pending = (async () => {
      try {
        cached = parseNameIndex(await fetchLimited(NAMES_INDEX, MAX_INDEX_BYTES, fetcher));
        expires = now() + CACHE_MS;
        return cached;
      } catch (error) {
        failedUntil = now() + FAIL_CACHE_MS;
        throw error;
      } finally { pending = null; }
    })();
    return pending;
  };
  return {
    catalogue,
    async search(input) {
      let hosted = [];
      let warning = null;
      try { hosted = await catalogue(); }
      catch { warning = 'The hosted name list is unavailable. Only existing recordings are shown. Please try refreshing the names shortly.'; }
      const records = new Map(localRecords.map(record => [record.id, record]));
      for (const record of hosted) records.set(record.id, record);
      const prefix = key(input);
      const matches = prefix ? [...records.values()].filter(record =>
        [record.name, record.id, ...(record.aliases || [])].some(name => key(name).startsWith(prefix))) : [];
      return { records: matches.sort((a, b) => a.name.localeCompare(b.name, 'en-GB')).slice(0, 20)
        .map(({ id, name, downloadName }) => ({ id, name, downloadName })), warning };
    },
    async resolve(input) {
      if (typeof input !== 'string' || !ID.test(input)) return null;
      // Prefer hosted recordings where present; local recordings remain usable
      // on inventory failure, with the search warning explicitly shown to visitors.
      try {
        return (await catalogue()).find(record => record.id === input) || findSantaMessage(input);
      } catch (error) {
        const local = findSantaMessage(input);
        if (local) return local;
        throw error;
      }
    },
    async download(record, destination) {
      if (record.source !== 'hosted' || !FILE.test(record.file)) throw new NameLibraryError('INVALID_RECORDING');
      const url = new URL(encodeURIComponent(record.file), NAMES_ROOT);
      const bytes = await fetchLimited(url.href, MAX_WAV_BYTES, fetcher);
      validateNameWav(bytes);
      await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
    },
  };
}

// Bound duration and accept only ordinary PCM/float WAVs before invoking FFmpeg.
export function validateNameWav(bytes) {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new NameLibraryError('INVALID_WAV');
  let rate = 0, blockAlign = 0, sampleRate = 0, totalAudio = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const label = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new NameLibraryError('INVALID_WAV');
    if (label === 'fmt ') {
      if (size < 16) throw new NameLibraryError('INVALID_WAV');
      const format = bytes.readUInt16LE(start), channels = bytes.readUInt16LE(start + 2);
      const bits = bytes.readUInt16LE(start + 14);
      sampleRate = bytes.readUInt32LE(start + 4);
      rate = bytes.readUInt32LE(start + 8);
      blockAlign = bytes.readUInt16LE(start + 12);
      if (![1, 3].includes(format) || ![1, 2].includes(channels) ||
        !(format === 1 ? [8, 16, 24, 32] : [32, 64]).includes(bits) ||
        sampleRate < 8000 || sampleRate > 192000 || blockAlign !== channels * bits / 8 ||
        rate !== sampleRate * blockAlign) throw new NameLibraryError('INVALID_WAV');
    }
    if (label === 'data') totalAudio += size;
    offset = start + size + size % 2;
  }
  if (!rate || !totalAudio || totalAudio % blockAlign !== 0 ||
    totalAudio / rate > 30 || totalAudio / rate < 0.05) throw new NameLibraryError('INVALID_WAV');
}

export const santaNameLibrary = createNameLibrary();
