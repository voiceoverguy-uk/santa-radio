import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CONSENT_KEY, CONSENT_DURATION, SETTINGS_EVENT, readConsent, savedConsent,
  saveConsent, trackPageView, revokeMarketing,
} from '../privacy/marketingConsent.js';
import './MarketingConsent.css';

export default function MarketingConsent() {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const heading = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    setChoice(savedConsent());
    setReady(true);
    const open = () => {
      opener.current = document.activeElement;
      setSettingsOpen(true);
    };
    const synchronise = event => {
      if (event.key === CONSENT_KEY || event.key === null) {
        const next = event.key === null ? null : readConsent(event.newValue);
        if (next !== 'accepted') revokeMarketing();
        setChoice(next);
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
    if (settingsOpen) heading.current?.focus();
  }, [settingsOpen]);

  useEffect(() => {
    if (!ready) return;
    if (choice === 'accepted') trackPageView(pathname);
    else revokeMarketing();
  }, [ready, choice, pathname]);

  useEffect(() => {
    if (!ready || choice === null || storageWarning) return;
    let timer;
    try {
      const record = JSON.parse(localStorage.getItem(CONSENT_KEY));
      const checkExpiry = () => {
        const remaining = record.savedAt + CONSENT_DURATION - Date.now();
        if (remaining <= 0) {
          revokeMarketing();
          setChoice(null);
        } else {
          timer = window.setTimeout(checkExpiry, Math.min(remaining, 2147483647));
        }
      };
      checkExpiry();
    } catch { return; }
    return () => window.clearTimeout(timer);
  }, [ready, choice, storageWarning]);

  const choose = next => {
    if (next === 'rejected') revokeMarketing();
    setStorageWarning(!saveConsent(next));
    setChoice(next);
    setSettingsOpen(false);
    opener.current?.focus();
  };

  if (!ready || (choice !== null && !settingsOpen && !storageWarning)) return null;
  if (choice !== null && !settingsOpen && storageWarning) {
    return <section className="marketing-consent" aria-label="Cookie preference status" aria-live="polite">
      <p>Your choice applies to this visit. Your browser could not save it for future visits.</p>
      <button onClick={() => { setStorageWarning(false); }}>Dismiss</button>
    </section>;
  }

  return (
    <section className="marketing-consent" role="region" aria-labelledby="marketing-consent-title">
      <div className="marketing-consent-copy">
        <h2 id="marketing-consent-title" ref={heading} tabIndex={-1}>Marketing cookie choice</h2>
        <p>With your permission, we use the Meta Pixel to measure visits and help show relevant
          Santa Radio adverts on Facebook and Instagram. It shares visit information with Meta
          and may use advertising cookies. You can reject these and still use the site.
          {' '}<Link to="/privacy-policy">Privacy Policy</Link></p>
        {settingsOpen && choice && <p>Current choice: marketing cookies {choice}.</p>}
      </div>
      <div className="marketing-consent-actions">
        <button onClick={() => choose('accepted')}>Accept marketing cookies</button>
        <button onClick={() => choose('rejected')}>Reject marketing cookies</button>
        {settingsOpen && choice !== null && <button onClick={() => {
          setSettingsOpen(false);
          opener.current?.focus();
        }}>Close settings</button>}
      </div>
    </section>
  );
}
