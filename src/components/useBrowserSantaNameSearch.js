import { useEffect, useMemo, useState } from 'react';
import { isBlockedName } from '../lib/nameLanguage.js';
import { loadBrowserSantaNames, matchBrowserSantaNames } from '../lib/browserSantaNames.js';

export default function useBrowserSantaNameSearch(query) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ names: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ names: [], loading: true, error: '' });
    loadBrowserSantaNames().then(names => {
      if (active) setState({ names, loading: false, error: '' });
    }, error => {
      if (active) setState({ names: [], loading: false,
        error: error.name === 'AbortError' ? 'Loading names took too long. Please retry.' : error.message });
    });
    return () => { active = false; };
  }, [attempt]);
  const blocked = isBlockedName(query);
  const records = useMemo(() => blocked ? [] : matchBrowserSantaNames(state.names, query),
    [state.names, query, blocked]);
  return { records, blocked, hostedCount: null, warning: '', error: state.error,
    loading: !blocked && [...query.trim()].length >= 2 && state.loading,
    refresh: () => setAttempt(value => value + 1) };
}
