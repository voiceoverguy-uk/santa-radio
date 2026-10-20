import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directoryReport } from './report-santa-directory.mjs';

test('private report distinguishes actual directory reasons, spaces and unexplained omissions', () => {
  const entry = (file, reason = 'included', legacy_included = false) => ({
    file, reason, legacy_included, has_spaces: file.includes(' '),
    filename_base64: Buffer.from(file).toString('base64'),
  });
  const evidence = { version: 1, directory_entries: 6,
    counts: { included: 3, symlink: 1, unsupported_filename: 1, non_audio_extension: 1 },
    audio_entries: [entry('Mary Jane.mp3'), entry('Seán.mp3'), entry('Alice.mp3', 'included', true),
      entry('link.mp3', 'symlink'), entry('.bad.mp3', 'unsupported_filename')] };
  const report = directoryReport(evidence, [{ file: 'Seán.mp3' }]);
  assert.match(report, /"Mary Jane.mp3"\taccepted by replacement; rejected by legacy filename filter/);
  assert.match(report, /"Alice.mp3"\taccepted by both filename filters; absence unexplained/);
  assert.match(report, /"link.mp3"\tsymlink/);
  assert.match(report, /non_audio_extension: 1/);
  assert.throws(() => directoryReport({ ...evidence, directory_entries: 7 }, []));
  assert.throws(() => directoryReport({ ...evidence, audio_entries: [...evidence.audio_entries, evidence.audio_entries[0]] }, []));
});
