import { get } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const digest = data => createHash('sha256').update(data).digest('hex');
export const WORKSHOP_POINTER = 'workshop-library/active.json';
export function createBlobWorkshopLibrary({ storage = { get }, env = process.env, now = Date.now } = {}) {
  let cached, expires = 0, pending;
  async function bytes(path, maximum, signal) {
    const response = await storage.get(path, { access: 'private', useCache: false,
      abortSignal: signal || AbortSignal.timeout(30000) });
    if (!response) return null;
    if (response.statusCode !== 200) throw Error('Private workshop unavailable');
    const chunks = []; let size = 0;
    for await (const chunk of response.stream) {
      size += chunk.length;
      if (size > maximum) throw Error('Workshop object exceeds size limit');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  async function load() {
    if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) return null;
    if (now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const rawPointer = await bytes(WORKSHOP_POINTER, 4096);
      if (!rawPointer) { cached = null; expires = now() + 60000; return null; }
      const pointer = JSON.parse(rawPointer);
      if (![pointer.release, pointer.sha256].every(s => /^[a-f0-9]{64}$/.test(s))) throw Error('Invalid workshop pointer');
      const raw = await bytes(`workshop-library/releases/${pointer.release}/manifest.json`, 4 * 1024 * 1024);
      if (!raw || digest(raw) !== pointer.sha256) throw Error('Workshop manifest checksum mismatch');
      const manifest = JSON.parse(raw);
      if (manifest.version !== 1 || manifest.release !== pointer.release || !Array.isArray(manifest.records)
        || !manifest.records.length || manifest.records.length > 5000) throw Error('Invalid workshop manifest');
      const records = new Map();
      for (const row of manifest.records) {
        if (typeof row.file !== 'string' || row.file.includes('..') || /[\\\x00-\x1f]/.test(row.file)
          || records.has(row.file) || !/^[a-f0-9]{64}$/.test(row.sha256)
          || !Number.isSafeInteger(row.size) || row.size < 42 || row.size > 50 * 1024 * 1024
          || row.path !== `workshop-library/releases/${pointer.release}/audio/${row.sha256}.flac`) throw Error('Invalid workshop recording');
        records.set(row.file, row);
      }
      if (!manifest.catalogue?.categories) throw Error('Missing workshop catalogue');
      for (const rows of Object.values(manifest.catalogue.categories)) {
        if (!Array.isArray(rows) || rows.some(row => !records.has(row.file))) throw Error('Incomplete workshop catalogue');
      }
      cached = { release: manifest.release, catalogue: manifest.catalogue, records };
      expires = now() + 60000;
      return cached;
    })().finally(() => { pending = null; });
    return pending;
  }
  async function download(file, destination, release, signal) {
    const library = await load();
    const record = library?.records.get(file);
    if (!record || library.release !== release) throw Error('Workshop selection changed; reload choices');
    const data = await bytes(record.path, record.size, signal);
    if (!data || data.length !== record.size || digest(data) !== record.sha256) throw Error('Workshop audio checksum mismatch');
    await writeFile(destination, data, { flag: 'wx', mode: 0o600 });
  }
  return { load, download };
}
export const blobWorkshopLibrary = createBlobWorkshopLibrary();
