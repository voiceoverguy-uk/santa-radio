import { CONSENT_KEY as LEGACY_KEY, CONSENT_DURATION, readConsent } from './marketingConsent.js';

export { CONSENT_DURATION };
export const CONSENT_KEY = 'santaradio-cookie-consent-v2';
export const LEGACY_CONSENT_KEY = LEGACY_KEY;
export const SETTINGS_EVENT = 'santaradio:cookie-settings';
export const EMPTY_CHOICES = Object.freeze({ analytics: false, marketing: false, media: false });
export const openCookieSettings = () => window.dispatchEvent(new Event(SETTINGS_EVENT));

// An essential, host-only preference cookie is a fallback when browser
// localStorage is blocked, full, or silently discards writes. No visitor
// identity or contact details are included.
function cookieValue() {
  try {
    const prefix = `${CONSENT_KEY}=`;
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
  } catch { return null; }
}

function saveCookie(value, maxAge) {
  try {
    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    return cookieValue() === value;
  } catch { return false; }
}

// Only a genuinely new visit gets the homepage exception. Keep damaged,
// expired and older records conservative rather than reviving media loading.
export function hasNoSavedConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === null &&
      localStorage.getItem(LEGACY_CONSENT_KEY) === null && cookieValue() === null;
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
  const backup = cookieValue();
  try {
    const current = localStorage.getItem(CONSENT_KEY);
    // A damaged/expired new choice must not revive an older acceptance.
    if (current !== null) {
      const record = readConsentRecord(current);
      if (!record) return null;
      const cookie = readConsentRecord(backup);
      return cookie && cookie.savedAt > record.savedAt ? cookie : record;
    }
    if (backup !== null) return readConsentRecord(backup);
    const legacyValue = localStorage.getItem(LEGACY_KEY);
    const legacyChoice = readConsent(legacyValue);
    if (!legacyChoice) return null;
    return { analytics: null, marketing: legacyChoice === 'accepted', media: false,
      savedAt: JSON.parse(legacyValue).savedAt };
  } catch { return readConsentRecord(backup); }
}

export function saveConsent(choices) {
  const record = { version: 2, analytics: choices.analytics === true,
    marketing: choices.marketing === true, media: choices.media === true, savedAt: Date.now() };
  const value = JSON.stringify(record);
  try {
    localStorage.setItem(CONSENT_KEY, value);
    if (localStorage.getItem(CONSENT_KEY) === value) {
      // Remove an older fallback only after confirming the primary write.
      saveCookie('', 0);
      return { record, saved: true };
    }
  } catch { /* Try the independent first-party cookie below. */ }
  return { record, saved: saveCookie(value, CONSENT_DURATION / 1000) };
}
