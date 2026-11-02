import { refreshWorkshopNamePreview } from './workshopNamePreview.js';

const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

// One recording, in memory only, owned by the mounted Studio page. Nothing is
// written to browser storage, and neither capabilities nor names are retained.
export function createWorkshopNamePreviewCache({
  request = fetch,
  createUrl = blob => URL.createObjectURL(blob),
  revokeUrl = url => URL.revokeObjectURL(url),
} = {}) {
  let cached = null;
  let generation = 0;
  const clear = () => {
    generation++;
    if (cached) revokeUrl(cached.url);
    cached = null;
  };
  const peek = id => cached && cached.id === id ? cached.url : null;
  return {
    clear,
    peek,
    async load(record, { signal } = {}) {
      signal?.throwIfAborted();
      const existing = peek(record?.id);
      if (existing) return existing;
      clear();
      const current = generation;
      const src = await refreshWorkshopNamePreview(record, { signal, request });
      const response = await request(src, {
        signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      });
      if (!response.ok) {
        throw new Error(response.status === 429
          ? 'Too many preview attempts. Please wait a minute and try again.'
          : 'Santa’s name preview is temporarily unavailable. Please try again.');
      }
      if (!/^audio\/(?:mpeg|mp3|wav|x-wav|wave)(?:;|$)/i.test(response.headers.get('content-type') || '')
          || Number(response.headers.get('content-length')) > MAX_PREVIEW_BYTES) {
        throw new Error('Santa’s name preview returned an invalid recording. Please try again.');
      }
      const blob = await response.blob();
      signal?.throwIfAborted();
      if (current !== generation) throw new DOMException('Preview cancelled.', 'AbortError');
      if (!blob.size || blob.size > MAX_PREVIEW_BYTES) {
        throw new Error('Santa’s name preview returned an invalid recording. Please try again.');
      }
      cached = { id: record.id, url: createUrl(blob) };
      return cached.url;
    },
  };
}
