import { createContext, useContext, useEffect, useRef, useState } from 'react';
import useRadioMetadata from './useRadioMetadata.js';

const RadioContext = createContext(null);
const STREAM_URL = 'https://global.citrus3.com:8164/';
export function RadioProvider({ children }) {
  const metadata = useRadioMetadata();
  const audioRef = useRef(null);
  const attempt = useRef(0);
  const timeout = useRef(null);
  const [status, setStatus] = useState('idle');
  const [volume, setVolume] = useState(.7);
  const [error, setError] = useState('');
  const [effects, setEffects] = useState(() => {
    try { return localStorage.getItem('santa-effects') !== 'off'; } catch { return true; }
  });
  useEffect(() => {
    document.documentElement.dataset.effects = effects ? 'on' : 'off';
    try { localStorage.setItem('santa-effects', effects ? 'on' : 'off'); } catch { /* Storage is optional. */ }
  }, [effects]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const fail = () => {
    clearTimeout(timeout.current);
    attempt.current += 1;
    audioRef.current?.pause();
    setStatus('error');
    setError('The radio stream is unavailable. Please try again.');
  };
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    clearTimeout(timeout.current);
    const token = ++attempt.current;
    if (status === 'playing' || status === 'loading') {
      audio.pause();
      setStatus('paused');
      return;
    }
    setError('');
    setStatus('loading');
    audio.load();
    timeout.current = setTimeout(fail, 20000);
    try {
      await audio.play();
      if (token !== attempt.current) return;
      clearTimeout(timeout.current);
      setStatus('playing');
    } catch {
      if (token === attempt.current) fail();
    }
  };
  return (
    <RadioContext.Provider value={{ status, volume, setVolume, error, togglePlay, effects, setEffects, metadata }}>
      <audio ref={audioRef} src={STREAM_URL} preload="none" onError={fail}
        onWaiting={() => {
          setStatus(current => current === 'playing' ? 'loading' : current);
          clearTimeout(timeout.current);
          timeout.current = setTimeout(fail, 20000);
        }}
        onPlaying={() => { clearTimeout(timeout.current); setStatus('playing'); }}
        onEnded={() => setStatus('paused')} />
      {children}
    </RadioContext.Provider>
  );
}
export function useRadio() { return useContext(RadioContext); }
