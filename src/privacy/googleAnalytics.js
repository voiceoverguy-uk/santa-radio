export const MEASUREMENT_ID = 'G-FGL2HBXZ92';
const DISABLE_KEY = `ga-disable-${MEASUREMENT_ID}`;
let initialised = false;
let active = false;
let lastPath = null;
let previousPage = '';
let scriptLoaded = false;

function cleanUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return url.origin + url.pathname;
  } catch { return ''; }
}

export function trackAnalyticsPageView(pathname) {
  window[DISABLE_KEY] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  if (!initialised) {
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('config', MEASUREMENT_ID, {
      // Also turn off Enhanced Measurement in the GA web stream: its history
      // listener operates independently of send_page_view (Google's docs).
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 180 * 24 * 60 * 60,
      cookie_update: false,
      page_location: window.location.origin + pathname,
      page_referrer: cleanUrl(document.referrer),
    });
    initialised = true;
    const script = document.createElement('script');
    script.id = 'santaradio-google-analytics';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.onload = () => { scriptLoaded = true; };
    script.onerror = () => console.warn('Google Analytics could not load; analytics may be blocked.');
    document.head.appendChild(script);
  } else if (!active) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  active = true;
  if (lastPath === pathname) return;
  const page = window.location.origin + pathname;
  // No query strings, fragments, form contents or child-name selections.
  window.gtag('set', { page_location: page, page_referrer: previousPage || cleanUrl(document.referrer) });
  window.gtag('event', 'page_view', {
    send_to: MEASUREMENT_ID,
    page_location: page,
    page_title: document.title,
    page_referrer: previousPage || cleanUrl(document.referrer),
  });
  previousPage = page;
  lastPath = pathname;
}

export function trackAnalyticsEvent(name, data) {
  if (typeof window === 'undefined' || !active || window[DISABLE_KEY]) return;
  try {
    const result = window.gtag?.('event', name, { ...data, send_to: MEASUREMENT_ID });
    result?.catch?.(() => {});
  } catch {
    // Optional analytics must never prevent the requested action.
  }
}

export function revokeAnalytics() {
  // Google documents this flag as disabling collection, including automatic
  // events. Set it BEFORE updating consent to avoid denied-state pings.
  window[DISABLE_KEY] = true;
  // A slow-loading tag must not replay page views or a grant queued before
  // withdrawal. Keep configuration/default-denied commands for a later opt-in.
  const queue = window.dataLayer;
  if (!scriptLoaded && Array.isArray(queue)) {
    for (let index = queue.length - 1; index >= 0; index--) {
      const command = queue[index];
      if ((command?.[0] === 'event' && command?.[2]?.send_to === MEASUREMENT_ID) ||
          (command?.[0] === 'consent' && command?.[1] === 'update' &&
           command?.[2]?.analytics_storage === 'granted')) queue.splice(index, 1);
    }
  }
  if (active && window.gtag) window.gtag('consent', 'update', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  });
  active = false;
  lastPath = null;
  previousPage = '';
  const parts = window.location.hostname.split('.');
  const domains = ['', ...parts.map((_, index) => parts.slice(index).join('.'))];
  const names = document.cookie.split(';').map(cookie => cookie.trim().split('=')[0])
    .filter(name => name === '_ga' || name.startsWith('_ga_'));
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
    }
  }
}
