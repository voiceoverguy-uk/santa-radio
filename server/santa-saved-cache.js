import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';
import { santaAudioRecipeVersion } from '../scripts/santa-audio-recipe.mjs';
import { createFtpsPublisher, digest, GREETING_ROOT, readPublicFile, safeUploadCode } from './santa-ftps.js';

export function eligibleArabella(record) {
  return savedSantaGreeting.enabled && record?.source === 'hosted' &&
    record.file === 'arabella.mp3' && savedSantaGreeting.recordingIds.includes(record.id);
}

export function validManifest(value, identity) {
  return value?.schema === 1 && value.key === identity.key &&
    value.recipeVersion === identity.recipeVersion && value.nameSha256 === identity.nameSha256 &&
    typeof value.file === 'string' && value.file.startsWith(`${identity.key}-`) &&
    /^[a-z0-9-]+\.mp3$/.test(value.file) && /^[a-f0-9]{64}$/.test(value.sha256) &&
    Number.isInteger(value.bytes) && value.bytes > 100000 && value.bytes < 4500000;
}

export function createSavedGreetingCache({
  publisher = createFtpsPublisher(), fetcher = fetch,
  recipe = (nameSha, outro) => santaAudioRecipeVersion(undefined, nameSha, outro),
  log = (event, code) => console.info('[santa-cache]', { event, code }),
} = {}) {
  const pending = new Map();
  const prepare = async (record, library, outro = 1) => {
    if (!eligibleArabella(record) || !library.sourceBytes) return null;
    // Read compressed source bytes, NOT decode/render. A same-filename remote
    // replacement must change identity without relying on a manual version bump.
    const sourceBytes = await library.sourceBytes(record);
    const nameSha256 = digest(sourceBytes);
    const recipeVersion = recipe(nameSha256, outro);
    const key = `arabella-${digest(Buffer.from(recipeVersion))}`;
    return { sourceBytes, identity: { key, recipeVersion, nameSha256 } };
  };
  return {
    prepare,
    async lookup(record, library, outro = 1) {
      try {
        const prepared = await prepare(record, library, outro);
        if (!prepared) return null;
        const { identity } = prepared;
        try {
          const value = JSON.parse((await readPublicFile(`${identity.key}.json`, 4096, { fetcher })).toString('utf8'));
          if (validManifest(value, identity)) {
            log('lookup', 'VERSIONED_HIT');
            return { ...value, url: new URL(value.file, GREETING_ROOT).href };
          }
        } catch { /* Missing storage is a miss, not a visitor-facing failure. */ }
        if (identity.recipeVersion === savedSantaGreeting.recipeVersion &&
            identity.nameSha256 === savedSantaGreeting.nameSha256) {
          log('lookup', 'MANUAL_APPROVED_CANDIDATE');
          return {
            url: savedSantaGreeting.url, sha256: savedSantaGreeting.sha256,
            bytes: savedSantaGreeting.bytes, recipeVersion: identity.recipeVersion,
          };
        }
        log('lookup', 'MISS');
      } catch { log('lookup', 'LOOKUP_UNAVAILABLE'); }
      return null;
    },
    async publish(prepared, audio) {
      if (!prepared) return null;
      try {
        const manifest = await publisher(prepared.identity, audio);
        log('publish', 'HTTPS_VERIFIED');
        return manifest;
      } catch (error) {
        log('publish', safeUploadCode(error));
        return null;
      }
    },
    // In-process single flight; across instances, unique objects plus an atomic
    // manifest swap keep both competing completed recordings safe.
    singleFlight(id, work) {
      if (!pending.has(id)) {
        const promise = Promise.resolve().then(work).finally(() => pending.delete(id));
        pending.set(id, promise);
      }
      return pending.get(id);
    },
  };
}

export const santaSavedCache = createSavedGreetingCache();
