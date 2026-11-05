import { useCallback, useEffect, useRef, useState } from 'react';

export const CHECKER_SOUNDS = {
  checking: '/audio/naughty-or-nice/checking_1793902553290.mp3',
  homepageChecking: '/audio/naughty-or-nice/checking_1793902553290.mp3',
  nice: '/audio/naughty-or-nice/checking-nice_1793904309041.mp3',
  naughty: '/audio/naughty-or-nice/checking-naughty_1793904309041.mp3',
};

export default function useCheckerAudio(checkingSound = CHECKER_SOUNDS.checking) {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  const [error, setError] = useState('');
  const audio = useRef(null);
  const handlers = useRef(null);
  const progressTimer = useRef(null);
  const stop = useCallback(() => {
    const current = audio.current;
    const callbacks = handlers.current;
    audio.current = null;
    handlers.current = null;
    clearInterval(progressTimer.current);
    progressTimer.current = null;
    if (!current) return;
    current.onended = current.onerror = current.onplaying = current.onwaiting = current.onstalled = null;
    current.pause(); current.removeAttribute('src'); current.load();
    callbacks?.onStopped?.();
  }, []);
  useEffect(() => {
    const events = ['santa-radio:soundboard-start', 'santa-radio:example-start', 'santa-radio:checker-start'];
    events.forEach(event => document.addEventListener(event, stop));
    return () => {
      events.forEach(event => document.removeEventListener(event, stop));
      stop();
    };
  }, [stop]);
  const play = useCallback((kind, callbacks = {}) => {
    stop(); setError('');
    if (!enabledRef.current) return;
    // This event coordinates short effects only, never the user's radio state.
    document.dispatchEvent(new CustomEvent('santa-radio:checker-start'));
    const current = new Audio(kind === 'checking' ? checkingSound : CHECKER_SOUNDS[kind]);
    audio.current = current;
    handlers.current = callbacks;
    if (callbacks.onProgress) {
      progressTimer.current = setInterval(() => {
        if (audio.current === current) callbacks.onProgress(current);
      }, 50);
    }
    const failed = () => {
      if (audio.current !== current) return;
      stop();
      setError('Sound could not play. Your check still works.');
    };
    current.onerror = failed;
    const playing = () => {
      if (audio.current !== current) return;
      callbacks.onStarted?.(current);
    };
    current.onplaying = playing;
    current.onwaiting = current.onstalled = () => {
      if (audio.current === current) callbacks.onWaiting?.();
    };
    current.onended = () => {
      if (audio.current !== current) return;
      stop();
      callbacks.onEnded?.();
    };
    try { Promise.resolve(current.play()).then(playing, failed); } catch { failed(); }
  }, [stop, checkingSound]);
  return { enabled, error, play, stop, toggle: () => {
    stop(); setError('');
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
  } };
}
