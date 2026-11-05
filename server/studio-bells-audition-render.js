// Fixed, non-personalised development control. No catalogue, access service,
// customer allowance, remote recordings or generated-output archive.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { prepareStudioClip, studioMixArgs, studioSources, studioBells } from './santa-studio-render.js';

const execute = promisify(execFile);

export async function renderStudioBellsAudition() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Development audition unavailable.');
  const directory = await mkdtemp(join(tmpdir(), 'studio-bells-audition-'));
  try {
    const voice = join(directory, 'speech.f32'), output = join(directory, 'message.mp3');
    // The complete fixed closing passage needs no name or category choices.
    // Use the actual Studio preparation and mixer without padding or reverb.
    await prepareStudioClip(join(studioSources, '6th.flac'), voice);
    await execute(ffmpeg, ['-hide_banner', '-nostdin', '-threads', '1', '-filter_threads', '1',
      ...studioMixArgs(voice, studioBells, output)],
    { timeout: 20000, killSignal: 'SIGKILL', maxBuffer: 65536 });
    return await readFile(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
