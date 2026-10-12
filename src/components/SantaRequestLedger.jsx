import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../pages/SantaStaffBrowser.css';

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

async function checkResponse(response) {
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  const error = new Error(response.status === 401 ? 'Your staff session could not be confirmed. Please sign in again.'
    : response.status === 403 ? 'Only the verified primary admin@santaradio.co.uk account can access this ledger.'
      : data.error || 'The request ledger could not complete this action. Please retry.');
  error.status = response.status;
  throw error;
}

// Authentication remains in SantaStaffBrowser; every API operation also verifies it.
export default function SantaRequestLedger({ email, onSignOut }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('outstanding');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const actions = useRef(new Map());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; for (const controller of actions.current.values()) controller.abort(); };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => { setPage(1); }, [debouncedQuery, status]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Loading took too long. Please retry.')), 25000);
    let active = true;
    setLoading(true); setError(null); setActionError('');
    const params = new URLSearchParams({ page: String(page), q: debouncedQuery, status });
    fetch(`/api/name-requests?${params}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        await checkResponse(response);
        const data = await response.json();
        if (!Array.isArray(data.requests) || !Number.isSafeInteger(data.total) || data.total < 0 ||
            !Number.isInteger(data.page) || data.page < 1 || data.pageSize !== 100 || data.status !== status ||
            data.requests.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string' ||
              !Number.isSafeInteger(item.count) || item.count < 1 ||
              !Number.isFinite(Date.parse(item.firstRequestedAt)) || !Number.isFinite(Date.parse(item.lastRequestedAt)) ||
              (status === 'completed' && !Number.isFinite(Date.parse(item.recordedAt))))) {
          throw new Error('The request ledger returned an unexpected response. Please retry.');
        }
        return data;
      }).then(data => { if (active) setResult(data); })
      .catch(fetchError => { if (active && fetchError.name !== 'AbortError') setError(fetchError); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [page, debouncedQuery, status, retry]);

  const pageCount = useMemo(() => result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1, [result]);
  const record = async name => {
    if (actions.current.has(name)) return;
    const controller = new AbortController();
    actions.current.set(name, controller);
    const timeout = setTimeout(() => controller.abort(new Error('The recorded action timed out. Please retry safely.')), 25000);
    setPending([...actions.current.keys()]);
    setActionError(''); setNotice('');
    try {
      const response = await fetch('/api/name-requests', { method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, action: 'recorded' }),
        signal: controller.signal });
      await checkResponse(response);
      const data = await response.json();
      if (data.recorded !== true) throw new Error('The recorded action was not confirmed. Please retry.');
      if (alive.current) {
        setNotice(`${name} is recorded and saved in completed history.`);
        setRetry(value => value + 1);
      }
    } catch (failure) {
      if (alive.current && failure.name !== 'AbortError') setActionError(failure.message);
    } finally {
      clearTimeout(timeout);
      actions.current.delete(name);
      if (alive.current) setPending([...actions.current.keys()]);
    }
  };
  const download = async () => {
    if (actions.current.has('download')) return;
    const controller = new AbortController();
    actions.current.set('download', controller);
    const timeout = setTimeout(() => controller.abort(new Error('Downloading took too long. Please retry.')), 25000);
    setDownloading(true); setActionError('');
    try {
      const params = new URLSearchParams({ status, q: debouncedQuery, download: 'txt' });
      const response = await fetch(`/api/name-requests?${params}`, {
        credentials: 'include', cache: 'no-store', signal: controller.signal });
      await checkResponse(response);
      if (!response.headers.get('Content-Type')?.startsWith('text/plain')) throw new Error('The server did not return a TXT list. Please retry.');
      const blob = await response.blob();
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `santa-name-requests-${status}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      if (alive.current && failure.name !== 'AbortError') setActionError(failure.message);
    } finally {
      clearTimeout(timeout);
      actions.current.delete('download');
      if (alive.current) setDownloading(false);
    }
  };

  return <main className="staff-page"><div className="staff-wrap">
    <img className="staff-brand" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />
    <section className="staff-panel" aria-labelledby="ledger-title">
      <div className="staff-account"><span>Signed in as <strong>{email || 'staff account'}</strong></span>
        <button className="staff-text-action" type="button" onClick={onSignOut}>Sign out</button></div>
      <p className="staff-kicker">A quiet little list from the message desk</p>
      <h1 id="ledger-title">Name requests</h1>
      <p className="staff-lede">Outstanding names appear most requested first. Mark a name Recorded after adding its recording.
        This keeps its counts and dates in completed history; it does not upload or change an audio file.</p>
      <div className="staff-list-switch" role="group" aria-label="Request list">
        {['outstanding', 'completed'].map(view => <button key={view} className={`staff-button${status === view ? ' primary' : ''}`}
          type="button" aria-pressed={status === view}
          onClick={() => { setStatus(view); setPage(1); setNotice(''); }}>
          {view === 'outstanding' ? 'Outstanding names' : 'Completed history'}
        </button>)}
      </div>
      {status === 'completed' && <p className="staff-lede">History preserves each completion’s request totals and dates.
        A later new request reopens the name in Outstanding; its earlier history remains here. Duplicate retries do not reopen it.</p>}
      <div className="staff-toolbar">
        <div className="staff-search"><label htmlFor="request-ledger-search">Search requested names</label>
          <input id="request-ledger-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
            placeholder="Type a first name…" autoComplete="off" /></div>
        <button type="button" className="staff-button" onClick={() => setRetry(value => value + 1)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh list'}</button>
        <button type="button" className="staff-button" onClick={download} disabled={loading || !!error || !result || downloading}>
          {downloading ? 'Downloading…' : 'Download TXT'}</button>
      </div>
      {notice && <p className="staff-feedback" role="status">{notice}</p>}
      {actionError && <p className="staff-error" role="alert">{actionError}</p>}
      {loading && <div className="staff-skeleton" role="status" aria-label="Loading name requests"><div className="staff-loading-row" /></div>}
      {!loading && error && <div className="staff-error" role="alert"><p>{error.message}</p>
        {error.status === 401 ? <Link to="/sign-in">Sign in again</Link>
          : error.status === 403 ? <p>Verify that address and make it your primary staff email, then sign in again.</p>
            : <button type="button" className="staff-button" onClick={() => setRetry(value => value + 1)}>Retry loading requests</button>}
      </div>}
      {!loading && !error && result && result.requests.length === 0 && <div className="staff-empty">
        <h2>{debouncedQuery ? 'No names match that search' : status === 'completed' ? 'No completed names yet' : 'The ledger is clear for now'}</h2>
        <p>{debouncedQuery ? 'Try another spelling or clear your search.'
          : status === 'completed' ? 'Names marked Recorded will appear here with their request history.'
            : 'When visitors ask Santa to record a missing name, their requests will appear here.'}</p>
      </div>}
      {!loading && !error && result?.requests.length > 0 && <>
        <div className="staff-table-wrap"><table className="staff-table">
          <caption className="sr-only">{result.total} entries in the {status} list</caption>
          <thead><tr><th scope="col">First name</th><th scope="col">Requests</th><th scope="col">First requested</th>
            <th scope="col">Most recent</th><th scope="col">{status === 'completed' ? 'Recorded on' : 'Action'}</th></tr></thead>
          <tbody>{result.requests.map(item => <tr key={item.id}><td>{item.name}</td>
            <td className="staff-count">{item.count.toLocaleString('en-GB')}</td>
            <td>{formatDate(item.firstRequestedAt)}</td><td>{formatDate(item.lastRequestedAt)}</td>
            <td>{status === 'completed' ? formatDate(item.recordedAt) : <button className="staff-button" type="button"
              aria-label={`Mark ${item.name} recorded`} disabled={pending.includes(item.name)} onClick={() => record(item.name)}>
              {pending.includes(item.name) ? 'Saving…' : 'Recorded'}</button>}</td></tr>)}</tbody>
        </table></div>
        <nav className="staff-pagination" aria-label="Name request pages">
          <span>Page {result.page} of {pageCount} · {result.total.toLocaleString('en-GB')} {result.total === 1 ? 'entry' : 'entries'}</span>
          <div className="staff-pagination-actions">
            <button className="staff-button" type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={result.page <= 1}>Previous</button>
            <button className="staff-button" type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={result.page >= pageCount}>Next</button>
          </div>
        </nav>
      </>}
      <p className="staff-lede">Download TXT includes every matching entry in the selected list, not just this page. Dates on screen use UK time; downloads label UTC dates.</p>
    </section>
  </div></main>;
}
