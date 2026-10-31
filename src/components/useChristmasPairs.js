import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { initialPairsState, makePairsDeck, pairsReducer } from '../lib/christmasPairs.js';

const BEST_KEY = 'santa-radio-christmas-pairs-best';

export default function useChristmasPairs() {
  const [state, dispatch] = useReducer(pairsReducer, initialPairsState);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY));
      if (Number.isSafeInteger(saved) && saved > 0) {
        bestRef.current = saved;
        setBest(saved);
      }
    } catch { /* A blocked preference store must not prevent free play. */ }
  }, []);

  useEffect(() => {
    if (state.phase !== 'complete' || state.level <= bestRef.current) return;
    bestRef.current = state.level;
    setBest(state.level);
    try { localStorage.setItem(BEST_KEY, String(state.level)); }
    catch { /* Retain the best for this visit if browser storage is unavailable. */ }
  }, [state.phase, state.level]);

  useEffect(() => {
    if (state.phase !== 'loading') return undefined;
    let cancelled = false;
    const cleanups = [];
    const pictures = [...new Map(state.cards.map(card => [card.picture.id, card.picture])).values()];
    Promise.all(pictures.map(picture => new Promise((resolve, reject) => {
      const image = new Image();
      const cleanup = () => {
        clearTimeout(timeout);
        image.onload = image.onerror = null;
      };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Image timeout')); }, 12000);
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error('Image failed')); };
      cleanups.push(cleanup);
      image.src = picture.src;
    }))).then(() => {
      if (!cancelled) {
        dispatch({ type: 'READY' });
        if (document.hidden) dispatch({ type: 'PAUSE' });
      }
    }).catch(() => {
      if (!cancelled) dispatch({ type: 'ERROR' });
    });
    return () => { cancelled = true; cleanups.forEach(cleanup => cleanup()); };
  }, [state.phase, state.cards]);

  // Track actual elapsed time, and preserve the remainder while paused.
  const ticking = !state.paused && (state.phase === 'preview' ||
    (state.phase === 'playing' && state.selected.length === 2));
  useEffect(() => {
    if (!ticking) return undefined;
    let previous = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'TICK', elapsed: now - previous });
      previous = now;
    }, 50);
    return () => clearInterval(interval);
  }, [ticking]);

  useEffect(() => {
    const pauseIfHidden = () => {
      if (document.hidden) dispatch({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', pauseIfHidden);
    return () => document.removeEventListener('visibilitychange', pauseIfHidden);
  }, []);

  useEffect(() => () => { audioRef.current?.close().catch(() => {}); }, []);

  const tone = useCallback((matched = false) => {
    const context = audioRef.current;
    if (!context) return;
    const play = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(matched ? 784 : 440, context.currentTime);
      if (matched) oscillator.frequency.setValueAtTime(1046, context.currentTime + .09);
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.055, context.currentTime + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .22);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    try {
      const resumed = context.state === 'suspended' ? context.resume() : Promise.resolve();
      resumed.then(play).catch(() => setAudioUnavailable(true));
    } catch { setAudioUnavailable(true); }
  }, []);

  const toggleSound = () => {
    if (soundEnabled) { setSoundEnabled(false); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      audioRef.current ||= new Audio();
      setAudioUnavailable(false);
      setSoundEnabled(true);
      tone();
    } catch { setAudioUnavailable(true); setSoundEnabled(false); }
  };

  const round = level => dispatch({ type: 'ROUND', level, cards: makePairsDeck(level) });
  const flip = id => {
    const card = state.cards.find(item => item.id === id);
    if (soundEnabled && card && state.phase === 'playing' && !state.paused &&
        state.selected.length < 2 && !state.selected.includes(id) && !state.matched.includes(card.picture.id)) {
      const first = state.cards.find(item => item.id === state.selected[0]);
      tone(first?.picture.id === card.picture.id);
    }
    dispatch({ type: 'FLIP', id });
  };

  return {
    state, best, soundEnabled, audioUnavailable, toggleSound, flip,
    start: () => round(1), restart: () => round(state.level),
    togglePause: () => dispatch({ type: 'TOGGLE_PAUSE' }),
    nextLevel: () => { if (state.phase === 'complete') round(state.level + 1); },
    newGame: () => round(1),
  };
}
