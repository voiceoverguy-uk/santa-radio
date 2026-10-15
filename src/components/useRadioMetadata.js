import { useEffect, useRef, useState } from 'react';
import { trackIdentity } from '../lib/radio-track-identity.js';

const empty = { current: null, upcoming: [], currentStatus: 'loading', upcomingStatus: 'loading' };
const STALE_MS = 45000;
const validTrack = track => track && typeof track.artist === 'string' && typeof track.title === 'string';

export default function useRadioMetadata(listening = false) {
  const [metadata, setMetadata] = useState(empty);
  const listeningRef = useRef(listening);
  const previousListening = useRef(listening);
  const controls = useRef(null);
  listeningRef.current = listening;

  useEffect(() => {
    let stopped = false, expiryTimer, lastUpcoming = [], lastUpdated = 0, currentUpdated = 0;
    let lastCurrentIdentity = null, transitionRefresh = false;
    const channels = {
      current: { timer: null, request: null },
      upcoming: { timer: null, request: null },
    };
    const allowed = part => !document.hidden || (part === 'current' && listeningRef.current);
    const stopChannel = part => {
      if (part === 'upcoming') transitionRefresh = false;
      const channel = channels[part];
      clearTimeout(channel.timer);
      channel.timer = null;
      if (channel.request) {
        clearTimeout(channel.request.timeout);
        channel.request.controller.abort();
        channel.request = null;
      }
    };
    const clearUpcoming = () => {
      lastUpcoming = [];
      setMetadata(previous => ({ ...previous, upcoming: [], upcomingStatus: 'unavailable' }));
    };
    const commitUpcoming = data => {
      clearTimeout(expiryTimer);
      if (data.upcomingStatus === 'ready' || data.upcomingStatus === 'stale') {
        lastUpcoming = data.upcoming;
        lastUpdated = Math.min(Date.now(), Number.isFinite(data.upcomingUpdatedAt)
          ? data.upcomingUpdatedAt : data.upcomingStatus === 'ready' ? Date.now() : lastUpdated);
      }
      const remaining = Math.max(0, Math.min(STALE_MS, lastUpdated + STALE_MS - Date.now()));
      if (data.upcomingStatus !== 'ready' && lastUpcoming.length && remaining > 0) {
        setMetadata(previous => ({ ...previous, upcoming: lastUpcoming, upcomingStatus: 'stale', upcomingUpdatedAt: lastUpdated }));
        expiryTimer = setTimeout(() => { if (!stopped) clearUpcoming(); }, remaining);
      } else {
        const ready = data.upcomingStatus === 'ready';
        if (!ready) lastUpcoming = [];
        setMetadata(previous => ({
          ...previous, upcoming: ready ? data.upcoming : [],
          upcomingStatus: ready ? 'ready' : 'unavailable', upcomingUpdatedAt: lastUpdated,
        }));
      }
    };
    const refresh = async part => {
      stopChannel(part);
      if (stopped || !allowed(part)) return;
      const channel = channels[part];
      const request = { controller: new AbortController(), timeout: null };
      channel.request = request;
      request.timeout = setTimeout(() => request.controller.abort(), 9000);
      let retry = false;
      try {
        const response = await fetch(`/api/radio-metadata?part=${part}`, {
          signal: request.controller.signal, cache: 'no-store',
        });
        if (!response.ok) throw new Error('Metadata unavailable');
        const data = await response.json();
        if (part === 'current') {
          if (!['ready', 'unavailable'].includes(data.currentStatus) ||
              (data.currentStatus === 'ready' && !validTrack(data.current))) throw new Error('Invalid current metadata');
        } else if (!['ready', 'stale', 'unavailable'].includes(data.upcomingStatus) ||
            !Array.isArray(data.upcoming) || !data.upcoming.every(validTrack)) throw new Error('Invalid upcoming metadata');
        if (stopped || channel.request !== request) return;
        if (part === 'current') {
          retry = data.currentStatus !== 'ready';
          currentUpdated = Date.now();
          const identity = data.currentStatus === 'ready' ? trackIdentity(data.current) : null;
          const changed = identity && lastCurrentIdentity && identity !== lastCurrentIdentity;
          if (identity) lastCurrentIdentity = identity;
          setMetadata(previous => ({
            ...previous, current: data.currentStatus === 'ready' ? data.current : null,
            currentStatus: data.currentStatus,
          }));
          if (changed && allowed('upcoming')) {
            // Keep the active queue read; coalesce any number of transitions
            // into one follow-up, since its response may predate the new song.
            if (channels.upcoming.request) transitionRefresh = true;
            else refresh('upcoming');
          }
        } else commitUpcoming(data);
      } catch {
        retry = true;
        if (!stopped && channel.request === request) {
          if (part === 'current') {
            currentUpdated = 0;
            setMetadata(previous => ({ ...previous, current: null, currentStatus: 'unavailable' }));
          } else commitUpcoming({ upcoming: [], upcomingStatus: 'unavailable' });
        }
      } finally {
        clearTimeout(request.timeout);
        if (!stopped && channel.request === request) {
          channel.request = null;
          if (allowed(part)) {
            if (part === 'upcoming' && transitionRefresh) {
              transitionRefresh = false;
              refresh(part);
            } else channel.timer = setTimeout(() => refresh(part),
              part === 'current' && retry ? 3000 : 5000);
          }
        }
      }
    };
    const sync = (playbackChanged = false) => {
      // Suspended phone timers cannot guarantee background freshness. Clear old
      // values on return before reading again; identical titles are not expiry signals.
      if (currentUpdated && Date.now() - currentUpdated > 15000) {
        setMetadata(previous => ({ ...previous, current: null, currentStatus: 'loading' }));
      }
      if (lastUpcoming.length && Date.now() - lastUpdated >= STALE_MS) {
        clearTimeout(expiryTimer);
        clearUpcoming();
      }
      if (allowed('current')) refresh('current'); else stopChannel('current');
      if (!playbackChanged) {
        if (allowed('upcoming')) refresh('upcoming'); else stopChannel('upcoming');
      }
    };
    const visibility = () => sync();
    const pageshow = event => { if (event.persisted) sync(); };
    controls.current = { playbackChanged: () => sync(true) };
    refresh('current');
    refresh('upcoming');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pageshow', pageshow);
    return () => {
      stopped = true;
      stopChannel('current');
      stopChannel('upcoming');
      clearTimeout(expiryTimer);
      controls.current = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pageshow', pageshow);
    };
  }, []);

  useEffect(() => {
    if (previousListening.current !== listening) {
      previousListening.current = listening;
      controls.current?.playbackChanged();
    }
  }, [listening]);
  return metadata;
}
