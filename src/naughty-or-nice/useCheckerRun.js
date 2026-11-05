import { useCallback, useEffect, useRef, useState } from 'react';
import { REVEAL_LEAD_MS } from './checkerLogic.js';

// One active run per experience. Cancelling invalidates even a queued callback.
export default function useCheckerRun() {
  const timer = useRef(null);
  const countdown = useRef(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const generation = useRef(0);
  const running = useRef(false);
  const completion = useRef(null);
  const cancel = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    clearInterval(countdown.current);
    timer.current = null;
    countdown.current = null;
    running.current = false;
    completion.current = null;
    setSecondsRemaining(0);
  }, []);
  useEffect(() => cancel, [cancel]);
  const run = (duration, complete) => {
    if (running.current) return false;
    running.current = true;
    const token = ++generation.current;
    const finish = () => {
      if (generation.current !== token) return;
      cancel();
      complete();
    };
    completion.current = { duration, deadline: Date.now() + duration, finish, mediaActive: false };
    setSecondsRemaining(Math.ceil(duration / 1000));
    countdown.current = setInterval(() => {
      const check = completion.current;
      if (generation.current === token && check && !check.mediaActive)
        setSecondsRemaining(Math.max(0, Math.ceil((check.deadline - Date.now()) / 1000)));
    }, 100);
    timer.current = setTimeout(finish, duration);
    return true;
  };
  const audioCallbacks = (revealLeadMs = REVEAL_LEAD_MS) => {
    const token = generation.current;
    const current = () => generation.current === token ? completion.current : null;
    return {
      onStarted: media => {
        const check = current();
        if (!check) return;
        const remaining = Number.isFinite(media?.duration)
          ? Math.max(0, (media.duration - media.currentTime) * 1000 - revealLeadMs)
          : check.duration;
        check.deadline = Date.now() + remaining;
        check.mediaActive = true;
        setSecondsRemaining(Math.ceil(remaining / 1000));
        clearTimeout(timer.current);
        // Audio time can advance differently from wall time (buffering,
        // suspended tabs or output-device delays). Reveal from media position.
        timer.current = setTimeout(check.finish, remaining + 15000);
      },
      onProgress: media => {
        const check = current();
        if (check && Number.isFinite(media.duration)) {
          const remaining = Math.max(0, media.duration - media.currentTime - revealLeadMs / 1000);
          setSecondsRemaining(Math.ceil(remaining));
          if (remaining <= 0) check.finish();
        }
      },
      onWaiting: () => {
        const check = current();
        if (!check) return;
        clearTimeout(timer.current);
        // Resume timing from the media position when playback resumes.
        // A permanently stalled browser still has a bounded fallback.
        timer.current = setTimeout(check.finish, check.duration + 15000);
      },
      onEnded: () => { current()?.finish(); },
      onStopped: () => {
        const check = current();
        if (!check) return;
        check.mediaActive = false;
        clearTimeout(timer.current);
        timer.current = setTimeout(check.finish, Math.max(0, check.deadline - Date.now()));
      },
    };
  };
  return { run, cancel, audioCallbacks, secondsRemaining };
}
