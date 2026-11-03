// Development audition only. Never imported by either message generator.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ffmpeg from 'ffmpeg-static';
import { prepareStudioClip, studioMixArgs, studioSources, studioBells } from './santa-studio-render.js';

const execute = promisify(execFile);
const rate = 48000;
export const auditionTailSeconds = 1.2;

// Dense, deterministic, stereo small-room impulse, not discrete delayed copies.
// 12 ms pre-delay, 0.55 s RT60, and no dry impulse. Only the wet return is filtered.
export function warmRoomImpulse() {
  const frames = Math.round(rate * 0.72);
  const impulse = Buffer.alloc(frames * 8);
  let seed = 686;
  for (let channel = 0; channel < 2; channel++) {
    let energy = 0;
    for (let frame = Math.round(rate * 0.012); frame < frames; frame++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const time = frame / rate - 0.012;
      const sample = (seed / 2147483648 - 1) * Math.exp(-Math.log(1000) * time / 0.55);
      impulse.writeFloatLE(sample, frame * 8 + channel * 4);
      energy += sample * sample;
    }
    const scale = 1 / Math.sqrt(energy);
    for (let frame = 0; frame < frames; frame++) {
      const offset = frame * 8 + channel * 4;
      impulse.writeFloatLE(impulse.readFloatLE(offset) * scale, offset);
    }
  }
  return impulse;
}

export const auditionReverbGraph =
  '[0:a]asplit=2[dry][send];' +
  '[send][1:a]afir=gtype=none:irgain=1:dry=1:wet=1:minp=256:maxp=256,' +
  'highpass=f=180,lowpass=f=4500,volume=0.12[room];' +
  '[dry][room]amix=inputs=2:duration=first:normalize=0[out]';

export async function renderStudioAudition() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Development audition unavailable.');
  const directory = await mkdtemp(join(tmpdir(), 'studio-audition-'));
  const run = args => execute(ffmpeg, ['-hide_banner', '-nostdin', '-threads', '1',
    '-filter_threads', '1', ...args], { timeout: 20000, maxBuffer: 65536 });
  try {
    const prepared = join(directory, 'prepared.f32');
    // This fixed closing passage contains no chosen name or category recording.
    // Do not load the name library, catalogue, access service or remote sources.
    const { seconds } = await prepareStudioClip(join(studioSources, '6th.flac'), prepared);
    const dry = join(directory, 'dry.f32');
    await writeFile(dry, Buffer.concat([await readFile(prepared),
      Buffer.alloc(Math.round(rate * auditionTailSeconds) * 8)]), { mode: 0o600, flag: 'wx' });
    const impulse = join(directory, 'room.f32');
    await writeFile(impulse, warmRoomImpulse(), { mode: 0o600, flag: 'wx' });
    const wet = join(directory, 'wet.f32');
    await run(['-v', 'error', '-filter_complex_threads', '1',
      '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', dry,
      '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', impulse,
      '-filter_complex', auditionReverbGraph, '-map', '[out]',
      '-c:a', 'pcm_f32le', '-f', 'f32le', '-n', wet]);
    const samples = {};
    for (const [label, voice] of [['original', dry], ['reverb', wet]]) {
      const output = join(directory, `${label}.mp3`);
      // Exact shared Studio bell bed, gain, fade and limiter. No effect on bells.
      await run(studioMixArgs(voice, studioBells, output));
      samples[label] = await readFile(output);
    }
    return { samples, seconds: seconds + auditionTailSeconds };
  } finally {
    // Only the two fixed, non-personalised MP3 buffers survive in dev memory.
    await rm(directory, { recursive: true, force: true });
  }
}
