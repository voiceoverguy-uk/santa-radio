// Explicit operator-run live proof, never an automatic build/start step.
// Requires server secrets. Uploads a NEW UUID object and an automatic-cache
// manifest; never changes/deletes the manually approved file.
import assert from 'node:assert/strict';
import { santaNameLibrary } from '../server/santa-name-library.js';
import { createSavedGreetingCache } from '../server/santa-saved-cache.js';
import { createFtpsPublisher, ftpsSettings, readPublicFile, digest, safeUploadCode } from '../server/santa-ftps.js';
import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';

try {
  ftpsSettings(); // Stop before any network operation if mode/port/secrets absent.
  const cache = createSavedGreetingCache();
  const record = await santaNameLibrary.resolve('arabella');
  const prepared = await cache.prepare(record, santaNameLibrary);
  assert.ok(prepared);
  assert.equal(prepared.identity.recipeVersion, savedSantaGreeting.recipeVersion,
    'Current recipe needs a fresh approved MP3 before using the manual recording for this proof.');
  assert.equal(prepared.identity.nameSha256, savedSantaGreeting.nameSha256);
  const audio = await readPublicFile('Santa-message-for-Arabella.mp3', savedSantaGreeting.bytes);
  assert.equal(audio.length, savedSantaGreeting.bytes);
  assert.equal(digest(audio), savedSantaGreeting.sha256);
  const published = await createFtpsPublisher()(prepared.identity, audio);
  const hit = await cache.lookup(record, santaNameLibrary);
  assert.equal(hit.file, published.file);
  const returned = await readPublicFile(hit.file, audio.length);
  assert.deepEqual(returned, audio);
  console.info(JSON.stringify({
    result: 'FTPS_AND_HTTPS_VERIFIED', file: hit.file, bytes: hit.bytes,
    existingManualFile: 'untouched', subsequentLookup: 'VERSIONED_HIT',
    ffmpegInvocations: 0,
    next: 'Run browser saved-greeting tests for real CORS, player/download and a forced failure.',
  }));
} catch (error) {
  console.error(JSON.stringify({
    result: 'NOT_VERIFIED', code: safeUploadCode(error),
    next: 'Check private settings/provider mode and port. No credentials should be pasted into chat.',
  }));
  process.exitCode = 1;
}
