import { useCookieConsent } from './CookieConsentProvider.jsx';
import { CONSENT_DURATION } from './cookieConsent.js';
import { trackAnalyticsEvent } from './googleAnalytics.js';
import { trackerTrackingDisabled } from './trackerPrivacy.js';

// Reuse the live choice, including consent that could not be saved to storage.
// Do not load a tracker or queue events for later consent.
export function useTrackEvent() {
  const { ready, choice } = useCookieConsent();

  return (name, data) => {
    if (typeof window === 'undefined' || trackerTrackingDisabled() || !ready || choice?.analytics !== true ||
        Date.now() - choice.savedAt >= CONSENT_DURATION) return;

    trackAnalyticsEvent(name, data);
  };
}
