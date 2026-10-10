import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CONSENT_KEY, LEGACY_CONSENT_KEY, CONSENT_DURATION, SETTINGS_EVENT,
  readConsentRecord, savedConsent, saveConsent,
} from '../privacy/cookieConsent.js';
import { trackPageView, revokeMarketing } from '../privacy/marketingConsent.js';
import { trackAnalyticsPageView, revokeAnalytics } from '../privacy/googleAnalytics.js';
import './MarketingConsent.css';

export default function MarketingConsent() {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const heading = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    const stored = savedConsent();
    setChoice(stored);
    setDraft({ analytics: stored?.analytics === true, marketing: stored?.marketing === true });
    setReady(true);
    const open = () => {
      opener.current = document.activeElement;
      setSettingsOpen(true);
    };
    const synchronise = event => {
      if ([CONSENT_KEY, LEGACY_CONSENT_KEY, null].includes(event.key)) {
        const next = event.key === null ? null : event.key === CONSENT_KEY
          ? readConsentRecord(event.newValue) : savedConsent();
        if (!next?.marketing) revokeMarketing();
        if (!next?.analytics) revokeAnalytics();
        setChoice(next);
        setDraft({ analytics: next?.analytics === true, marketing: next?.marketing === true });
      }
    };
    window.addEventListener(SETTINGS_EVENT, open);
    window.addEventListener('storage', synchronise);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, open);
      window.removeEventListener('storage', synchronise);
    };
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      setDraft({ analytics: choice?.analytics === true, marketing: choice?.marketing === true });
      heading.current?.focus();
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (!ready) return;
    if (choice?.marketing) trackPageView(pathname);
    else revokeMarketing();
    if (choice?.analytics) trackAnalyticsPageView(pathname);
    else revokeAnalytics();
  }, [ready, choice, pathname]);

  useEffect(() => {
    if (!ready || choice === null || storageWarning) return;
    let timer;
    {
      const checkExpiry = () => {
        const remaining = choice.savedAt + CONSENT_DURATION - Date.now();
        if (remaining <= 0) {
          revokeMarketing();
          revokeAnalytics();
          setChoice(null);
          setDraft({ analytics: false, marketing: false });
        } else {
          timer = window.setTimeout(checkExpiry, Math.min(remaining, 2147483647));
        }
      };
      checkExpiry();
    }
    return () => window.clearTimeout(timer);
  }, [ready, choice, storageWarning]);

  const choose = next => {
    if (!next.marketing) revokeMarketing();
    if (!next.analytics) revokeAnalytics();
    const { record, saved } = saveConsent(next);
    setStorageWarning(!saved);
    setChoice(record);
    setDraft(next);
    setSettingsOpen(false);
    opener.current?.focus();
  };

  const complete = choice !== null && typeof choice.analytics === 'boolean';
  if (!ready || (complete && !settingsOpen && !storageWarning)) return null;
  if (complete && !settingsOpen && storageWarning) {
    return <section className="marketing-consent" aria-label="Cookie preference status" aria-live="polite">
      <p>Your choice applies to this visit. Your browser could not save it for future visits.</p>
      <button onClick={() => { setStorageWarning(false); }}>Dismiss</button>
    </section>;
  }

  return (
    <section className="marketing-consent" role="region" aria-labelledby="marketing-consent-title">
      <div className="marketing-consent-copy">
        <h2 id="marketing-consent-title" ref={heading} tabIndex={-1}>Your cookie choices</h2>
        <p>Choose separately whether to allow Google Analytics and Meta marketing cookies.
          You can reject both and still browse, listen and make Santa messages.
          {' '}<Link to="/privacy-policy">Privacy Policy</Link></p>
        <fieldset className="marketing-consent-options">
          <legend>Cookie choices</legend>
          <label>
            <input type="checkbox" checked={draft.analytics} onChange={event =>
              setDraft(current => ({ ...current, analytics: event.target.checked }))} />
            <span><strong>Analytics cookies</strong><small>Google Analytics measures visits and which pages are used.</small></span>
          </label>
          <label>
            <input type="checkbox" checked={draft.marketing} onChange={event =>
              setDraft(current => ({ ...current, marketing: event.target.checked }))} />
            <span><strong>Marketing cookies</strong><small>Meta measures adverts and helps show relevant adverts on Facebook and Instagram.</small></span>
          </label>
        </fieldset>
        {settingsOpen && choice && <>
          <p>Current choice: analytics cookies {choice.analytics === null ? 'not yet chosen' : choice.analytics ? 'accepted' : 'rejected'}.</p>
          <p>Current choice: marketing cookies {choice.marketing ? 'accepted' : 'rejected'}.</p>
        </>}
        {!complete && choice && <p>Your earlier Meta choice is kept. Google Analytics needs a separate choice.</p>}
      </div>
      <div className="marketing-consent-actions">
        <button onClick={() => choose({ analytics: true, marketing: true })}>Accept all</button>
        <button onClick={() => choose({ analytics: false, marketing: false })}>Reject optional cookies</button>
        <button onClick={() => choose(draft)}>Save choices</button>
        {settingsOpen && complete && <button onClick={() => {
          setSettingsOpen(false);
          opener.current?.focus();
        }}>Close settings</button>}
      </div>
    </section>
  );
}
