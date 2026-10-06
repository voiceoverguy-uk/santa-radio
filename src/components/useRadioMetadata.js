import { useEffect, useState } from 'react';

const empty = { current: null, upcoming: [], currentStatus: 'loading', upcomingStatus: 'loading' };
const unavailable = { ...empty, currentStatus: 'unavailable', upcomingStatus: 'unavailable' };

export default function useRadioMetadata() {
  const [metadata, setMetadata] = useState(empty);
  useEffect(() => {
    let stopped = false, timer, controller;
    const refresh = async () => {
      clearTimeout(timer);
      if (document.hidden || stopped) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 9000);
      try {
        const response = await fetch('/api/radio-metadata', { signal: request.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Metadata unavailable');
        const data = await response.json();
        const validTrack = track => track && typeof track.artist === 'string' && typeof track.title === 'string';
        if (!['ready', 'unavailable'].includes(data.currentStatus) ||
            !['ready', 'unavailable'].includes(data.upcomingStatus) ||
            (data.currentStatus === 'ready' && !validTrack(data.current)) ||
            !Array.isArray(data.upcoming) || !data.upcoming.every(validTrack)) throw new Error('Invalid metadata');
        if (!stopped && controller === request) setMetadata(data);
      } catch {
        if (!stopped && controller === request) setMetadata(unavailable);
      } finally {
        clearTimeout(timeout);
        if (!stopped && controller === request) timer = setTimeout(refresh, 15000);
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
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return metadata;
}
