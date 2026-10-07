// Usage: node scripts/render-santa-message.mjs intro.wav name.wav outro.wav bells.mp3 output.mp3
// Render offline: no names or child details are sent to a third-party service.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const inputs = process.argv.slice(2);
if (inputs.length !== 5) {
  console.error('Expected intro.wav name.wav outro.wav bells.mp3 output.mp3');
  process.exit(1);
}
const [intro, name, outro, bells, output] = inputs;
mkdirSync(dirname(output), { recursive: true });
// The outro's opening padding is an intentional editorial pause.
const voice = preserveOpening => 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
  (preserveOpening ? '' : 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,') +
  'areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,areverse,' +
  'loudnorm=I=-18:TP=-2:LRA=11,aresample=48000,' +
  'afade=t=in:d=0.005,areverse,afade=t=in:d=0.005,areverse,apad=pad_dur=0.10';
const filter = [0, 1, 2].map(i => `[${i}:a]${voice(i === 2)}[v${i}]`).join(';') +
  ';[v0][v1][v2]concat=n=3:v=0:a=1[speech];' +
  '[3:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
  'loudnorm=I=-34:TP=-9:LRA=7,aresample=48000,afade=t=in:d=1[bells];' +
  '[speech][bells]amix=inputs=2:duration=first:normalize=0,' +
  'areverse,afade=t=in:d=1,areverse,alimiter=limit=0.89:level=false[out]';
const result = spawnSync('ffmpeg', [
  '-hide_banner', '-y', '-i', intro, '-i', name, '-i', outro,
  '-stream_loop', '-1', '-i', bells, '-filter_complex', filter,
  '-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100',
  '-map_metadata', '-1', output,
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
