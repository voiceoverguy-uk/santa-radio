import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CONSENT_KEY, LEGACY_CONSENT_KEY, CONSENT_DURATION,
  readConsentRecord, savedConsent, saveConsent,
} from './cookieConsent.js';
import { revokeAnalytics } from './googleAnalytics.js';
import { revokeMarketing } from './marketingConsent.js';

const CookieConsentContext = createContext(null);

function revokeUnselected(record) {
  if (!record?.analytics) revokeAnalytics();
  if (!record?.marketing) revokeMarketing();
}

export function CookieConsentProvider({ children }) {
  const [choice, setChoice] = useState(null);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    const stored = savedConsent();
    revokeUnselected(stored);
    setChoice(stored);
    setReady(true);
    const synchronise = event => {
      if (![CONSENT_KEY, LEGACY_CONSENT_KEY, null].includes(event.key)) return;
      const next = event.key === null ? null : event.key === CONSENT_KEY
        ? readConsentRecord(event.newValue) : savedConsent();
      revokeUnselected(next);
      setChoice(next);
      setStorageWarning(false);
    };
    window.addEventListener('storage', synchronise);
    return () => window.removeEventListener('storage', synchronise);
  }, []);

  useEffect(() => {
    if (!choice) return;
    let timer;
    const checkExpiry = () => {
      clearTimeout(timer);
      const remaining = choice.savedAt + CONSENT_DURATION - Date.now();
      if (remaining <= 0) {
        revokeUnselected(null);
        setChoice(null);
        setStorageWarning(false);
      } else {
        timer = window.setTimeout(checkExpiry, Math.min(remaining, 2147483647));
      }
    };
    checkExpiry();
    // Recheck immediately on return from a throttled/background tab.
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [choice]);

  const chooseConsent = useCallback(next => {
    // Revoke before updating React state or storage, including queued events.
    revokeUnselected(next);
    const { record, saved } = saveConsent(next);
    setChoice(record);
    setStorageWarning(!saved);
    return record;
  }, []);

  const enableMedia = () => {
    const current = choice && choice.savedAt + CONSENT_DURATION > Date.now() ? choice : null;
    chooseConsent({ analytics: current?.analytics === true, marketing: current?.marketing === true, media: true });
  };

  const mediaAllowed = ready && choice?.media === true &&
    choice.savedAt + CONSENT_DURATION > Date.now();
  return <CookieConsentContext.Provider value={{
    ready, choice, chooseConsent, mediaAllowed, enableMedia, storageWarning,
    dismissStorageWarning: () => setStorageWarning(false),
  }}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const value = useContext(CookieConsentContext);
  if (!value) throw new Error('CookieConsentProvider is required');
  return value;
}
