// Read-only inputs; write a private, owner-readable report, not a public listing.
import { readFile, writeFile } from 'node:fs/promises';
import { parseNameIndex } from '../server/santa-name-library.js';

export function directoryReport(diagnostic, inventory) {
  const reasons = ['symlink', 'directory', 'not_regular_file', 'unreadable', 'non_audio_extension',
    'malformed_utf8', 'unsupported_filename', 'included'];
  if (!diagnostic || diagnostic.version !== 1 || !Array.isArray(diagnostic.audio_entries) ||
      !Number.isSafeInteger(diagnostic.directory_entries) || diagnostic.directory_entries < 0 ||
      !diagnostic.counts || Object.entries(diagnostic.counts).some(([reason, count]) =>
        !reasons.includes(reason) || !Number.isSafeInteger(count) || count < 0) ||
      Object.values(diagnostic.counts).reduce((sum, count) => sum + count, 0) !== diagnostic.directory_entries) {
    throw new Error('Invalid diagnostic counts. Use the replacement PHP --diagnose output.');
  }
  const seen = new Set();
  const lines = diagnostic.audio_entries.map(entry => {
    if (!entry || !reasons.includes(entry.reason) || typeof entry.has_spaces !== 'boolean' ||
        typeof entry.legacy_included !== 'boolean' || typeof entry.filename_base64 !== 'string' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.filename_base64) ||
        (entry.file !== null && typeof entry.file !== 'string') || seen.has(entry.filename_base64)) {
      throw new Error('Invalid or duplicate audio diagnostic entry.');
    }
    seen.add(entry.filename_base64);
    const bytes = Buffer.from(entry.filename_base64, 'base64');
    if (entry.file !== null && !bytes.equals(Buffer.from(entry.file, 'utf8'))) throw new Error('Filename bytes do not match.');
    return { ...entry, label: entry.file === null ? `[non-UTF-8 bytes, base64=${entry.filename_base64}]` : JSON.stringify(entry.file) };
  });
  const counts = new Map();
  for (const entry of lines) counts.set(entry.reason, (counts.get(entry.reason) || 0) + 1);
  for (const reason of reasons) {
    if ((counts.get(reason) || 0) > (diagnostic.counts[reason] || 0)) throw new Error('Audio reasons exceed directory counts.');
  }
  if ((counts.get('included') || 0) !== (diagnostic.counts.included || 0)) throw new Error('Included audio entries are missing.');
  const listed = new Set(inventory.map(record => record.file));
  const observed = new Set(lines.filter(entry => entry.file !== null).map(entry => entry.file));
  const omitted = lines.filter(entry => !listed.has(entry.file));
  const render = entries => entries.length ? entries.map(entry => `${entry.label}\t${entry.reason}`).join('\n') : '(none)';
  return [
    'SANTA NAME DIRECTORY RECONCILIATION', `Generated: ${new Date().toISOString()}`,
    'Evidence: owner-run diagnostic and separately supplied inventory. Capture both at the same time.',
    'Counts describe directory entries, not decoded/verified recordings. No files are changed.',
    `Directory entries (excluding . and ..): ${diagnostic.directory_entries}`,
    `Inventoried recordings: ${inventory.length}`, `Audio-extension entries in diagnostic: ${lines.length}`,
    '\nMutually exclusive directory reasons (in precedence order):',
    ...reasons.map(reason => `${reason}: ${diagnostic.counts[reason] || 0}`),
    '\nAudio filenames containing ordinary spaces:', render(lines.filter(entry => entry.has_spaces)),
    '\nAudio-extension entries excluded by replacement PHP:', render(lines.filter(entry => entry.reason !== 'included')),
    '\nAudio-extension entries absent from supplied inventory:',
    ...(omitted.length ? omitted.map(entry => `${entry.label}\t${entry.reason !== 'included' ? entry.reason :
      !entry.legacy_included ? 'accepted by replacement; rejected by legacy filename filter' :
        'accepted by both filename filters; absence unexplained (check capture times/script version)'}`) : ['(none)']),
    '\nInventory filenames absent from directory diagnostic:',
    ...inventory.filter(record => !observed.has(record.file)).map(record => JSON.stringify(record.file)),
    '\nDo not infer that an omitted entry is corrupt or non-audio. Only decoding can establish its audio content.',
    '',
  ].join('\n');
}

if (process.argv[1]?.endsWith('/report-santa-directory.mjs')) {
  const [, , diagnosticPath, inventoryPath, outputPath] = process.argv;
  if (!diagnosticPath || !inventoryPath || !outputPath) throw new Error('Usage: node scripts/report-santa-directory.mjs diagnostic.json inventory.json private-report.txt');
  const diagnosticBytes = await readFile(diagnosticPath);
  if (diagnosticBytes.length > 16 * 1024 * 1024) throw new Error('Diagnostic exceeds 16 MiB.');
  const diagnostic = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(diagnosticBytes));
  const report = directoryReport(diagnostic, parseNameIndex(await readFile(inventoryPath)));
  await writeFile(outputPath, report, { flag: 'wx', mode: 0o600 });
  console.log('Private report written; existing files were not overwritten.');
}
