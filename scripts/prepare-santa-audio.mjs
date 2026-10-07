// Prepare ONLY shared source clips, never a name or a completed greeting.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { voiceFilter } from './santa-audio-filters.mjs';
const source = new URL('../server/santa-audio/', import.meta.url);
const prepared = new URL('prepared/', source);
mkdirSync(prepared, { recursive: true });
for (const [input, output, preserveOpening] of [
  ['free-intro.wav', 'intro.wav', false], ['free-outro.wav', 'outro.wav', true],
]) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-loglevel', 'error',
    '-y', '-threads', '1', '-filter_threads', '1',
    '-i', fileURLToPath(new URL(input, source)), '-af', voiceFilter(preserveOpening),
    '-c:a', 'pcm_f32le', '-ar', '48000', '-map_metadata', '-1',
    fileURLToPath(new URL(output, prepared)),
  ], { timeout: 60000, stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.error || result.status !== 0) {
    // Do not expose input metadata, filenames or recordings in build logs.
    throw new Error('Shared Santa audio preparation failed.');
  }
}
console.log('[santa-audio] shared source clips prepared (lossless float PCM)');
