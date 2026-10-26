import { useEffect, useState } from 'react';

// Reuse the public inventory on immediate SPA navigation after signup. Never
// cache recipient queries, errors or local-only fallback totals.
let publicInventory = null;

export default function useSantaNames(query, enabled) {
  const [retry, setRetry] = useState(0);
  const [hostedCount, setHostedCount] = useState(null);
  const [state, setState] = useState({ query: '', records: [], loading: true, warning: '', error: '' });
  // The empty-query inventory supplies the public total. Name selection stays
  // gated, and unlocking an empty form reuses this request rather than refetching.
  const input = enabled ? query.trim() : '';
  useEffect(() => {
    if (!input && retry === 0 && publicInventory && Date.now() - publicInventory.at < 60_000) {
      setHostedCount(publicInventory.data.hostedCount);
      setState({ query: input, records: publicInventory.data.records, loading: false, warning: '', error: '' });
      return;
    }
    const controller = new AbortController();
    let fetchTimer;
    setState({ query: input, records: [], loading: true, warning: '', error: '' });
    const timer = setTimeout(async () => {
      fetchTimer = setTimeout(() => {
        controller.abort();
        publicInventory = null;
        setHostedCount(null);
        setState({ query: input, records: [], loading: false, warning: '',
          error: 'The name search took too long. Please try again.' });
      }, 15_000);
      try {
        const response = await fetch(`/api/santa-names?q=${encodeURIComponent(input)}`, {
          signal: controller.signal, cache: 'no-store',
        });
        const data = await response.json().catch(() => {
          throw new Error('The name list could not be loaded. Please try again.');
        });
        if (!response.ok) throw new Error(data.error || 'The name list could not be loaded. Please try again.');
        if (!Array.isArray(data.records) || data.records.some(record =>
          typeof record.id !== 'string' || typeof record.name !== 'string' ||
          typeof record.downloadName !== 'string') ||
          (data.warning !== null && typeof data.warning !== 'string')) throw new Error('The name list could not be loaded. Please try again.');
        if (!controller.signal.aborted) {
          if (data.warning || !Number.isSafeInteger(data.hostedCount) || data.hostedCount < 0) publicInventory = null;
          if (!input && !data.warning && Number.isSafeInteger(data.hostedCount) && data.hostedCount >= 0) {
            publicInventory = { at: Date.now(), data };
          }
          setHostedCount(!data.warning && Number.isSafeInteger(data.hostedCount) && data.hostedCount >= 0
            ? data.hostedCount : null);
          setState({ query: input, records: data.records, loading: false, warning: data.warning || '', error: '' });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          publicInventory = null;
          setHostedCount(null);
          setState({ query: input, records: [], loading: false, warning: '', error: error.message });
        }
      } finally { clearTimeout(fetchTimer); }
    }, input ? 180 : 0);
    return () => { clearTimeout(timer); clearTimeout(fetchTimer); controller.abort(); };
  }, [input, retry]);
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') setRetry(value => value + 1);
    };
    // Longer than the server's inventory TTL, so new uploads are picked up.
    const timer = setInterval(refreshVisible, 75_000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, []);
  const current = state.query === input;
  return {
    ...state, hostedCount, records: enabled && current ? state.records : [],
    loading: !current || state.loading,
    warning: current ? state.warning : '', error: current ? state.error : '',
    refresh: () => setRetry(value => value + 1),
  };
}
