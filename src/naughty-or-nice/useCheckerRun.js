import { useCallback, useEffect, useRef, useState } from 'react';
import { REVEAL_LEAD_MS } from './checkerLogic.js';

// Let 00 remain visible for the final beat before the media-driven reveal.
const displaySeconds = milliseconds => milliseconds <= 350 ? 0 : Math.ceil(milliseconds / 1000);

// One active run per experience. Cancelling invalidates even a queued callback.
export default function useCheckerRun() {
  const timer = useRef(null);
  const countdown = useRef(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
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
    setElapsedMs(0);
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
    setSecondsRemaining(displaySeconds(duration));
    setElapsedMs(0);
    countdown.current = setInterval(() => {
      const check = completion.current;
      if (generation.current === token && check && !check.mediaActive) {
        setSecondsRemaining(displaySeconds(Math.max(0, check.deadline - Date.now())));
        setElapsedMs(Math.max(0, check.duration - (check.deadline - Date.now())));
      }
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
        setSecondsRemaining(displaySeconds(remaining));
        setElapsedMs(Math.max(0, (media?.currentTime || 0) * 1000));
        clearTimeout(timer.current);
        // Audio time can advance differently from wall time (buffering,
        // suspended tabs or output-device delays). Reveal from media position.
        timer.current = setTimeout(check.finish, remaining + 15000);
      },
      onProgress: media => {
        const check = current();
        if (check && Number.isFinite(media.duration)) {
          const remaining = Math.max(0, media.duration - media.currentTime - revealLeadMs / 1000);
          setSecondsRemaining(displaySeconds(remaining * 1000));
          setElapsedMs(Math.max(0, media.currentTime * 1000));
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
  return { run, cancel, audioCallbacks, secondsRemaining, elapsedMs };
}
