import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import { useSantaMessageAccess } from './SantaMessageAccessProvider.jsx';
import SantaMessageAccessForm from './SantaMessageAccessForm.jsx';
import SantaOfferHolly from './SantaOfferHolly.jsx';
import './SantaMessageOffer.css';

export const OFFER_SESSION_KEY = 'santa-message-offer-shown';
const DELAY_MS = 16000;
const excluded = pathname => /^\/(?:preview\/hero-name-checker|request-names|sign-in|sign-up|privacy-policy|free-santa-message|santa-message-workshop)(?:\/|$)/i.test(pathname);

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
  const usedForms = useRef(new WeakSet());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { shown.current ||= sessionStorage.getItem(OFFER_SESSION_KEY) === 'shown'; }
    catch { /* The ref still suppresses repeat offers for this mounted visit. */ }
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
    if (shown.current || hasAccess || excluded(pathname)) return;
    let last = Date.now();
    let wasVisible = document.visibilityState === 'visible';
    const tick = () => {
      if (shown.current) return;
      const now = Date.now();
      if (wasVisible) elapsed.current += now - last;
      last = now;
      wasVisible = document.visibilityState === 'visible';
      if (!wasVisible || elapsed.current < DELAY_MS || !ready ||
          typeof choice?.analytics !== 'boolean' || settingsOpen || storageWarning || pageBusy(usedForms.current)) return;
      shown.current = true;
      try { sessionStorage.setItem(OFFER_SESSION_KEY, 'shown'); } catch { /* In-memory suppression remains. */ }
      setOpen(true);
      clearInterval(timer);
    };
    const timer = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      if (wasVisible) elapsed.current += Date.now() - last;
    };
  }, [pathname, hasAccess, ready, choice, settingsOpen, storageWarning]);

  return open ? <OfferDialog onClose={() => setOpen(false)} /> : null;
}
