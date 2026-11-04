import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { snapshotUrl, validateSnapshot } from '../server/names-demo/snapshot.js';

const defaultRoot = new URL('../server/names-demo/', import.meta.url);
async function atomicWrite(url, bytes) {
  const temporary = new URL(`${url.href}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o644 });
    await rename(temporary, url);
  } finally { await rm(temporary, { force: true }); }
}

// Preparation only: no database, audio, credentials, origin requests or runtime writes.
export async function prepareNamesDemo({ data, root = defaultRoot } = {}) {
  data ??= JSON.parse(await readFile(snapshotUrl, 'utf8'));
  const names = validateSnapshot(data).slice().sort();
  const json = Buffer.from(JSON.stringify(names) + '\n');
  const hash = createHash('sha256').update(json).digest('hex');
  const filename = `names-${hash}.json`;
  const brotli = brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
  const gzip = gzipSync(json, { level: 9 });
  await mkdir(new URL('./assets/', root), { recursive: true });
  for (const [suffix, bytes] of [['', json], ['.br', brotli], ['.gz', gzip]]) {
    await atomicWrite(new URL(`./assets/${filename}${suffix}`, root), bytes);
  }
  // Publish the pointer last: failed preparation never points at partial output.
  // Retain prior hashed assets for still-open pages and already-cached URLs.
  await atomicWrite(new URL('./asset-manifest.json', root), JSON.stringify({ filename }) + '\n');
  return { names: names.length, filename, jsonBytes: json.length,
    brotliBytes: brotli.length, gzipBytes: gzip.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log('[names-demo]', JSON.stringify(await prepareNamesDemo())); }
  catch {
    console.error('[names-demo] Preparation failed; last published asset pointer unchanged.');
    process.exitCode = 1;
  }
}
