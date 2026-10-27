import { useCallback, useEffect, useState } from 'react';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';

const ACCESS_URL = '/api/santa-workshop-access';
const REQUEST_TIMEOUT = 15000;
const ACCESS_RECHECK_INTERVAL = 60000;

function accessMessage(status, data) {
  if (status === 410) return 'This friends test has ended. Access is no longer available.';
  if (status === 401 || status === 403 || data?.authorized === false) {
    return '';
  }
  return 'Workshop access could not be checked. Please try again.';
}

export default function WorkshopAccessGate({ children }) {
  const [status, setStatus] = useState('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController = null;

    const checkAccess = async () => {
      if (disposed || document.visibilityState === 'hidden' || inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT);

      try {
        const response = await fetch(ACCESS_URL, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (disposed) return;
        if (controller.signal.aborted) {
          if (timedOut) throw new Error('Access check timed out.');
          return;
        }

        if (!response.ok) {
          if ([401, 403, 410].includes(response.status)) {
            setExpiresAt(null);
            setStatusMessage(accessMessage(response.status, data));
            setStatus('locked');
          } else {
            throw new Error(accessMessage(response.status, data));
          }
          return;
        }

        if (data.authorized === false) {
          setExpiresAt(null);
          setStatusMessage(accessMessage(response.status, data));
          setStatus('locked');
          return;
        }

        if (data.authorized !== true || !Number.isFinite(data.expiresAt)
          || data.expiresAt <= Date.now()) {
          if (data.authorized === true && Number.isFinite(data.expiresAt)) {
            setExpiresAt(null);
            setStatusMessage('Your friends test access has expired. Enter a tester code to continue.');
            setStatus('locked');
            return;
          }
          throw new Error('The access service returned an unexpected reply.');
        }

        setExpiresAt(data.expiresAt);
        setStatusMessage('');
        setStatus('authorized');
      } catch (error) {
        if (disposed || (controller.signal.aborted && !timedOut)) return;
        setExpiresAt(null);
        setStatusMessage(timedOut
          ? 'The access check took too long. Please try again.'
          : 'The workshop could not be reached. Check your connection and try again.');
        setStatus('error');
      } finally {
        window.clearTimeout(timeout);
        if (activeController === controller) activeController = null;
        inFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkAccess();
    };
    const onSessionChange = () => checkAccess();

    setStatus(current => current === 'authorized' ? current : 'checking');
    checkAccess();
    const interval = window.setInterval(checkAccess, ACCESS_RECHECK_INTERVAL);
    window.addEventListener('focus', checkAccess);
    window.addEventListener('santa-workshop-access-change', onSessionChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkAccess);
      window.removeEventListener('santa-workshop-access-change', onSessionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      activeController?.abort();
    };
  }, [attempt]);

  useEffect(() => {
    if (status !== 'authorized' || !Number.isFinite(expiresAt)) return undefined;
    const delay = Math.max(0, expiresAt - Date.now());
    const timeout = window.setTimeout(() => {
      setExpiresAt(null);
      setStatusMessage('Your friends test access has expired. Enter a tester code to continue.');
      setStatus('locked');
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [status, expiresAt]);

  const onAuthorized = useCallback(({ expiresAt: authorizationExpiry } = {}) => {
    if (!Number.isFinite(authorizationExpiry) || authorizationExpiry <= Date.now()) {
      setExpiresAt(null);
      setStatusMessage('The access service returned an unexpected reply. Please try again.');
      setStatus('error');
      return;
    }
    setExpiresAt(authorizationExpiry);
    setStatusMessage('');
    setStatus('authorized');
    setAttempt(value => value + 1);
  }, []);

  const metadata = pageMetadata({
    path: '/santa-message-workshop',
    title: 'Santa’s Message Workshop | Santa Radio',
    description: 'Coming soon: a private friends test of Santa’s Message Maker Studio.',
    noindex: true,
  });

  if (status === 'authorized') {
    return <>
      <PageSeo metadata={metadata} />
      {children}
    </>;
  }

  return <main className="workshop-gate">
    <PageSeo metadata={metadata} />
    <section className="workshop-gate-card" aria-labelledby="workshop-gate-title">
      <p className="workshop-dialog-kicker">Coming soon · Private friends test</p>
      <h1 id="workshop-gate-title">Santa’s Message Maker Studio</h1>
      {status === 'checking' ? <p role="status">Checking friends test access…</p> : <>
        <p>Santa’s Message Maker Studio is coming soon. Friends are helping test the workshop.</p>
        {status === 'locked' && statusMessage && <p role="status">{statusMessage}</p>}
        {status === 'error' && <div className="workshop-gate-error" role="alert">
          <p>{statusMessage || 'The workshop could not be reached. Check your connection and try again.'}</p>
          <button type="button" onClick={() => { setStatusMessage(''); setAttempt(value => value + 1); }}>Retry access check</button>
        </div>}
        <WorkshopPasswordForm onAuthorized={onAuthorized} compact />
      </>}
    </section>
  </main>;
}
