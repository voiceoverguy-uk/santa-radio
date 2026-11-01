import { useEffect, useState } from 'react';

const REFRESH_MS = 5 * 60_000;
const TIMEOUT_MS = 15_000;

// No search term, catalogue, credentials or persistent browser storage.
export default function useSantaNameTotal() {
  const [total, setTotal] = useState(null);
  useEffect(() => {
    let disposed = false;
    let controller;
    let attemptedAt = 0;
    const refresh = async () => {
      if (disposed || controller || document.visibilityState === 'hidden') return;
      attemptedAt = Date.now();
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), TIMEOUT_MS);
      try {
        const response = await fetch('/api/santa-name-count', {
          signal: request.signal, credentials: 'omit', cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data || Object.keys(data).length !== 1 ||
            !Number.isSafeInteger(data.total) || data.total < 0) {
          throw new Error('Recorded-name total unavailable.');
        }
        if (!disposed && !request.signal.aborted) setTotal(data.total);
      } catch {
        // No guessed or stale number when the inventory cannot be verified.
        if (!disposed) setTotal(null);
      } finally {
        clearTimeout(timeout);
        if (controller === request) controller = null;
      }
    };
    const refreshIfDue = () => {
      if (Date.now() - attemptedAt >= REFRESH_MS) void refresh();
    };
    void refresh();
    const timer = setInterval(refreshIfDue, REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfDue);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfDue);
    };
  }, []);
  return total;
}
