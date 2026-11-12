import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { createBlobWorkshopLibrary, WORKSHOP_POINTER } from '../server/blob-workshop-library.js';

const [directory, mode] = process.argv.slice(2);
if (!directory || !['--copy', '--activate'].includes(mode)) throw Error('Usage: copy-workshop-to-blob.mjs report-directory --copy|--activate');
const raw = await readFile(join(directory, 'manifest.json'));
const manifest = JSON.parse(raw);
const hash = data => createHash('sha256').update(data).digest('hex');
const path = `workshop-library/releases/${manifest.release}/manifest.json`;
const pointer = Buffer.from(JSON.stringify({ release: manifest.release, sha256: hash(raw) }));
const privatePut = (path, bytes, type) => put(path, bytes, { access: 'private', addRandomSuffix: false,
  allowOverwrite: true, contentType: type, abortSignal: AbortSignal.timeout(60000) });
async function read(path) {
  const r = await get(path, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(60000) });
  if (!r) return null;
  if (r.statusCode !== 200) throw Error('Blob read failed');
  const chunks = []; let size = 0;
  for await (const chunk of r.stream) { size += chunk.length; if (size > 50 * 1024 * 1024) throw Error('Blob too large'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
// Validate the complete proposed manifest using the same loader as production.
await createBlobWorkshopLibrary({ env: { BLOB_STORE_ID: 'validation' }, storage: {
  get: async p => ({ statusCode: 200, stream: [p === WORKSHOP_POINTER ? pointer : raw] }),
} }).load();
let next = 0, verified = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < manifest.records.length) {
    const row = manifest.records[next++];
    const data = await readFile(join(directory, 'flac', row.local));
    if (data.length !== row.size || hash(data) !== row.sha256) throw Error('Local checksum mismatch');
    let copied = await read(row.path);
    if (!copied && mode === '--copy') {
      await privatePut(row.path, data, 'audio/flac');
      copied = await read(row.path);
    }
    if (!copied || copied.length !== row.size || hash(copied) !== row.sha256) throw Error('Blob checksum mismatch');
    verified++;
    if (verified % 100 === 0) console.log(JSON.stringify({ verified, total: manifest.records.length }));
  }
}));
if (mode === '--copy') await privatePut(path, raw, 'application/json');
const savedManifest = await read(path);
if (!savedManifest || hash(savedManifest) !== hash(raw)) throw Error('Manifest verification failed');
if (mode === '--activate') {
  const previous = await read(WORKSHOP_POINTER);
  await writeFile(join(directory, 'previous-pointer.json'), previous || 'null', { flag: 'wx' });
  await privatePut(WORKSHOP_POINTER, pointer, 'application/json');
  if (!(await read(WORKSHOP_POINTER))?.equals(pointer)) throw Error('Pointer verification failed');
}
await writeFile(join(directory, mode === '--copy' ? 'copy-verification.json' : 'activation.json'),
  JSON.stringify({ release: manifest.release, verified, at: new Date().toISOString(), activated: mode === '--activate' }, null, 2));
console.log(JSON.stringify({ verified, activated: mode === '--activate' }));
