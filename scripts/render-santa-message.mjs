// Usage: node scripts/render-santa-message.mjs intro.wav name.wav outro.wav bells.mp3 output.mp3 [ffmpeg-binary]
// Render offline: no names or child details are sent to a third-party service.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { renderArgs } from './santa-audio-filters.mjs';

const inputs = process.argv.slice(2);
if (inputs.length !== 5 && inputs.length !== 6) {
  console.error('Expected intro.wav name.wav outro.wav bells.mp3 output.mp3 [ffmpeg-binary]');
  process.exit(1);
}
const [intro, name, outro, bells, output, ffmpegBinary = 'ffmpeg'] = inputs;
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync(ffmpegBinary, renderArgs(intro, name, outro, bells, output),
  { timeout: 90000, killSignal: 'SIGKILL', stdio: ['ignore', 'ignore', 'pipe'] });
if (result.error || result.status !== 0) console.error('Santa rendering failed.');
process.exit(result.status ?? 1);
