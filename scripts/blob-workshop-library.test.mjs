import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBlobWorkshopLibrary, WORKSHOP_POINTER } from '../server/blob-workshop-library.js';

const hash = data => createHash('sha256').update(data).digest('hex');
function fixture(change = x => x) {
  const audio = Buffer.alloc(100, 7), release = 'a'.repeat(64);
  const path = `workshop-library/releases/${release}/audio/${hash(audio)}.flac`;
  const manifest = { version: 1, release, catalogue: { categories: { age: [{ file: 'AGES/5-years.wav' }] } },
    records: [{ file: 'AGES/5-years.wav', sha256: hash(audio), size: audio.length, path }] };
  change(manifest);
  const raw = Buffer.from(JSON.stringify(manifest));
  const objects = new Map([[WORKSHOP_POINTER, Buffer.from(JSON.stringify({ release, sha256: hash(raw) }))],
    [`workshop-library/releases/${release}/manifest.json`, raw], [path, audio]]);
  const calls = [];
  const library = createBlobWorkshopLibrary({ env: { BLOB_STORE_ID: 'test' }, storage: {
    get: async (p, options) => { calls.push(p); assert.equal(options.access, 'private');
      return objects.has(p) ? { statusCode: 200, stream: [objects.get(p)] } : null; },
  } });
  return { library, objects, calls, path, audio, release };
}
test('private catalogue and FLAC bytes are checksum verified without exposing storage records in catalogue', async () => {
  const f = fixture(), directory = await mkdtemp(join(tmpdir(), 'workshop-'));
  try {
    const loaded = await f.library.load();
    assert.equal(loaded.release, f.release);
    assert.equal(JSON.stringify(loaded.catalogue).includes('workshop-library'), false);
    await f.library.download('AGES/5-years.wav', join(directory, 'age.flac'), f.release);
    assert.deepEqual(await readFile(join(directory, 'age.flac')), f.audio);
    await assert.rejects(f.library.download('../secret', join(directory, 'bad'), f.release));
    await assert.rejects(f.library.download('AGES/5-years.wav', join(directory, 'bad'), 'b'.repeat(64)));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('corrupt manifests, foreign paths, and missing choices fail closed', async () => {
  const f = fixture(); f.objects.set(`workshop-library/releases/${f.release}/manifest.json`, Buffer.from('{}'));
  await assert.rejects(f.library.load(), /checksum/);
  await assert.rejects(fixture(m => { m.records[0].path = 'name-library/active.json'; }).library.load(), /Invalid workshop recording/);
  await assert.rejects(fixture(m => { m.catalogue.categories.age.push({ file: 'missing.wav' }); }).library.load(), /Incomplete/);
});
test('tampered audio fails before any destination is written', async () => {
  const f = fixture(); f.objects.set(f.path, Buffer.alloc(100, 8));
  await assert.rejects(f.library.download('AGES/5-years.wav', '/unused', f.release), /checksum/);
});
test('an absent pointer allows the explicitly retained legacy migration fallback', async () => {
  const f = fixture(); f.objects.delete(WORKSHOP_POINTER);
  assert.equal(await f.library.load(), null);
});
