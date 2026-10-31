import { useEffect, useRef, useState } from 'react';
import { santaMessageDownloadName } from '../lib/santaMessageDownloadName.js';

// Recipient input is sent in a private POST body, never in URLs or storage.
// Only the current, bounded result set lives in component memory.
export default function useHostedSantaNameSearch(query, enabled = true) {
  const input = enabled ? query.trim() : '';
  const [attempt, setAttempt] = useState(0);
  const fetchedAt = useRef(0);
  const [state, setState] = useState({ query: '', records: [], loading: false, error: '' });
  useEffect(() => {
    if (!enabled || [...input].length < 2) {
      setState({ query: input, records: [], loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    let timeout;
    let timedOut = false;
    setState({ query: input, records: [], loading: true, error: '' });
    const timer = setTimeout(async () => {
      timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
      try {
        const response = await fetch('/api/santa-names', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input }), signal: controller.signal,
          credentials: 'same-origin', cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The name search is temporarily unavailable.');
        if (!Array.isArray(data.records) || data.records.length > 10 ||
            data.records.some(record => typeof record.id !== 'string' || typeof record.name !== 'string' ||
              typeof record.selectionToken !== 'string' || typeof record.previewUrl !== 'string')) {
          throw new Error('The name search returned an invalid response. Please retry.');
        }
        if (!controller.signal.aborted) {
          fetchedAt.current = Date.now();
          setState({
            query: input, records: data.records.map(record => ({ ...record, downloadName: santaMessageDownloadName(record.name) })),
            loading: false, warning: data.warning || '', error: '',
          });
        }
      } catch (error) {
        if (!controller.signal.aborted || timedOut) setState({
          query: input, records: [], loading: false, error: timedOut
            ? 'The name search took too long. Please try again.'
            : error.message || 'Santa’s name search is temporarily unavailable. Please try again.',
        });
      } finally { clearTimeout(timeout); }
    }, 200);
    return () => { clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [input, enabled, attempt]);
  useEffect(() => {
    if (!enabled || [...input].length < 2) return;
    const refreshExpired = () => {
      if (document.visibilityState === 'visible' && Date.now() - fetchedAt.current >= 4 * 60_000) {
        setAttempt(value => value + 1);
      }
    };
    const timer = setInterval(refreshExpired, 4 * 60_000);
    document.addEventListener('visibilitychange', refreshExpired);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshExpired);
    };
  }, [input, enabled]);
  const current = state.query === input;
  return {
    ...state, hostedCount: null,
    records: current && enabled ? state.records : [],
    loading: [...input].length >= 2 && (!current || state.loading),
    error: current ? state.error : '', warning: current ? state.warning || '' : '',
    refresh: () => setAttempt(value => value + 1),
  };
}
