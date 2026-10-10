import { CONSENT_KEY as LEGACY_KEY, CONSENT_DURATION, readConsent } from './marketingConsent.js';

export { CONSENT_DURATION };
export const CONSENT_KEY = 'santaradio-cookie-consent-v2';
export const LEGACY_CONSENT_KEY = LEGACY_KEY;
export const SETTINGS_EVENT = 'santaradio:cookie-settings';

export function readConsentRecord(value) {
  try {
    const record = JSON.parse(value);
    if (record?.version !== 2 || typeof record.analytics !== 'boolean' ||
        typeof record.marketing !== 'boolean' || !Number.isFinite(record.savedAt) ||
        record.savedAt > Date.now() || Date.now() - record.savedAt >= CONSENT_DURATION) return null;
    return record;
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
    return { analytics: null, marketing: legacyChoice === 'accepted',
      savedAt: JSON.parse(legacyValue).savedAt };
  } catch { return null; }
}

export function saveConsent(choices) {
  const record = { version: 2, analytics: choices.analytics, marketing: choices.marketing, savedAt: Date.now() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    return { record, saved: true };
  } catch {
    return { record, saved: false };
  }
}
