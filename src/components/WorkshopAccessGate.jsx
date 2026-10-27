import { useCallback, useEffect, useRef, useState } from 'react';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';

const ACCESS_URL = '/api/santa-workshop-access';
const REQUEST_TIMEOUT = 15000;

export default function WorkshopAccessGate({ children }) {
  const [status, setStatus] = useState('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const authorizedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT);
    setStatus('checking');
    fetch(ACCESS_URL, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const serverMessage = typeof data.error === 'string' ? data.error.trim().slice(0, 240) : '';
        const error = new Error(serverMessage || (response.status === 503
          ? 'Santa’s access service is temporarily unavailable. Please try again.'
          : 'Access could not be checked right now. Please try again.'));
        error.serverResponse = true;
        throw error;
      }
      if (authorizedRef.current) return;
      if (data.authorized === true) {
        authorizedRef.current = true;
        setStatus('authorized');
      } else if (data.authorized === false) {
        setStatus('locked');
      } else {
        throw new Error(typeof data.error === 'string' && data.error.trim()
          ? data.error.trim().slice(0, 240)
          : 'The access service returned an unexpected reply.');
      }
    }).catch(error => {
      if (controller.signal.aborted && !timedOut) return;
      if (!authorizedRef.current) {
        setStatusMessage(timedOut
          ? 'The access check took too long. Please try again.'
          : error.serverResponse
            ? error.message
            : 'The workshop could not be reached. Check your connection and try again.');
        setStatus('error');
      }
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const onAuthorized = useCallback(() => {
    authorizedRef.current = true;
    setStatus('authorized');
  }, []);

  const metadata = pageMetadata({
    path: '/santa-message-workshop',
    title: 'Santa’s Message Workshop | Santa Radio',
    description: 'Private access to Santa’s message workshop.',
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
      <p className="workshop-dialog-kicker">A private North Pole room</p>
      <h1 id="workshop-gate-title">Santa’s message workshop</h1>
      {status === 'checking' ? <p role="status">Checking workshop access…</p> : <>
        <p>Enter the workshop password to continue.</p>
        {status === 'error' && <div className="workshop-gate-error" role="alert">
          <p>{statusMessage || 'The workshop could not be reached. Check your connection and try again.'}</p>
          <button type="button" onClick={() => { setStatusMessage(''); setAttempt(value => value + 1); }}>Retry access check</button>
        </div>}
        <WorkshopPasswordForm onAuthorized={onAuthorized} compact />
      </>}
    </section>
  </main>;
}
