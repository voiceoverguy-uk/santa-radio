import { useCallback, useEffect, useRef } from 'react';
import { CHECKER_LAUNCH_MS } from './checkerLogic.js';

// The short click/launch beat precedes the analyser and its recording.
export default function useCheckingPanelDelay() {
  const timer = useRef(null);
  const generation = useRef(0);
  const cancel = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const begin = show => {
    cancel();
    const token = generation.current;
    timer.current = setTimeout(() => {
      if (generation.current === token) show();
    }, CHECKER_LAUNCH_MS);
  };
  return { begin, cancel };
}
