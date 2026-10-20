export const CONSENT_KEY = 'santaradio-marketing-consent-v1';
export const CONSENT_DURATION = 180 * 24 * 60 * 60 * 1000;
export const PIXEL_ID = '2258928314674162';
export const SETTINGS_EVENT = 'santaradio:cookie-settings';

export function readConsent(value) {
  try {
    const record = JSON.parse(value);
    if (record?.version !== 1 || !['accepted', 'rejected'].includes(record.choice) ||
      !Number.isFinite(record.savedAt) || record.savedAt > Date.now() ||
      Date.now() - record.savedAt >= CONSENT_DURATION) return null;
    return record.choice;
  } catch {
    return null;
  }
}

export function savedConsent() {
  try { return readConsent(localStorage.getItem(CONSENT_KEY)); } catch { return null; }
}

export function saveConsent(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, choice, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

let initialised = false;
let lastPath = null;

export function trackPageView(pathname) {
  if (!window.fbq) {
    const pixel = function (...args) {
      if (pixel.callMethod) pixel.callMethod.apply(pixel, args);
      else pixel.queue.push(args);
    };
    pixel.push = pixel;
    pixel.loaded = true;
    pixel.version = '2.0';
    pixel.queue = [];
    window.fbq = pixel;
    window._fbq = pixel;
  }
  if (!initialised) {
    // Disable automatic event detection and do not supply advanced matching data.
    window.fbq('consent', 'revoke');
    window.fbq('set', 'autoConfig', false, PIXEL_ID);
    window.fbq('init', PIXEL_ID);
    initialised = true;
    const script = document.createElement('script');
    script.id = 'santaradio-meta-pixel';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onerror = () => console.warn('Meta Pixel could not load; advertising tracking may be blocked.');
    document.head.appendChild(script);
  }
  window.fbq('consent', 'grant');
  if (lastPath !== pathname) {
    window.fbq('trackSingle', PIXEL_ID, 'PageView');
    lastPath = pathname;
  }
}

export function revokeMarketing() {
  lastPath = null;
  // Do not replay queued grants/PageViews if withdrawal beats script loading.
  if (Array.isArray(window.fbq?.queue)) {
    window.fbq.queue = window.fbq.queue.filter(command =>
      !(command[0] === 'trackSingle' && command[1] === PIXEL_ID) &&
      !(command[0] === 'consent' && command[1] === 'grant'));
  }
  if (window.fbq) window.fbq('consent', 'revoke');
  // Remove accessible first-party pixel cookies, including parent-domain cookies.
  const parts = window.location.hostname.split('.');
  const domains = ['', ...parts.map((_, index) => parts.slice(index).join('.'))];
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
    }
  }
}
