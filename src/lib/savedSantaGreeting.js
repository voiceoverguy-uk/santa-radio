import { savedSantaGreeting } from '../data/savedSantaGreeting.js';

const builtRecipe = typeof __SANTA_AUDIO_RECIPE__ === 'string' ? __SANTA_AUDIO_RECIPE__ : null;

// No opaque/no-cors response: the existing Blob player/download/share flow needs
// readable bytes. Every failure is a cache miss, except cancellation by the user.
export async function trySavedSantaGreeting(record, signal, {
  pilot = savedSantaGreeting, recipeVersion = builtRecipe,
  fetcher = fetch, cryptoImpl = globalThis.crypto, timeoutMs = 3000,
} = {}) {
  signal?.throwIfAborted();
  if (!pilot.enabled || recipeVersion !== pilot.recipeVersion ||
      !pilot.recordingIds.includes(record.id) || !cryptoImpl?.subtle) return null;
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(pilot.url);
    url.searchParams.set('recipe', pilot.recipeVersion);
    const response = await fetcher(url.href, {
      method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'error',
      cache: 'no-store', signal: controller.signal,
    });
    if (response.status !== 200 || response.type === 'opaque' || response.redirected ||
        !response.headers.get('content-type')?.toLowerCase().startsWith('audio/mpeg') ||
        !response.body) return null;
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== pilot.bytes) return null;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > pilot.bytes) return null;
      chunks.push(value);
    }
    if (size !== pilot.bytes) return null;
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const digest = await cryptoImpl.subtle.digest('SHA-256', await blob.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (controller.signal.aborted || sha256 !== pilot.sha256) return null;
    return blob;
  } catch {
    signal?.throwIfAborted();
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort(); // Cancel unread/oversized/error response bodies too.
  }
}
