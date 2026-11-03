import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { apiBase } from './api';
import { parseMetadata, type Track } from './radio-state';

export const STREAM_URL = 'https://global.citrus3.com:8164/';
type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
function useRadioState() {
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);
  const [status, setStatus] = useState<RadioStatus>('idle');
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<Track | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const wantsPlay = useRef(false);
  const requestVersion = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audible = useRef(false);
  useEffect(() => {
    // Lock-screen/headphone Play can resume the native player independently.
    if (!wantsPlay.current) {
      if (playback.playing) {
        wantsPlay.current = true;
        setStatus(playback.isBuffering ? 'loading' : 'playing');
      }
      return;
    }
    if (playback.playbackState === 'error') {
      wantsPlay.current = false; setStatus('error'); setError('The radio stream is unavailable. Tap retry to reconnect.');
    } else if (playback.playing && !playback.isBuffering) {
      audible.current = true;
      if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
      setStatus('playing');
    } else if (playback.isBuffering) {
      audible.current = false; setStatus('loading');
      if (!timeout.current) timeout.current = setTimeout(() => {
        timeout.current = null;
        if (wantsPlay.current && !audible.current) {
          wantsPlay.current = false; player.pause(); setStatus('error');
          setError('Radio buffering took too long. Please retry.');
        }
      }, 20000);
    }
    else if (playback.isLoaded && playback.timeControlStatus === 'paused') {
      // OS/headphone/lock-screen pause is real; never auto-resume it.
      wantsPlay.current = false; setStatus('paused');
    }
  }, [playback.playing, playback.isBuffering, playback.isLoaded, playback.playbackState, playback.timeControlStatus]);
  useEffect(() => {
    if (!wantsPlay.current) return;
    player.setActiveForLockScreen(true, { title: current?.title || 'Santa Radio', artist: current?.artist || 'Christmas music, all year' });
  }, [current]);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (Platform.OS === 'web') { setMetadataStatus('unavailable'); return; }
      if (controller) return;
      if (AppState.currentState !== 'active') return;
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 9000);
      try {
        const response = await fetch(`${apiBase()}/api/radio-metadata?part=current`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Metadata unavailable');
        const track = parseMetadata(await response.json());
        if (!disposed) { setCurrent(track); setMetadataStatus(track ? 'ready' : 'unavailable'); }
      } catch { if (!disposed) { setCurrent(null); setMetadataStatus('unavailable'); } }
      finally {
        clearTimeout(deadline); controller = undefined;
        if (!disposed && AppState.currentState === 'active') timer = setTimeout(refresh, 5000);
      }
    };
    refresh();
    const listener = AppState.addEventListener('change', state => {
      clearTimeout(timer);
      if (state === 'active') { setCurrent(null); setMetadataStatus('loading'); refresh(); }
      else { setCurrent(null); setMetadataStatus('unavailable'); controller?.abort(); }
    });
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); listener.remove(); if (timeout.current) clearTimeout(timeout.current); };
  }, []);
  const pause = () => {
    wantsPlay.current = false; requestVersion.current++;
    if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
    player.pause(); setStatus('paused');
  };
  const toggle = async () => {
    if (wantsPlay.current) { pause(); return; }
    const attempt = ++requestVersion.current;
    audible.current = false;
    wantsPlay.current = true; setStatus('loading'); setError('');
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      if (attempt !== requestVersion.current || !wantsPlay.current) return;
      // Reconnect at the live edge instead of resuming a stale buffered stream.
      player.replace(STREAM_URL);
      player.setActiveForLockScreen(true, { title: current?.title || 'Santa Radio', artist: current?.artist || 'Christmas music, all year' });
      player.play();
      timeout.current = setTimeout(() => {
        timeout.current = null;
        if (wantsPlay.current && !audible.current) {
          wantsPlay.current = false; player.pause(); setStatus('error'); setError('The radio took too long to connect. Please retry.');
        }
      }, 20000);
    } catch {
      wantsPlay.current = false; setStatus('error'); setError('Radio playback could not start. Check your connection and retry.');
    }
  };
  return { status, error, current, metadataStatus, toggle, pause };
}
const Context = createContext<ReturnType<typeof useRadioState> | null>(null);
export function RadioProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={useRadioState()}>{children}</Context.Provider>;
}
export function useRadio() {
  const state = useContext(Context);
  if (!state) throw new Error('RadioProvider required');
  return state;
}
