// Read-only hosted-asset smoke check. Known direct URLs below are evidence only,
// never substitute catalogue choices in the application or request validation.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
import { workshopCatalogue, WORKSHOP_ROOT } from '../server/santa-workshop-catalogue.js';
import { downloadStudioClip } from '../server/santa-studio-message.js';
import { renderStudioMessage } from '../server/santa-studio-render.js';

const root = 'generated-artifacts/talent';
await mkdir(root, { recursive: true });
const inventory = await workshopCatalogue();
const report = {
  evidence: 'Generated and decoded, NOT listened to. No external hosting modified.',
  discovery: Object.fromEntries(['sports', 'funny'].map(key => [key, inventory.counts[key]])),
  outputs: [],
};
for (const [category, file] of [
  ['sports', 'sports/tennis.wav'],
  ['funny', 'funny/stealing the remote control.wav'],
  ['skip', null],
]) {
  const directory = await mkdtemp(join(tmpdir(), 'studio-talent-check-'));
  const signal = AbortSignal.timeout(110000);
  try {
    const choices = {};
    for (const key of ['age', 'activity', 'achievement', 'treat', 'place']) {
      const record = key === 'age'
        ? inventory.categories[key].find(item => item.number === 9 && item.unit === 'year')
        : key === 'place' ? inventory.categories[key].find(item => item.label === 'England')
          : inventory.categories[key][0];
      if (!record) throw new Error(`No real hosted ${key} recording.`);
      choices[key] = join(directory, `${key}.${record.file.split('.').at(-1)}`);
      await downloadStudioClip(`${WORKSHOP_ROOT}${record.file.split('/').map(encodeURIComponent).join('/')}`,
        choices[key], signal);
    }
    if (file) {
      choices.talent = join(directory, 'talent.wav');
      await downloadStudioClip(`${WORKSHOP_ROOT}${file.split('/').map(encodeURIComponent).join('/')}`,
        choices.talent, signal);
    }
    const { audio, frames, order } = await renderStudioMessage({
      name: resolve('server/santa-audio/names/arabella.wav'), choices, directory, signal,
    });
    const output = `${root}/real-${category}.mp3`;
    await writeFile(output, audio);
    execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-'], { timeout: 20000 });
    report.outputs.push({ category, source: file, seconds: frames / 48000, bytes: audio.length,
      positions: order.length, sha256: createHash('sha256').update(audio).digest('hex') });
  } finally { await rm(directory, { recursive: true, force: true }); }
}
await writeFile(`${root}/hosted-check.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
