import { createContext, useContext, useEffect, useRef, useState } from 'react';
import useRadioMetadata from './useRadioMetadata.js';
import useSnowEffects from './useSnowEffects.js';

const RadioContext = createContext(null);
const STREAM_URL = 'https://global.citrus3.com:8164/';
export function RadioProvider({ children }) {
  const audioRef = useRef(null);
  const attempt = useRef(0);
  const timeout = useRef(null);
  const contender = useRef(null);
  const owner = useRef('radio');
  const [status, setStatus] = useState('idle');
  const metadata = useRadioMetadata(status === 'playing' || status === 'loading');
  const [volume, setVolume] = useState(.7);
  const [error, setError] = useState('');
  const { effects, setEffects } = useSnowEffects();
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const fail = () => {
    clearTimeout(timeout.current);
    attempt.current += 1;
    audioRef.current?.pause();
    setStatus('error');
    setError('The radio stream is unavailable. Please try again.');
  };
  const togglePlay = async (resumeOnly = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    clearTimeout(timeout.current);
    const token = ++attempt.current;
    if (!resumeOnly && (status === 'playing' || status === 'loading')) {
      audio.pause();
      setStatus('paused');
      return;
    }
    setError('');
    owner.current = 'radio';
    contender.current?.pause();
    contender.current = null;
    setStatus('loading');
    audio.load();
    timeout.current = setTimeout(fail, 20000);
    try {
      await audio.play();
       if (token !== attempt.current) {
         if (owner.current !== 'radio') audio.pause();
         return;
       }
      clearTimeout(timeout.current);
      setStatus('playing');
    } catch {
      if (token === attempt.current) fail();
    }
  };
  const pauseForMessage = () => {
    if (status !== 'playing' && status !== 'loading') return null;
    const token = ++attempt.current;
    clearTimeout(timeout.current);
    audioRef.current?.pause();
    setStatus('paused');
    // Manual radio actions invalidate this request; never undo the listener's choice.
    return () => {
      if (attempt.current === token) return togglePlay(true);
    };
  };
  const claimContender = audio => {
    if (contender.current && contender.current !== audio) contender.current.pause();
    contender.current = audio;
    owner.current = 'contender';
    attempt.current += 1;
    clearTimeout(timeout.current);
    audioRef.current?.pause();
    // Cancels a pending radio play promise as well as buffered playback.
    audioRef.current?.load();
    setStatus('paused');
  };
  const releaseContender = audio => {
    audio?.pause();
    if (contender.current === audio) contender.current = null;
  };
  return (
    <RadioContext.Provider value={{ status, volume, setVolume, error, togglePlay: () => togglePlay(), pauseForMessage, claimContender, releaseContender, effects, setEffects, metadata }}>
      <audio ref={audioRef} src={STREAM_URL} preload="none" onError={fail}
        onWaiting={() => {
          setStatus(current => current === 'playing' ? 'loading' : current);
          clearTimeout(timeout.current);
          timeout.current = setTimeout(fail, 20000);
        }}
        onPlaying={() => {
          if (owner.current !== 'radio') { audioRef.current?.pause(); return; }
          clearTimeout(timeout.current); setStatus('playing');
        }}
        onEnded={() => setStatus('paused')} />
      {children}
    </RadioContext.Provider>
  );
}
export function useRadio() { return useContext(RadioContext); }
