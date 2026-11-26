import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blobDadLibrary } from '../server/blob-dad-library.js';

async function prepareDadFixedAudio() {
  const library = await blobDadLibrary.load();
  if (!library) return 0;
  const { catalogue, records, release } = library;
  if (catalogue.fixed?.length !== 7) throw new Error('Incomplete Dad script');
  const directory = fileURLToPath(new URL('../server/dad-fixed-audio/', import.meta.url));
  await mkdir(directory, { recursive: true });
  const staging = await mkdtemp(join(directory, 'build-'));
  const signal = AbortSignal.timeout(45_000);
  try {
    const files = new Map(catalogue.fixed.map(file => [records.get(file).sha256, file]));
    for (const [hash, file] of files) {
      await blobDadLibrary.download(file, join(staging, `${hash}.flac`), release, signal);
    }
    for (const hash of files.keys()) {
      const filename = `${hash}.flac`;
      await rename(join(staging, filename), join(directory, filename));
    }
    return files.size;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

try {
  const count = await prepareDadFixedAudio();
  console.log(count ? `Dad Studio: bundled ${count} fixed Santa clips.`
    : 'Dad Studio: no private catalogue at build time. Fixed clips will be fetched when needed.');
} catch {
  console.warn('Dad Studio: fixed clips could not be bundled. Fixed clips will be fetched when needed.');
}
