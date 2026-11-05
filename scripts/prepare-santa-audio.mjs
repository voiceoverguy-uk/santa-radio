// Prepare ONLY shared source clips, never a name or a completed greeting.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { voiceFilter } from './santa-audio-filters.mjs';
const source = new URL('../server/santa-audio/', import.meta.url);
const prepared = new URL('prepared/', source);
mkdirSync(prepared, { recursive: true });
// Build, Preview and validation may prepare these shared clips concurrently.
// Readers must see a complete old or new WAV, never a partially written one.
const temporary = mkdtempSync(fileURLToPath(new URL('.prepare-', prepared)));
try {
for (const [input, output] of [
  ['free-intro.mp3', 'intro.wav'],
  ['free-outro-1.mp3', 'outro-1.wav'],
  ['free-outro-2.mp3', 'outro-2.wav'],
  ['free-outro-nov.mp3', 'outro-nov.wav'],
]) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-loglevel', 'error',
    '-y', '-threads', '1', '-filter_threads', '1',
    '-i', fileURLToPath(new URL(input, source)), '-af', voiceFilter(),
    '-c:a', 'pcm_f32le', '-ar', '48000', '-map_metadata', '-1',
    join(temporary, output),
  ], { timeout: 60000, stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.error || result.status !== 0) {
    // Do not expose input metadata, filenames or recordings in build logs.
    throw new Error('Shared Santa audio preparation failed.');
  }
  renameSync(join(temporary, output), fileURLToPath(new URL(output, prepared)));
}
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log('[santa-audio] shared source clips prepared (lossless float PCM)');
