import { useEffect, useState } from 'react';

// The announced opening is midnight UK time (GMT in November).
export const SANTA_STUDIO_LAUNCH_TIME = Date.parse('2026-11-06T00:00:00Z');

export default function useSantaStudioLaunch() {
  // Match SSR on the first browser render; never imply access before opening.
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0,
      Math.ceil((SANTA_STUDIO_LAUNCH_TIME - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return { remaining, prelaunch: remaining !== 0 };
}
