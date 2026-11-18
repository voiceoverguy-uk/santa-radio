export function audioDuration(blob, signal) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const cleanup = () => { audio.onloadedmetadata = null; audio.onerror = null; clearTimeout(timer); signal?.removeEventListener('abort', abort); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); };
    const finish = duration => { cleanup(); resolve(Number.isFinite(duration) && duration > 0 ? duration : 0); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => finish(0), 10000);
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    audio.preload = 'metadata'; audio.src = url;
  });
}
export function encodingProgress(time, duration) {
  return duration > 0 && Number.isFinite(time) ? Math.max(0, Math.min(0.95, time / 1000000 / duration * 0.95)) : null;
}
