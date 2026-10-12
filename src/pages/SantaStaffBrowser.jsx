import { useEffect, useMemo, useState } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Link, useNavigate } from 'react-router-dom';
import './SantaStaffBrowser.css';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  options: {
    logoPlacement: 'inside',
    logoLinkUrl: '/',
    logoImageUrl: `${window.location.origin}/images/santa-radio-logo.png`,
  },
  variables: {
    colorPrimary: '#8d2026',
    colorForeground: '#173629',
    colorMutedForeground: '#526457',
    colorDanger: '#a12b2b',
    colorBackground: '#f5efdf',
    colorInput: '#fffaf0',
    colorInputForeground: '#173629',
    colorNeutral: '#c5b78e',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '10px',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: { width: '100%', maxWidth: '430px', background: '#f5efdf', borderRadius: '16px', overflow: 'hidden', boxShadow: 'none' },
    logoImage: { width: '220px', maxWidth: '100%', height: 'auto', objectFit: 'contain', background: '#0c2a20', borderRadius: '8px', padding: '5px 18px', boxSizing: 'border-box' },
    card: { background: 'transparent', boxShadow: 'none', border: '0' },
    footer: { background: 'transparent', boxShadow: 'none', border: '0' },
    headerTitle: { color: '#173629', fontFamily: 'Cinzel, serif', fontWeight: 400 },
    headerSubtitle: { color: '#526457' },
    formFieldLabel: { color: '#173629', fontWeight: 500 },
    formFieldInput: { background: '#fffaf0', color: '#173629', borderColor: '#c5b78e' },
    formButtonPrimary: { background: '#8d2026', color: '#fff8e7', boxShadow: 'none' },
    footerActionText: { color: '#526457' },
    footerActionLink: { color: '#8d2026' },
    dividerText: { color: '#526457' },
    socialButtonsBlockButtonText: { color: '#173629' },
    alertText: { color: '#8d2026' },
    formFieldSuccessText: { color: '#28633f' },
  },
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function StaffBrand() {
  return <img className="staff-brand" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />;
}

