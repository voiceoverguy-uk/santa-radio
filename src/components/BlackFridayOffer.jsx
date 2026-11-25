import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { STUDIO_CHECKOUT_PATH } from '../lib/studioRoute.js';
import './BlackFridayOffer.css';

const SEEN_KEY = 'santa-radio-black-friday-2026-seen';
const CODE = 'HALFPRICE';
// UK time is GMT for both November date boundaries.
export const BLACK_FRIDAY_START = Date.parse('2026-11-26T09:00:00Z');
const END = Date.parse('2026-12-01T00:00:00Z');

export function useBlackFridayOfferWindow() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer;
    function sync() {
      clearTimeout(timer);
      const now = Date.now();
      setActive(now >= BLACK_FRIDAY_START && now < END);
      const boundary = now < BLACK_FRIDAY_START ? BLACK_FRIDAY_START : END;
      if (now < boundary) timer = setTimeout(sync, Math.min(boundary - now, 2_147_483_647));
    }
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return active;
}

export default function BlackFridayOffer({ eligible }) {
  const dialog = useRef(null);
  const codeInput = useRef(null);
  const shown = useRef(false);
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState('');

  useEffect(() => {
    if (!eligible) {
      setOpen(false);
      return;
    }
    if (shown.current) return;
    function showWhenVisible() {
      if (shown.current || document.visibilityState !== 'visible') return;
      shown.current = true;
      try {
        if (sessionStorage.getItem(SEEN_KEY)) return;
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch { /* The current visit still has the in-memory marker. */ }
      setOpen(true);
    }
    showWhenVisible();
    document.addEventListener('visibilitychange', showWhenVisible);
    return () => document.removeEventListener('visibilitychange', showWhenVisible);
  }, [eligible]);

  useLayoutEffect(() => {
    if (!open || !eligible) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, [open, eligible]);

  const close = () => dialog.current?.close();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopyState('Copied');
    } catch {
      codeInput.current?.select();
      setCopyState('Code selected. Use your device’s copy command.');
    }
  }

  if (!open || !eligible) return null;

  return createPortal(
    <dialog ref={dialog} className="black-friday-offer" aria-labelledby="black-friday-title"
      aria-describedby="black-friday-description" onClose={() => setOpen(false)}>
      <div className="black-friday-offer__paper">
        <form method="dialog">
          <button type="submit" className="black-friday-offer__close" aria-label="Close Black Friday offer" autoFocus>×</button>
        </form>
        <p className="black-friday-offer__brand">Santa Radio</p>
        <h2 className="black-friday-offer__title" id="black-friday-title">
          <span className="black-friday-offer__occasion">Black Friday</span>
          <span className="black-friday-offer__sale"><span>50%</span>{' '}<span className="black-friday-offer__off">OFF</span></span>
        </h2>
        <p className="black-friday-offer__description" id="black-friday-description">Magical Personalised messages from Santa</p>
        <fieldset className="black-friday-offer__voucher">
          <legend>Use this code at checkout</legend>
          <div className="black-friday-offer__ticket">
            <input ref={codeInput} type="text" value={CODE} readOnly aria-label="Black Friday voucher code" />
            <button type="button" onClick={copyCode} aria-label="Copy voucher code">{copyState === 'Copied' ? 'Copied' : 'Copy'}</button>
          </div>
        </fieldset>
        <div className="black-friday-offer__actions">
          <Link className="black-friday-offer__cta" to={STUDIO_CHECKOUT_PATH} onClick={close}>Kids’ Message</Link>
          <Link className="black-friday-offer__cta" to="/dad-message-maker" onClick={close}>Dad’s Message</Link>
        </div>
        <div className="black-friday-offer__status" role="status">{copyState}</div>
      </div>
    </dialog>, document.body,
  );
}
