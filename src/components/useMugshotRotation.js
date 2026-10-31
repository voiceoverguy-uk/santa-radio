import { useEffect, useState } from 'react';
import { selectHomepageMugshots } from '../data/homepageMugshots.js';

export const MUGSHOT_REFRESH_MS = 10_000;
export const MUGSHOT_STAGGER_MS = 350;

export default function useMugshotRotation(catalogue) {
  const [celebs, setCelebs] = useState(() => selectHomepageMugshots(catalogue));
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const paused = userPaused || hovered || focused || hidden;

  useEffect(() => {
    const updateVisibility = () => setHidden(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timers = new Set();
    const later = (callback, delay) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    };
    // Keep a local snapshot for the next cycle, without restarting the ten-second
    // clock after each individual card update.
    let current = celebs;
    const refresh = () => {
      const displayed = new Set(current.map(profile => profile.song));
      const next = selectHomepageMugshots(catalogue.filter(profile => !displayed.has(profile.song)));
      // A small catalogue should stay useful rather than duplicate visible people.
      if (next.length === current.length && next.length > 0) {
        next.forEach((profile, index) => {
          const replace = () => {
            current = current.map((previous, slot) => slot === index ? profile : previous);
            setCelebs(current);
          };
          if (index === 0) replace();
          else later(replace, index * MUGSHOT_STAGGER_MS);
        });
      }
      later(refresh, MUGSHOT_REFRESH_MS);
    };
    later(refresh, MUGSHOT_REFRESH_MS);
    return () => timers.forEach(clearTimeout);
    // Individual card changes must not restart the cycle. On pause/resume, the
    // effect deliberately captures the latest complete or partly replaced row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, paused]);

  return {
    celebs,
    userPaused,
    togglePaused: () => setUserPaused(previous => !previous),
    gridEvents: {
      onPointerEnter: event => {
        if (event.pointerType === 'mouse') setHovered(true);
      },
      onPointerLeave: () => setHovered(false),
      onFocusCapture: () => setFocused(true),
      onBlurCapture: event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      },
    },
  };
}
