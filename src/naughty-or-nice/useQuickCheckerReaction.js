import { useEffect, useRef } from 'react';
import { selectQuickCheckerReaction } from './quickCheckerReactions.js';

// Keep the approved early reveal separate from the checking clip's natural end.
// An ended event, not a wall-clock guess, is the only permission to react.
export default function useQuickCheckerReaction(audio) {
  const session = useRef(null);
  const latestAudio = useRef(audio);
  latestAudio.current = audio;
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') latestAudio.current.stop();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      clearTimeout(session.current?.timer);
      session.current = null;
    };
  }, []);
  const start = check => {
    if (session.current !== check || check.cancelled || check.consumed ||
        !check.completed || !check.ended) return;
    check.consumed = true;
    clearTimeout(check.timer);
    latestAudio.current.play('reaction', {
      src: check.src,
      timeoutMs: 7000,
      onStopped: () => { check.cancelled = true; },
    });
  };
  return {
    checkingCallbacks(callbacks) {
      clearTimeout(session.current?.timer);
      const check = { cancelled: !audio.enabled, completed: false, ended: false, consumed: false };
      session.current = check;
      return {
        ...callbacks,
        // Repeated waiting/playing events must not extend this indefinitely.
        timeoutMs: 22000,
        onStopped: () => {
          check.cancelled = true;
          clearTimeout(check.timer);
          callbacks.onStopped?.();
        },
        onEnded: () => {
          if (session.current !== check || check.cancelled) return;
          check.ended = true;
          callbacks.onEnded?.();
          start(check);
        },
      };
    },
    reveal() {
      const check = session.current;
      if (!check || check.completed) return;
      check.completed = true;
      check.src = selectQuickCheckerReaction();
      if (check.cancelled) return;
      if (check.ended) start(check);
      else {
        // The normal ending is ~300ms away. Never allow stalled media to
        // resume a voice long after the visitor has seen the result.
        check.timer = setTimeout(() => {
          if (session.current !== check || check.consumed) return;
          check.cancelled = true;
          latestAudio.current.stop();
        }, 1500);
      }
    },
  };
}
