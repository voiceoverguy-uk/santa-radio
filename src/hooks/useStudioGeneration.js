import { useCallback, useEffect, useRef, useState } from 'react';

export default function useStudioGeneration(onRestore) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const seen = useRef(-1);
  const alive = useRef(true);
  const latestRequest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const response = await fetch('/api/santa-studio-message', {
        credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Your message allowance could not be checked. Please try again.');
      const data = await response.json();
      if (!Number.isInteger(data.successes) || data.successes < 0 || data.successes > 2
        || data.remaining !== 2 - data.successes) throw new Error('Your message allowance could not be checked.');
      if (!alive.current || request !== latestRequest.current || data.successes < seen.current) return null;
      if (data.successes > seen.current) {
        if (data.successes > 0) restore.current(data);
        seen.current = data.successes;
      }
      setState(data);
      setError('');
      return data;
    } catch (failure) {
      if (alive.current && request === latestRequest.current) setError(failure.message);
      return null;
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', visible);
    window.addEventListener('pageshow', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', visible);
      window.removeEventListener('pageshow', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!state?.pending) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [state?.pending, refresh]);
  return { state, error, refresh };
}
