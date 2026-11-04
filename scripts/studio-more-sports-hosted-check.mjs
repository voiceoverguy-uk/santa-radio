// Read-only real-asset check. No catalogue, recording or external service writes.
// Outputs are private, ignored evidence, not recordings retained by the product.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import assert from 'node:assert/strict';
import { workshopCatalogue, WORKSHOP_ROOT } from '../server/santa-workshop-catalogue.js';
import { moreSportsFiles } from '../server/workshop-more-sports.js';
import { downloadStudioClip } from '../server/santa-studio-message.js';
import { renderStudioMessage, STUDIO_LEAD_IN_SECONDS } from '../server/santa-studio-render.js';

const root = 'generated-artifacts/more-sports';
await mkdir(root, { recursive: true });
const inventory = await workshopCatalogue();
const activities = inventory.categories.activity;
const report = {
  evidence: 'Downloaded, decoded and rendered. NOT listened to. No external service modified.',
  activityCount: activities.length,
  approvedAvailable: activities.filter(item => item.activityGroup === 'more-sports').length,
  unavailable: [...moreSportsFiles].filter(file => !activities.some(item => item.file === file)),
  outputs: [],
};
for (const [kind, activityFile] of [
  ['sports', 'Trying Hard at/Swimming.mp3'],
  ['sports', 'Trying Hard at/Farting.mp3'],
  ['funny', 'Trying Hard at/art.wav'],
  ['funny', 'Trying Hard at/Tennis.mp3'],
  ['skip', 'Trying Hard at/Tennis.mp3'],
  ['skip', 'Trying Hard at/art.wav'],
]) {
  const directory = await mkdtemp(join(tmpdir(), 'studio-more-sports-check-'));
  const signal = AbortSignal.timeout(110000);
  try {
    const choices = {}, selected = {};
    for (const key of ['age', 'activity', 'achievement', 'treat', 'place']) {
      const record = key === 'age' ? inventory.categories.age.find(item => item.number === 9 && item.unit === 'year')
        : key === 'activity' ? activities.find(item => item.file === activityFile)
          : key === 'place' ? inventory.categories.place.find(item => item.label === 'England')
            : inventory.categories[key][0];
      if (!record) throw new Error(`Required real hosted ${key} choice unavailable.`);
      selected[key] = record;
    }
    if (kind !== 'skip') {
      selected.talent = inventory.categories[kind].find(item =>
        item.file === (kind === 'sports' ? 'sports/tennis.wav' : 'funny/stealing the remote control.wav'));
      if (!selected.talent) throw new Error('Required hosted talent unavailable.');
    }
    for (const [key, record] of Object.entries(selected)) {
      choices[key] = join(directory, `${key}.${record.file.split('.').at(-1)}`);
      await downloadStudioClip(`${WORKSHOP_ROOT}${record.file.split('/').map(encodeURIComponent).join('/')}`,
        choices[key], signal);
    }
    const result = await renderStudioMessage({
      name: resolve('server/santa-audio/names/arabella.wav'), choices, directory, signal,
    });
    assert.equal(result.order.filter(source => source === choices.activity).length, 1);
    assert.equal(result.order.indexOf(choices.activity), kind === 'skip' ? 5 : 7);
    assert.equal(result.order.filter(source => source === choices.talent).length, kind === 'skip' ? 0 : 1);
    assert.equal(result.order.length, kind === 'skip' ? 14 : 16);
    const output = `${root}/${kind}-${report.outputs.length + 1}.mp3`;
    await writeFile(output, result.audio);
    execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-err_detect', 'explode', '-i', output, '-f', 'null', '-'],
      { timeout: 20000 });
    let cursor = STUDIO_LEAD_IN_SECONDS;
    const timeline = result.order.map(source => {
      const seconds = result.prepared.get(source).seconds;
      const entry = { slot: Object.entries(choices).find(([, path]) => path === source)?.[0]
        || source.split('/').at(-1), start: cursor, end: cursor + seconds };
      cursor += seconds;
      return entry;
    });
    report.outputs.push({ talent: kind, activity: activityFile, output,
      seconds: cursor, bytes: result.audio.length, timeline,
      sourcePausesPreserved: true, timingMethod: 'Whole decoded buffers, no trimming, overlap or additional connector.' });
  } finally { await rm(directory, { recursive: true, force: true }); }
}
await writeFile(`${root}/hosted-check.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
