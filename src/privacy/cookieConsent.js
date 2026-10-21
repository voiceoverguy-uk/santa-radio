import { CONSENT_KEY as LEGACY_KEY, CONSENT_DURATION, readConsent } from './marketingConsent.js';

export { CONSENT_DURATION };
export const CONSENT_KEY = 'santaradio-cookie-consent-v2';
export const LEGACY_CONSENT_KEY = LEGACY_KEY;
export const SETTINGS_EVENT = 'santaradio:cookie-settings';
export const EMPTY_CHOICES = Object.freeze({ analytics: false, marketing: false, media: false });
export const openCookieSettings = () => window.dispatchEvent(new Event(SETTINGS_EVENT));

// Only a genuinely new visit gets the homepage exception. Keep damaged,
// expired and older records conservative rather than reviving media loading.
export function hasNoSavedConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === null &&
      localStorage.getItem(LEGACY_CONSENT_KEY) === null;
  } catch { return false; }
}

export function readConsentRecord(value) {
  try {
    const record = JSON.parse(value);
    if (record?.version !== 2 || typeof record.analytics !== 'boolean' ||
        typeof record.marketing !== 'boolean' ||
        (record.media !== undefined && typeof record.media !== 'boolean') || !Number.isFinite(record.savedAt) ||
        record.savedAt > Date.now() || Date.now() - record.savedAt >= CONSENT_DURATION) return null;
    // Existing valid preferences stay valid. A previously absent media choice
    // is not permission to contact YouTube or TuneIn.
    return { ...record, media: record.media === true };
  } catch { return null; }
}

export function savedConsent() {
  try {
    const current = localStorage.getItem(CONSENT_KEY);
    // A damaged/expired new choice must not revive an older acceptance.
    if (current !== null) return readConsentRecord(current);
    const legacyValue = localStorage.getItem(LEGACY_KEY);
    const legacyChoice = readConsent(legacyValue);
    if (!legacyChoice) return null;
    return { analytics: null, marketing: legacyChoice === 'accepted', media: false,
      savedAt: JSON.parse(legacyValue).savedAt };
  } catch { return null; }
}

export function saveConsent(choices) {
  const record = { version: 2, analytics: choices.analytics === true,
    marketing: choices.marketing === true, media: choices.media === true, savedAt: Date.now() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    return { record, saved: true };
  } catch {
    return { record, saved: false };
  }
}
