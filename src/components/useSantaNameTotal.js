import { useEffect, useState } from 'react';

const REFRESH_MS = 5 * 60_000;
const TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

// No search term, catalogue, credentials or persistent browser storage.
export default function useSantaNameTotal() {
  const [total, setTotal] = useState(null);
  useEffect(() => {
    let disposed = false;
    let controller;
    let nextAttemptAt = 0;
    let failures = 0;
    let timer;
    const schedule = delay => {
      clearTimeout(timer);
      nextAttemptAt = Date.now() + delay;
      timer = setTimeout(() => void refresh(), delay);
    };
    const refresh = async () => {
      if (disposed || controller || document.visibilityState === 'hidden') return;
      controller = new AbortController();
      const request = controller;
      let retryAfter = 0;
      const timeout = setTimeout(() => request.abort(), TIMEOUT_MS);
      try {
        const response = await fetch('/api/santa-name-count', {
          signal: request.signal, credentials: 'omit', cache: 'no-store',
        });
        if (response.status === 429 || response.status === 503) {
          const value = response.headers.get('Retry-After');
          if (value) retryAfter = /^\d+$/.test(value)
            ? Number(value) * 1000 : Math.max(0, Date.parse(value) - Date.now()) || 0;
        }
        const data = await response.json();
        if (!response.ok || !data || Object.keys(data).length !== 1 ||
            !Number.isSafeInteger(data.total) || data.total < 0) {
          throw new Error('Recorded-name total unavailable.');
        }
        if (!disposed && !request.signal.aborted) {
          setTotal(data.total);
          failures = 0;
          schedule(REFRESH_MS);
        }
      } catch {
        // No guessed or stale number when the inventory cannot be verified.
        if (!disposed) {
          setTotal(null);
          const delay = RETRY_DELAYS_MS[Math.min(failures++, RETRY_DELAYS_MS.length - 1)];
          schedule(Math.max(delay, retryAfter));
        }
      } finally {
        clearTimeout(timeout);
        if (controller === request) controller = null;
      }
    };
    const refreshIfDue = () => {
      if (Date.now() >= nextAttemptAt) void refresh();
    };
    void refresh();
    document.addEventListener('visibilitychange', refreshIfDue);
    window.addEventListener('online', refreshIfDue);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshIfDue);
      window.removeEventListener('online', refreshIfDue);
    };
  }, []);
  return total;
}
