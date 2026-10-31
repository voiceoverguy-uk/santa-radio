import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import { useSantaMessageAccess } from './SantaMessageAccessProvider.jsx';
import SantaMessageAccessForm from './SantaMessageAccessForm.jsx';
import SantaOfferHolly from './SantaOfferHolly.jsx';
import './SantaMessageOffer.css';

export const OFFER_SESSION_KEY = 'santa-message-offer-shown';
export const OFFER_LAST_SHOWN_KEY = 'santa-message-offer-last-shown';
const OFFER_CHANNEL_NAME = 'santa-message-offer';
const DELAY_MS = 16000;
const COOLDOWN_MS = 48 * 60 * 60 * 1000;
const excluded = pathname => /^\/(?:preview\/hero-name-checker|request-names|sign-in|sign-up|privacy-policy|free-santa-message|santa-message-workshop)(?:\/|$)/i.test(pathname);

function readLastShown() {
  try {
    const value = localStorage.getItem(OFFER_LAST_SHOWN_KEY);
    if (value === null) return null;
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= Date.now() ? timestamp : null;
  } catch { return null; }
}

function isCoolingDown(now = Date.now()) {
  const lastShown = readLastShown();
  return lastShown !== null && now - lastShown < COOLDOWN_MS;
}

function visible(element) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function pageBusy(usedForms) {
  if ([...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')].some(visible)) return true;
  const active = document.activeElement;
  if (active?.closest('form, input, textarea, select, [contenteditable="true"]')) return true;
  if ([...document.forms].some(form => usedForms.has(form))) return true;
  // Keep a partly completed form safe even after focus moves to another control.
  if ([...document.querySelectorAll('form input:not([type="hidden"]):not([type="submit"]), form textarea, form select')]
    .some(input => visible(input) && (input.type === 'checkbox' || input.type === 'radio'
      ? input.checked !== input.defaultChecked : input.value !== input.defaultValue))) return true;
  return [...document.querySelectorAll('#santa-messages .santa-message-access')].some(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < window.innerHeight && visible(element);
  });
}

function OfferDialog({ onClose }) {
  const dialog = useRef(null);
  const close = () => {
    // Close the native top layer before navigation/unlocking mounts the studio.
    // Otherwise native focus restoration can steal its heading focus.
    dialog.current?.close();
    onClose();
  };
  const containKeyboard = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not([type="hidden"]):not([tabindex="-1"])')]
      .filter(visible);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  useLayoutEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    // Native modal backdrops receive wheel events on the dialog itself.
    // Forward only outside-panel gestures; retain inertness and keyboard focus.
    const scrollBehind = event => {
      if (event.ctrlKey) return;
      const bounds = element.getBoundingClientRect();
      if (event.clientX >= bounds.left && event.clientX <= bounds.right &&
          event.clientY >= bounds.top && event.clientY <= bounds.bottom) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      window.scrollBy({ left: event.deltaX * unit, top: event.deltaY * unit, behavior: 'instant' });
    };
    element.addEventListener('wheel', scrollBehind, { passive: false });
    const viewport = window.visualViewport;
    const resize = () => {
      element.style.setProperty('--offer-viewport-height', `${viewport?.height || window.innerHeight}px`);
      element.style.setProperty('--offer-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      element.removeEventListener('wheel', scrollBehind);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
    };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="santa-offer" aria-labelledby="santa-offer-title"
      aria-describedby="santa-offer-description"
      onKeyDown={containKeyboard}
      onCancel={event => { event.preventDefault(); close(); }}>
      <div className="santa-offer-close-row">
        <button type="button" className="santa-offer-close" aria-label="Close Santa message offer" autoFocus onClick={close}>×</button>
      </div>
      <SantaOfferHolly className="santa-offer-holly santa-offer-holly--top" />
      <p className="santa-offer-kicker">A gift from the North Pole</p>
      <h2 id="santa-offer-title">A <span className="santa-offer-free-word">FREE</span> personal message from Santa</h2>
      <p id="santa-offer-description">Make their Christmas magical with a recorded greeting featuring their name.</p>
      <SantaMessageAccessForm variant="offer" onAccepted={close} onPrivacyNavigate={close} />
      <button type="button" className="santa-offer-later" onClick={close}>Maybe later</button>
      <SantaOfferHolly className="santa-offer-holly santa-offer-holly--bottom" />
    </dialog>, document.body,
  );
}

// Lives outside Routes: navigation never resets the visible-browsing clock.
export default function SantaMessageOffer() {
  const { pathname } = useLocation();
  const { hasAccess } = useSantaMessageAccess();
  const { ready, choice, settingsOpen, storageWarning } = useCookieConsent();
  const elapsed = useRef(0);
  const shown = useRef(false);
  const attempting = useRef(false);
  const offerChannel = useRef(null);
  const usedForms = useRef(new WeakSet());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let legacyShown = false;
    try { legacyShown = sessionStorage.getItem(OFFER_SESSION_KEY) === 'shown'; }
    catch { /* The current mounted visit remains protected by the in-memory ref. */ }
    if (!legacyShown) return;

    if (readLastShown() !== null) {
      // A persisted timestamp takes precedence over the old tab-only marker.
      // Clear it whether active or expired so the legacy value cannot reset it.
      try { sessionStorage.removeItem(OFFER_SESSION_KEY); } catch { /* Ignore unavailable session storage. */ }
      return;
    }

    // Migrate a marker from a previously loaded version into a finite cooldown.
    // The old marker proves the offer was shown, but contains no display time.
    const timestamp = String(Date.now());
    try {
      localStorage.setItem(OFFER_LAST_SHOWN_KEY, timestamp);
      if (localStorage.getItem(OFFER_LAST_SHOWN_KEY) === timestamp) {
        shown.current = true;
        return;
      }
    } catch { /* Fall back to suppressing this mounted visit only. */ }
    shown.current = true;
  }, []);

  useEffect(() => {
    const syncShownInAnotherTab = event => {
      if (event.key !== OFFER_LAST_SHOWN_KEY || !isCoolingDown()) return;
      // Another tab displayed the offer. Do not duplicate it in this visit.
      shown.current = true;
      attempting.current = false;
      setOpen(false);
    };
    window.addEventListener('storage', syncShownInAnotherTab);
    return () => window.removeEventListener('storage', syncShownInAnotherTab);
  }, []);

  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel(OFFER_CHANNEL_NAME);
      offerChannel.current = channel;
      channel.onmessage = event => {
        if (event.data?.type !== 'shown') return;
        shown.current = true;
        attempting.current = false;
        setOpen(false);
      };
    } catch { /* Storage events remain the persistent cross-tab fallback. */ }
    return () => {
      offerChannel.current = null;
      channel?.close();
    };
  }, []);

  useEffect(() => {
    usedForms.current = new WeakSet();
    const rememberForm = event => {
      const form = event.target.closest('form');
      if (form) usedForms.current.add(form);
    };
    document.addEventListener('input', rememberForm);
    document.addEventListener('change', rememberForm);
    return () => {
      document.removeEventListener('input', rememberForm);
      document.removeEventListener('change', rememberForm);
    };
  }, [pathname]);

  useEffect(() => {
    if (hasAccess || excluded(pathname) || settingsOpen || !choice || storageWarning) setOpen(false);
    let last = Date.now();
    let wasVisible = document.visibilityState === 'visible';
    let stopped = false;
    const eligible = () => !stopped && !shown.current && !hasAccess && !excluded(pathname) &&
      ready && typeof choice?.analytics === 'boolean' && !settingsOpen && !storageWarning &&
      document.visibilityState === 'visible' && elapsed.current >= DELAY_MS && !pageBusy(usedForms.current);
    const displayOffer = () => {
      if (!eligible() || isCoolingDown()) return;
      const timestamp = String(Date.now());
      try {
        localStorage.setItem(OFFER_LAST_SHOWN_KEY, timestamp);
        // A read-back catches silently discarded writes. Storage events notify
        // other tabs before the dialog is made visible.
        if (localStorage.getItem(OFFER_LAST_SHOWN_KEY) !== timestamp && isCoolingDown()) return;
      } catch { /* In-memory suppression still prevents repeats in this visit. */ }
      try { sessionStorage.setItem(OFFER_SESSION_KEY, 'shown'); } catch { /* Keep the durable cooldown when possible. */ }
      shown.current = true;
      setOpen(true);
      try { offerChannel.current?.postMessage({ type: 'shown' }); } catch { /* Keep the local suppression. */ }
      clearInterval(timer);
    };
    const tick = () => {
      if (stopped || shown.current) return;
      const now = Date.now();
      if (wasVisible) elapsed.current += now - last;
      last = now;
      wasVisible = document.visibilityState === 'visible';
      if (!eligible() || attempting.current || isCoolingDown()) return;
      attempting.current = true;

      // Web Locks serialize the read/check/write/display sequence across tabs
      // where available. The synchronous storage recheck remains the fallback.
      const show = () => {
        try {
          if (!eligible() || isCoolingDown()) return;
          displayOffer();
        } finally {
          attempting.current = false;
        }
      };
      if (navigator.locks?.request) {
        navigator.locks.request('santa-message-offer', { mode: 'exclusive', ifAvailable: true }, lock => {
          if (lock) show();
          else attempting.current = false;
        }).catch(() => show());
      } else show();
    };
    const timer = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      if (wasVisible) elapsed.current += Date.now() - last;
    };
  }, [pathname, hasAccess, ready, choice, settingsOpen, storageWarning]);

  return open ? <OfferDialog onClose={() => setOpen(false)} /> : null;
}
