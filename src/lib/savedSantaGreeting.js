import { savedSantaGreeting } from '../data/savedSantaGreeting.js';

// No opaque/no-cors response: the existing Blob player/download/share flow needs
// readable bytes. Every failure is a cache miss, except cancellation by the user.
export async function trySavedSantaGreeting(record, signal, {
  pilot = savedSantaGreeting, fetcher = fetch, cryptoImpl = globalThis.crypto, timeoutMs = 5000, outro = 1,
} = {}) {
  signal?.throwIfAborted();
  if (!pilot.enabled || !pilot.recordingIds.includes(record.id) || !cryptoImpl?.subtle ||
      (outro !== 1 && outro !== 2)) return null;
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const lookup = await fetcher(`/api/santa-greeting?name=${encodeURIComponent(record.id)}&outro=${outro}`, {
      cache: 'no-store', signal: controller.signal, credentials: 'same-origin',
    });
    if (!lookup.ok) return null;
    const data = await lookup.json();
    controller.signal.throwIfAborted();
    const greeting = data?.greeting;
    if (!data.available || !greeting || !/^[a-f0-9]{64}$/.test(greeting.sha256) ||
        !Number.isInteger(greeting.bytes) || greeting.bytes < 1 || greeting.bytes > 4500000 ||
        typeof greeting.recipeVersion !== 'string') return null;
    const url = new URL(greeting.url);
    if (url.origin !== 'https://stagcommunications.com' ||
        !/^\/santaradio\/greetings-cache\/[a-zA-Z0-9.-]+\.mp3$/.test(url.pathname) ||
        url.username || url.password || url.search || url.hash) return null;
    url.searchParams.set('recipe', greeting.recipeVersion);
    const response = await fetcher(url.href, {
      method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'error',
      cache: 'no-store', signal: controller.signal,
    });
    if (response.status !== 200 || response.type === 'opaque' || response.redirected ||
        !response.headers.get('content-type')?.toLowerCase().startsWith('audio/mpeg') ||
        !response.body) return null;
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== greeting.bytes) return null;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > greeting.bytes) return null;
      chunks.push(value);
    }
    if (size !== greeting.bytes) return null;
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const digest = await cryptoImpl.subtle.digest('SHA-256', await blob.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (controller.signal.aborted || sha256 !== greeting.sha256) return null;
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
