import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';

// Build/dev fingerprint: changing any ingredient or processing code disables the
// manually approved saved file until a new recording is explicitly approved.
export const recipeFiles = [
  'server/santa-audio/free-intro.wav',
  'server/santa-audio/free-outro.wav',
  'server/santa-audio/sleighbells.mp3',
  'scripts/santa-audio-filters.mjs',
  'scripts/prepare-santa-audio.mjs',
  'server/santa-message.js',
  'server/santa-name-library.js',
  'node_modules/ffmpeg-static/package.json',
];

export function santaAudioRecipeVersion(read = path => readFileSync(new URL(`../${path}`, import.meta.url))) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    schema: 'arabella-saved-greeting-v1',
    nameFile: savedSantaGreeting.nameFile,
    nameSha256: savedSantaGreeting.nameSha256,
  }));
  for (const path of recipeFiles) {
    hash.update(path);
    hash.update(createHash('sha256').update(read(path)).digest());
  }
  return `arabella-v1-${hash.digest('hex')}`;
}
