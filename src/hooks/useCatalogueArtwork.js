import { useSyncExternalStore } from 'react';

const empty = { artists: {}, recordings: {} };
let current = empty, pending, timer, lastRead = 0;
const listeners = new Set();

export async function fetchCatalogueArtwork(edit = false) {
  const response = await fetch('/api/catalogue-artwork' + (edit ? '?edit=1' : ''), {
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Could not load the current artwork.');
  const data = await response.json();
  if (!data.artists || !data.recordings) throw new Error('Could not load the current artwork.');
  return data;
}

function refresh() {
  if (document.hidden || pending || Date.now() - lastRead < 30000) return;
  pending = fetchCatalogueArtwork().then(data => {
    current = data;
    lastRead = Date.now();
    listeners.forEach(listener => listener());
  }).catch(() => {}).finally(() => { pending = null; });
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    }
  };
}

export function useCatalogueArtwork() {
  return useSyncExternalStore(subscribe, () => current, () => empty);
}
