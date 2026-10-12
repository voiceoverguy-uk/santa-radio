import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './SantaStaffShell.css';

export default function SantaStaffShell({ mode }) {
  const [BrowserPage, setBrowserPage] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    import('../pages/SantaStaffBrowser.jsx')
      .then(module => { if (active) setBrowserPage(() => module.default); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [retry]);

  const head = <Helmet><title>{mode === 'admin' ? 'Santa name requests' : 'Staff sign in'} | Santa Radio</title><meta name="robots" content="noindex, nofollow" /></Helmet>;
  if (BrowserPage) return <>{head}<BrowserPage mode={mode} /></>;
  return <main className="santa-staff-shell">
    {head}
    <section className="santa-staff-loading" aria-labelledby="santa-staff-loading-title">
      <img className="santa-staff-logo" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />
      <h1 id="santa-staff-loading-title">{mode === 'admin' ? 'The North Pole request ledger' : mode === 'sign-up' ? 'Join Santa Radio' : 'Staff sign in'}</h1>
      {failed ? <>
        <p role="alert">The secure staff sign-in could not load. Please try again, or return to Santa Radio.</p>
        <button className="staff-text-action" type="button" onClick={() => { setBrowserPage(null); setRetry(value => value + 1); }}>Try loading sign-in again</button>
        <p><Link to="/">Return to Santa Radio</Link></p>
      </> : <>
        <p>Opening the secure North Pole desk…</p>
        <div className="santa-staff-wait" aria-hidden="true" />
        <p className="sr-only" role="status">Loading secure staff access.</p>
      </>}
    </section>
  </main>;
}
