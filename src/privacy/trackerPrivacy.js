// This policy covers every visitor, including the released Android app's
// unmarked URL. It deliberately does not rely on storage, consent or user agent.
export function isTrackerPath(pathname) {
  try {
    return /^\/santa-tracker(?:\/|$)/i.test(decodeURIComponent(pathname));
  } catch {
    return /^\/santa-tracker(?:\/|$)/i.test(pathname);
  }
}

export function trackerTrackingDisabled() {
  return typeof window !== 'undefined' && isTrackerPath(window.location.pathname);
}

const trackingDomains = [
  'google-analytics.com', 'googletagmanager.com', 'analytics.google.com',
  'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
  'connect.facebook.net', 'clarity.ms', 'hotjar.com', 'hotjar.io',
  'plausible.io', 'posthog.com',
];

export function isTrackingRequest(value) {
  try {
    const url = new URL(value?.url || value,
      typeof window === 'undefined' ? 'https://invalid.local' : window.location.href);
    const host = url.hostname.toLowerCase();
    return trackingDomains.some(domain => host === domain || host.endsWith(`.${domain}`))
      || ((host === 'facebook.com' || host.endsWith('.facebook.com'))
        && /^\/(?:tr(?:\/|$)|privacy_sandbox\/pixel\/)/.test(url.pathname))
      || ((host === 'google.com' || host.endsWith('.google.com'))
        && /^\/(?:ccm\/collect|pagead\/)/.test(url.pathname))
      || /^\/_vercel\/(?:insights|speed-insights)(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}

let installed = false;

export function installTrackerPrivacyGuard(onTrackerEntry) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const blocked = value => trackerTrackingDisabled() && isTrackingRequest(value);
  const synchronise = () => {
    if (trackerTrackingDisabled()) onTrackerEntry();
  };

  // Installed before React and optional tags. Revoke synchronously after the
  // URL changes, before third-party history listeners or React effects run.
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method];
    window.history[method] = function (...args) {
      const result = original.apply(this, args);
      synchronise();
      return result;
    };
  }
  window.addEventListener('popstate', synchronise, true);
  synchronise();

  // Already-executing third-party code cannot be unloaded on an SPA transition.
  // Discard its late telemetry while preserving radio playback and navigation.
  const originalFetch = window.fetch;
  window.fetch = function (input, ...args) {
    if (blocked(input)) {
      // An intentional discard must not cause telemetry retry loops.
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return originalFetch.call(this, input, ...args);
  };
  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      return blocked(url) ? false : originalBeacon.call(this, url, data);
    };
  }
  const urls = new WeakMap();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    urls.set(this, url);
    return originalOpen.call(this, method, url, ...args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (blocked(urls.get(this))) {
      this.abort();
      return;
    }
    return originalSend.apply(this, args);
  };

  // Google/Meta can use image pixels and dynamically inserted tags instead of
  // fetch. Keep these guarded even when consent changes on the tracker.
  for (const [type, attribute] of [
    [HTMLImageElement, 'src'], [HTMLScriptElement, 'src'],
    [HTMLIFrameElement, 'src'], [HTMLLinkElement, 'href'],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(type.prototype, attribute);
    if (!descriptor?.set) continue;
    Object.defineProperty(type.prototype, attribute, {
      ...descriptor,
      set(value) {
        if (!blocked(value)) descriptor.set.call(this, value);
      },
    });
  }
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (/^(?:IMG|SCRIPT|IFRAME|LINK)$/.test(this.tagName)
        && /^(?:src|href)$/i.test(name) && blocked(value)) return;
    return originalSetAttribute.call(this, name, value);
  };
}
