import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveBrowserSantaName } from '../lib/browserSantaNames.js';

const empty = () => ({ choice: null, record: null, records: [], status: 'idle', error: '' });

// Owned by Studio, not the name step: navigation must not restart or cancel
// identity resolution. Display-only choices never become audio capabilities.
export default function useWorkshopNameResolution() {
  const [state, setState] = useState(empty);
  const [touched, setTouched] = useState(false);
  const operation = useRef(null);
  const cancel = useCallback(() => {
    const current = operation.current;
    operation.current = null;
    if (current) {
      clearTimeout(current.timeout);
      current.controller.abort();
    }
  }, []);
  useEffect(() => {
    window.addEventListener('pagehide', cancel);
    return () => { window.removeEventListener('pagehide', cancel); cancel(); };
  }, [cancel]);

  const choose = useCallback(choice => {
    cancel();
    setTouched(true);
    if (!choice) { setState(empty()); return; }
    if (!choice.displayOnly) {
      setState({ choice, record: choice, records: [], status: 'ready', error: '' });
      return;
    }
    setState({ choice, record: null, records: [], status: 'loading', error: '' });
    const current = { controller: new AbortController() };
    operation.current = current;
    current.timeout = setTimeout(() => {
      if (operation.current !== current) return;
      cancel();
      setState({ choice, record: null, records: [], status: 'error',
        error: 'Checking the recording took too long. Please retry.' });
    }, 15000);
    resolveBrowserSantaName(choice.name, { signal: current.controller.signal }).then(records => {
      if (operation.current !== current) return;
      clearTimeout(current.timeout);
      operation.current = null;
      const record = records.length === 1 ? records[0] : null;
      setState({ choice: record || choice, record, records,
        status: record ? 'ready' : 'variants', error: '' });
    }, error => {
      if (operation.current !== current) return;
      clearTimeout(current.timeout);
      operation.current = null;
      setState({ choice, record: null, records: [], status: 'error', error: error.message });
    });
  }, [cancel]);

  return { ...state, touched, choose, retry: () => choose(state.choice) };
}
