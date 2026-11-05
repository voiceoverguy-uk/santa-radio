import { useCallback, useEffect, useRef } from 'react';

const PANEL_DELAY_MS = 500;

// The introductory beat follows playback position, not network loading time.
export default function useCheckingPanelDelay() {
  const timer = useRef(null);
  const generation = useRef(0);
  const cancel = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const begin = (callbacks, show, waitForAudio) => {
    cancel();
    const token = generation.current;
    let shown = false;
    let position = 0;
    const current = () => generation.current === token;
    const reveal = () => {
      if (!current() || shown) return;
      shown = true;
      clearTimeout(timer.current);
      show();
    };
    const fallback = () => {
      if (!current() || shown) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(reveal, Math.max(0, PANEL_DELAY_MS - position * 1000));
    };
    if (!waitForAudio) fallback();
    return {
      ...callbacks,
      onStarted: media => {
        if (!current()) return;
        clearTimeout(timer.current);
        callbacks.onStarted?.(media);
      },
      onProgress: media => {
        if (!current()) return;
        position = media.currentTime;
        if (position * 1000 >= PANEL_DELAY_MS) reveal();
        callbacks.onProgress?.(media);
      },
      onStopped: () => {
        if (!current()) return;
        callbacks.onStopped?.();
        fallback();
      },
    };
  };
  return { begin, cancel };
}
