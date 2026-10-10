import { useEffect, useState } from 'react';

const empty = { current: null, upcoming: [], currentStatus: 'loading', upcomingStatus: 'loading' };
const unavailable = { ...empty, currentStatus: 'unavailable', upcomingStatus: 'unavailable' };

export default function useRadioMetadata() {
  const [metadata, setMetadata] = useState(empty);
  useEffect(() => {
    let stopped = false, timer, controller, expiryTimer;
    let lastUpcoming = [], lastUpdated = 0;
    const commit = data => {
      clearTimeout(expiryTimer);
      if (data.upcomingStatus === 'ready' || data.upcomingStatus === 'stale') {
        lastUpcoming = data.upcoming;
        lastUpdated = Number.isFinite(data.upcomingUpdatedAt) ? data.upcomingUpdatedAt : data.upcomingStatus === 'ready' ? Date.now() : lastUpdated;
      }
      const remaining = Math.max(0, Math.min(45000, lastUpdated + 45000 - Date.now()));
      if (data.upcomingStatus !== 'ready' && lastUpcoming.length && remaining > 0) {
        setMetadata({ ...data, upcoming: lastUpcoming, upcomingStatus: 'stale' });
        expiryTimer = setTimeout(() => {
          if (!stopped) setMetadata(previous => ({ ...previous, upcoming: [], upcomingStatus: 'unavailable' }));
        }, remaining);
      } else {
        setMetadata(data.upcomingStatus === 'stale' ? { ...data, upcoming: [], upcomingStatus: 'unavailable' } : data);
      }
    };
    const refresh = async () => {
      clearTimeout(timer);
      if (document.hidden || stopped) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 9000);
      let retry = false;
      try {
        const response = await fetch('/api/radio-metadata', { signal: request.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Metadata unavailable');
        const data = await response.json();
        const validTrack = track => track && typeof track.artist === 'string' && typeof track.title === 'string';
        if (!['ready', 'unavailable'].includes(data.currentStatus) ||
            !['ready', 'stale', 'unavailable'].includes(data.upcomingStatus) ||
            (data.currentStatus === 'ready' && !validTrack(data.current)) ||
            !Array.isArray(data.upcoming) || !data.upcoming.every(validTrack)) throw new Error('Invalid metadata');
        retry = data.upcomingStatus !== 'ready';
        if (!stopped && controller === request) commit(data);
      } catch {
        retry = true;
        if (!stopped && controller === request) commit(unavailable);
      } finally {
        clearTimeout(timeout);
        if (!stopped && controller === request) timer = setTimeout(refresh, retry ? 3000 : 5000);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(expiryTimer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return metadata;
}
