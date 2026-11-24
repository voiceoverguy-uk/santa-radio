import StudioVoucherSuccess from './StudioVoucherSuccess.jsx';
import { scheduleExpiry } from '../lib/scheduleExpiry.js';
import { useCallback, useEffect, useState } from 'react';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import { useLocation } from 'react-router-dom';
import { StudioAccessContext, StudioVoucherContext } from '../lib/studioAccessContext.js';
import StudioReturnAccess from './StudioReturnAccess.jsx';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import StudioOpeningPicture from './StudioOpeningPicture.jsx';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import '../pages/SantaMessageWorkshop.css';
import './HomepageSantaStudio.css';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import { rememberStudioPurchase } from '../lib/studioPurchaseHint.js';
import StudioPaymentSuccess from './StudioPaymentSuccess.jsx';

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
  const location = useLocation();
  const returningFromCheckout = new URLSearchParams(location.search).get('checkout') === 'return';
  const [accessKind, setAccessKind] = useState('tester');
  const [remaining, setRemaining] = useState(null);
  const [purchaserName, setPurchaserName] = useState('');
  const [voucher, setVoucher] = useState(null);
  const [voucherWelcome, setVoucherWelcome] = useState(() => { try { return sessionStorage.getItem('santa-voucher-welcome') === '1'; } catch { return false; } });
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
        // Always confirm paid access first, including checkout returns, reloads
        // and session-change checks. A stale voucher must not skip reconciliation.
        if (!controller.signal.aborted && !disposed) {
          const paidResponse = await fetch(`/api/santa-studio-access${returningFromCheckout ? '?greeting=1' : ''}`, {
            credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          });
          const paid = await paidResponse.json().catch(() => ({}));
          if (disposed) return;
          if (controller.signal.aborted) {
            if (timedOut) throw new Error('Access check timed out.');
            return;
          }
          if (paidResponse.ok && paid.authorized === true
            && (import.meta.env.DEV ? paid.mode !== 'live' : paid.mode === 'live')) {
            if (paid.mode === 'live') rememberStudioPurchase(paid.remaining !== 0, paid.remaining);
            setAccessKind(paid.mode === 'live' ? 'paid-live' : 'paid-sandbox');
            setRemaining(Number.isInteger(paid.remaining) && paid.remaining >= 0 && paid.remaining <= 2 ? paid.remaining : null);
            setPurchaserName(typeof paid.firstName === 'string' ? paid.firstName.slice(0, 80) : '');
            setVoucher(null);
            setExpiresAt(null);
            setStatusMessage('');
            setStatus('authorized');
            return;
          }
          if (returningFromCheckout) {
            setExpiresAt(null);
            setStatusMessage(paidResponse.ok
              ? 'A successful payment has not been confirmed. Pending, failed or cancelled payments do not open Studio. Retry the check if you have just finished paying.'
              : 'The payment check is temporarily unavailable. Please retry or use your voucher code.');
            setStatus('locked');
            return;
          }
        }
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
        setAccessKind('tester');
        setVoucher(typeof data.voucher?.unlimited === 'boolean'
          ? { unlimited: data.voucher.unlimited } : null);
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
    // Restart rather than dropping a session change while a stale GET is in flight.
    const onSessionChange = () => setAttempt(value => value + 1);

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
  }, [attempt, returningFromCheckout]);

  useEffect(() => {
    if (status !== 'authorized' || !Number.isFinite(expiresAt)) return undefined;
    return scheduleExpiry(expiresAt, () => {
      setExpiresAt(null);
      setStatusMessage('Your friends test access has expired. Enter a tester code to continue.');
      setStatus('locked');
    });
  }, [status, expiresAt]);

  const onAuthorized = useCallback(({ expiresAt: authorizationExpiry } = {}) => {
    if (!Number.isFinite(authorizationExpiry) || authorizationExpiry <= Date.now()) {
      setExpiresAt(null);
      setStatusMessage('The access service returned an unexpected reply. Please try again.');
      setStatus('error');
      return;
    }
    setVoucherWelcome(true);
    // The voucher submission has set its cookie; resolve both access methods
    // before opening the maker instead of momentarily switching a paid visitor.
    setExpiresAt(null);
    setVoucher(null);
    setStatusMessage('');
    setStatus('checking');
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    if (status !== 'locked') return;
    const frame = window.requestAnimationFrame(() => {
      if (location.hash === '#studio-return-access') {
        document.getElementById('studio-return-access')?.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [status, location.hash]);

  const metadata = pageMetadata({
    path: STUDIO_PATH,
    title: 'Santa’s Message Workshop | Santa Radio',
    description: 'Open Santa’s Message Maker Studio with confirmed paid access or a valid voucher.',
    noindex: true,
  });

  if (status === 'authorized') {
    return <>
      <PageSeo metadata={metadata} />
      <StudioAccessContext.Provider value={accessKind}>
        <StudioVoucherContext.Provider value={voucher}>
          {voucherWelcome && accessKind === 'tester' ? <StudioVoucherSuccess onContinue={() => { setVoucherWelcome(false); try { sessionStorage.removeItem('santa-voucher-welcome'); } catch { /* Optional welcome persistence. */ } }} /> : returningFromCheckout && accessKind.startsWith('paid-')
            ? <StudioPaymentSuccess firstName={purchaserName} remaining={remaining} sandbox={accessKind === 'paid-sandbox'} /> : children}
        </StudioVoucherContext.Provider>
      </StudioAccessContext.Provider>
    </>;
  }

  const accessFeedback = <div className="studio-entry-access" aria-label="Studio access">
    {status === 'checking' && <p role="status">Checking Studio access…</p>}
    {status === 'locked' && statusMessage && <p role="status">{statusMessage}</p>}
    {status === 'locked' && returningFromCheckout &&
      <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry payment check</button>}
    {status === 'error' && <div className="workshop-gate-error" role="alert">
      <p>{statusMessage || 'The workshop could not be reached. Check your connection and try again.'}</p>
      <button type="button" onClick={() => { setStatusMessage(''); setAttempt(value => value + 1); }}>Retry access check</button>
    </div>}
  </div>;

  if (status === 'checking' || status === 'error') {
    return <main className="workshop-gate workshop-gate--promotion">
      <PageSeo metadata={metadata} />
      <section className="container studio-entry-loading" aria-label="Opening your Studio">
        <h1>Santa’s Message Maker Studio</h1>
        {accessFeedback}
      </section>
    </main>;
  }

  return <main className="smw-page kids-studio-welcome">
    <PageSeo metadata={metadata} />
    <div className="smw-shell">
      <header className="kids-welcome-heading">
        <p className="smw-section-kicker">A WORD FROM THE NORTH POLE</p>
        <h1>Kids’ Message Maker Studio</h1>
        <p>Imagine their face when Santa knows their name.</p>
        <p>A magical, personalised message from Santa celebrating their achievements, their favourite things and the little details that make them special.</p>
      </header>
      <section className="smw-builder kids-welcome-layout" aria-label="Kids’ recording studio">
        <div className="smw-start-artwork kids-welcome-art">
          <img className="smw-start-logo" src="/images/kids-message-logo-v1.webp" alt="Kids’ Message from Santa" width="1200" height="668" />
          <StudioOpeningPicture caption="Ready to make some Christmas magic?" />
        </div>
        <div className="kids-welcome-panel">
          <p className="smw-start-kicker">The North Pole Recording Studio</p>
          <h2>Two magical messages.<br />Made just for them.</h2>
          <p>£6.50 includes two personalised message creations, your choice of six Christmas scenes and three digital gifts for each creation: a Nice List certificate, a personalised letter from Santa and a Santa picture with their name.</p>
          <p>Watch, download and share your personalised videos. Create both now or save one for later.</p>
          {accessFeedback}
          <StudioPurchaseButton label="Create their Santa magic — £6.50" hideReturnLink />
          <div className="kids-welcome-return"><StudioReturnAccess collapsible /></div>
          <details className="kids-welcome-voucher">
            <summary>Friend or Guest?</summary>
            <p>DISCOUNT CODES are entered at Stripe checkout.</p>
            <WorkshopPasswordForm onAuthorized={onAuthorized} compact friendGuest />
          </details>
        </div>
      </section>
    </div>
  </main>;
}
