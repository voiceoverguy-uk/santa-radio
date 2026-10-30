import { useEffect, useState } from 'react';
import { santaNameKey } from '../lib/santaNameSearch.js';
import { santaMessageDownloadName } from '../data/santaMessages.js';

// Fetch the existing public hosted inventory, never a recipient query. Keep it
// in component memory only: no names typed by visitors go into URLs or storage.
export default function useHostedSantaNameSearch(query, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ records: [], hostedCount: null, loading: true, error: '' });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    setState({ records: [], hostedCount: null, loading: true, error: '' });
    (async () => {
      try {
        const response = await fetch('/api/santa-names?inventory=hosted', {
          signal: controller.signal, cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || data.warning || !Array.isArray(data.records) ||
            !Number.isSafeInteger(data.hostedCount) || data.hostedCount < 0 ||
            data.records.some(record => typeof record.id !== 'string' || !record.id ||
              typeof record.name !== 'string' || !record.name.trim())) {
          throw new Error('Invalid hosted inventory');
        }
        if (!controller.signal.aborted) setState({
          records: data.records.map(record => ({ ...record, downloadName: santaMessageDownloadName(record.name) })),
          hostedCount: data.hostedCount, loading: false, error: '',
        });
      } catch {
        if (!controller.signal.aborted || timedOut) setState({
          records: [], hostedCount: null, loading: false,
          error: timedOut ? 'The name search took too long. Please try again.'
            : 'Santa’s name list is temporarily unavailable. Please try again.',
        });
      } finally { clearTimeout(timeout); }
    })();
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [enabled, attempt]);
  const key = santaNameKey(query);
  return {
    ...state, warning: '',
    records: key ? state.records.filter(record => santaNameKey(record.name).startsWith(key)).slice(0, 20) : [],
    refresh: () => setAttempt(value => value + 1),
  };
}
