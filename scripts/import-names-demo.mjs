import { writeFile, rename, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createNameLibrary } from '../server/santa-name-library.js';
import { snapshotUrl, validateSnapshot } from '../server/names-demo/snapshot.js';
import { santaNameKey } from '../src/lib/santaNameSearch.js';

// CLI only. Never imported by the demo request handler or build.
export async function updateDemoSnapshot({
  acquire = () => createNameLibrary().catalogue(), destination = snapshotUrl,
} = {}) {
  const records = await acquire(); // Existing authorised PHP source and strict parser.
  const unique = new Map();
  for (const record of records) {
    const name = record.name.normalize('NFC').trim();
    const key = santaNameKey(name);
    if (!unique.has(key)) unique.set(key, name);
  }
  const data = { version: 1, importedAt: new Date().toISOString(),
    names: [...unique.values()].sort((a, b) => a.localeCompare(b, 'en-GB')) };
  validateSnapshot(data);
  const temporary = new URL(`./snapshot-${process.pid}.tmp`, destination);
  try {
    await writeFile(temporary, JSON.stringify(data) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
  return { sourceRecords: records.length, savedNames: data.names.length,
    duplicatesRemoved: records.length - data.names.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).join(' ') !== '--confirm-update') {
    console.error('Owner operation only: node scripts/import-names-demo.mjs --confirm-update');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await updateDemoSnapshot())); }
    catch (error) {
      console.error(`Name import failed (${error.code || 'VALIDATION_OR_WRITE_FAILED'}); prior snapshot unchanged.`);
      process.exitCode = 1;
    }
  }
}