function AuthPage({ mode }) {
  const signup = mode === 'sign-up';
  return <main className="staff-page">
    <div className="staff-wrap staff-auth">
      <section className="staff-panel" aria-labelledby="staff-auth-title">
        <p className="staff-kicker">Santa Radio · staff access</p>
        <h1 id="staff-auth-title">{signup ? 'Create your staff account' : 'Welcome back'}</h1>
        <p className="staff-lede">{signup
          ? 'Create an account using an email address you can verify. Approved access to the request ledger is granted by the server.'
          : 'Sign in to continue to the private North Pole name-request ledger.'}</p>
        {signup
          ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/request-names" />
          : <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/request-names" />}
        <p className="staff-lede" style={{ margin: '18px 0 0', fontSize: '.8rem' }}>
          {signup ? <>Already have a staff account? <Link to="/sign-in">Sign in</Link>.</> : <>Need an account? <Link to="/sign-up">Create one</Link>.</>}
          {' '}<Link to="/">Return to Santa Radio</Link>
        </p>
      </section>
    </div>
  </main>;
}

function AdminLanding() {
  return <main className="staff-page">
    <div className="staff-wrap staff-auth">
      <StaffBrand />
      <section className="staff-panel" aria-labelledby="ledger-welcome-title">
        <p className="staff-kicker">Santa Radio · staff access</p>
        <h1 id="ledger-welcome-title">The North Pole request ledger</h1>
        <p className="staff-lede">A private list of first names visitors have asked Santa to record. Sign in to view requests. The server verifies staff approval before sharing the ledger.</p>
        <p><Link className="staff-button primary" to="/sign-in">Sign in to view requests</Link></p>
        <p className="staff-lede" style={{ margin: '18px 0 0', fontSize: '.8rem' }}>Approved owner? <Link to="/sign-up">Create an account</Link> with your verified email address.</p>
      </section>
    </div>
  </main>;
}

function RequestLedger() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => { setPage(1); }, [debouncedQuery]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setResult(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), q: debouncedQuery });
    fetch(`/api/name-requests?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        const authError = new Error('Your staff session could not be confirmed. Please sign in again.');
        authError.status = 401;
        throw authError;
      }
      if (response.status === 403) {
        const approvalError = new Error('This account is not approved to view Santa name requests. Please sign in with the approved verified email.');
        approvalError.status = 403;
        throw approvalError;
      }
      if (!response.ok) throw new Error(data.error || 'The request ledger could not be loaded.');
      if (!Array.isArray(data.requests) || !Number.isSafeInteger(data.total) || data.total < 0 ||
        !Number.isInteger(data.page) || data.page < 1 || data.pageSize !== 100 ||
        data.requests.some(item => !item || typeof item.name !== 'string' ||
          !Number.isSafeInteger(item.count) || item.count < 1 || typeof item.firstRequestedAt !== 'string' ||
          typeof item.lastRequestedAt !== 'string')) {
        throw new Error('The request ledger returned an unexpected response. Please retry.');
      }
      return data;
    }).then(data => {
      if (active) setResult(data);
    }).catch(fetchError => {
      if (active && fetchError.name !== 'AbortError') setError(fetchError);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [isLoaded, isSignedIn, page, debouncedQuery, retry]);

  const pageCount = useMemo(() => result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1, [result]);

  if (!isLoaded) return <main className="staff-page"><div className="staff-wrap">
    <section className="staff-panel staff-skeleton" aria-label="Loading staff access">
      <div className="staff-loading-row" /><div className="staff-loading-row" /><div className="staff-loading-row" />
      <p className="sr-only" role="status">Checking staff sign-in…</p>
    </section>
  </div></main>;
  if (!isSignedIn) return <AdminLanding />;

  return <main className="staff-page">
    <div className="staff-wrap">
      <StaffBrand />
      <section className="staff-panel" aria-labelledby="ledger-title">
        <div className="staff-account">
          <span>Signed in as <strong>{user?.primaryEmailAddress?.emailAddress || 'staff account'}</strong></span>
          <button className="staff-text-action" type="button" onClick={() => signOut({ redirectUrl: '/' })}>Sign out</button>
        </div>
        <p className="staff-kicker">A quiet little list from the message desk</p>
        <h1 id="ledger-title">Name requests</h1>
        <p className="staff-lede">Requests visitors have made for names not found in Santa’s hosted recordings. Search or page through the live list; nothing here changes a recording.</p>
        <div className="staff-toolbar">
          <div className="staff-search">
            <label htmlFor="request-ledger-search">Search requested names</label>
            <input id="request-ledger-search" type="search" value={query}
              onChange={event => { setQuery(event.target.value); setPage(1); }}
              placeholder="Type a first name…" autoComplete="off" />
          </div>
          <button type="button" className="staff-button" onClick={() => setRetry(value => value + 1)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh list'}
          </button>
        </div>
        {loading && <div className="staff-skeleton" role="status" aria-label="Loading name requests">
          <div className="staff-loading-row" /><div className="staff-loading-row" /><div className="staff-loading-row" />
        </div>}
        {!loading && error && <div className="staff-error" role="alert">
          <p>{error.message}</p>
          {error.status === 401 && <p><Link to="/sign-in">Sign in again</Link> to continue.</p>}
          {error.status === 403 && <p>Only the server can approve access. If you believe this is an error, check that you signed in with the approved email.</p>}
          {error.status !== 401 && error.status !== 403 && <button type="button" className="staff-button" onClick={() => setRetry(value => value + 1)}>Retry loading requests</button>}
        </div>}
        {!loading && !error && result && result.requests.length === 0 && <div className="staff-empty">
          <h2>{debouncedQuery ? 'No names match that search' : 'The ledger is clear for now'}</h2>
          <p>{debouncedQuery ? 'Try another spelling or clear your search.' : 'When visitors ask Santa to record a missing name, their requests will appear here.'}</p>
        </div>}
        {!loading && !error && result && result.requests.length > 0 && <>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <caption className="sr-only">{result.total} requested names in the North Pole ledger</caption>
              <thead><tr><th scope="col">First name</th><th scope="col">Requests</th><th scope="col">First requested</th><th scope="col">Most recent</th></tr></thead>
              <tbody>{result.requests.map((request, index) => <tr key={`${request.name}-${index}`}>
                <td>{request.name}</td>
                <td className="staff-count">{request.count.toLocaleString('en-GB')}</td>
                <td>{formatDate(request.firstRequestedAt)}</td>
                <td>{formatDate(request.lastRequestedAt)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <nav className="staff-pagination" aria-label="Name request pages">
            <span>Page {result.page} of {pageCount} · {result.total.toLocaleString('en-GB')} {result.total === 1 ? 'name' : 'names'}</span>
            <div className="staff-pagination-actions">
              <button className="staff-button" type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={loading || result.page <= 1}>Previous</button>
              <button className="staff-button" type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={loading || result.page >= pageCount}>Next</button>
            </div>
          </nav>
        </>}
      </section>
    </div>
  </main>;
}

function BrowserStaffPage({ mode }) {
  const navigate = useNavigate();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl="/sign-in"
    signUpUrl="/sign-up"
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in for Santa Radio staff access' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Use your verified staff email address' } },
    }}
    routerPush={to => navigate(to)}
    routerReplace={to => navigate(to, { replace: true })}
  >
    {mode === 'sign-in' || mode === 'sign-up'
      ? <AuthPage mode={mode} />
      : <RequestLedger />}
  </ClerkProvider>;
}

export default function SantaStaffBrowser({ mode }) {
  return <BrowserStaffPage mode={mode} />;
}
