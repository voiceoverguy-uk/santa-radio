import { useSyncExternalStore } from 'react';
import { artistBackgroundKey } from '../data/artist-backgrounds.js';
const empty = Object.freeze({});
let backgrounds = empty, pending, timer, lastRead = 0, generation = 0;
const listeners = new Set();
function refresh() {
  if (document.hidden || pending || Date.now() - lastRead < 30000) return;
  const requestedGeneration = generation;
  pending = fetch('/api/artist-backgrounds', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!data.backgrounds || typeof data.backgrounds !== 'object') return;
      if (requestedGeneration !== generation) return;
      backgrounds = data.backgrounds; lastRead = Date.now();
      listeners.forEach(listener => listener());
    }).catch(() => {}).finally(() => { pending = null; });
}
export function publishArtistBackground(key, text) {
  generation++;
  backgrounds = { ...backgrounds, [key]: text };
  listeners.forEach(listener => listener());
}
function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh(); timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); }
  };
}
export function useArtistBackground(song) {
  const overrides = useSyncExternalStore(subscribe, () => backgrounds, () => empty);
  return song ? overrides[artistBackgroundKey(song.artist)] ?? song.info : '';
}
