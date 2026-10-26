import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';

// Build/dev fingerprint: changing any ingredient or processing code disables the
// manually approved saved file until a new recording is explicitly approved.
export const recipeFiles = [
  'server/santa-audio/free-intro.mp3',
  'server/santa-audio/free-outro-1.mp3',
  'server/santa-audio/free-outro-2.mp3',
  'server/santa-audio/sleighbells.mp3',
  'scripts/santa-audio-filters.mjs',
  'scripts/prepare-santa-audio.mjs',
  'server/santa-message.js',
  'server/santa-name-library.js',
  'node_modules/ffmpeg-static/package.json',
];

export function santaAudioRecipeVersion(
  read = path => readFileSync(new URL(`../${path}`, import.meta.url)),
  nameSha256 = savedSantaGreeting.nameSha256,
  outro = 1,
) {
  if (outro !== 1 && outro !== 2) throw new RangeError('Invalid Santa outro.');
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    schema: 'arabella-saved-greeting-v1',
    nameFile: savedSantaGreeting.nameFile,
    nameSha256,
    outro,
  }));
  for (const path of recipeFiles) {
    hash.update(path);
    hash.update(createHash('sha256').update(read(path)).digest());
  }
  return `arabella-v1-${hash.digest('hex')}`;
}
