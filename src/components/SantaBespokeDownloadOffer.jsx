import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import SantaOfferHolly from './SantaOfferHolly.jsx';
import './SantaMessageOffer.css';

const SESSION_KEY = 'santa-bespoke-download-offer-shown';
let shownThisVisit = false;
function alreadyShown() {
  try { return shownThisVisit || sessionStorage.getItem(SESSION_KEY) === 'yes'; }
  catch { return shownThisVisit; }
}

export default function SantaBespokeDownloadOffer({ download }) {
  const [recipient, setRecipient] = useState(null);
  useEffect(() => {
    if (!download || alreadyShown()) return;
    let timer;
    const show = () => {
      if (alreadyShown()) return;
      if (document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) {
        timer = window.setTimeout(show, 1000);
        return;
      }
      shownThisVisit = true;
      try { sessionStorage.setItem(SESSION_KEY, 'yes'); sessionStorage.setItem('santa-review-receipt', download.receipt || ''); } catch { /* In-memory fallback. */ }
      setRecipient(download.name || 'your little one');
    };
    timer = window.setTimeout(show, 2000);
    return () => window.clearTimeout(timer);
  }, [download]);
  return recipient ? <BespokeDialog name={recipient} onClose={() => setRecipient(null)} /> : null;
}

function BespokeDialog({ name, onClose }) {
  const dialog = useRef(null);
  const title = useId();
  const description = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="santa-offer" aria-labelledby={title} aria-describedby={description}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="santa-offer-close-row"><button type="button" className="santa-offer-close" aria-label="Close review invitation" autoFocus onClick={onClose}>×</button></div>
    <SantaOfferHolly className="santa-offer-holly santa-offer-holly--top" />
    <p className="santa-offer-kicker">A LITTLE THANK YOU</p>
    <h2 id={title}>Tell us about your Santa message</h2>
    <p id={description} style={{ textAlign: 'center' }}>Why not leave a review?<br />Get 20% off a bespoke Santa message.</p>
    <p style={{ textAlign: 'center', fontWeight: 700 }}>Discount code emailed after submission</p>
    <Link className="btn-red" style={{ display: 'block', textAlign: 'center', marginTop: 18 }} to="/leave-a-review"
      onClick={onClose}>Write a review →</Link>
    <button type="button" className="santa-offer-later" onClick={onClose}>No thanks</button>
    <SantaOfferHolly className="santa-offer-holly santa-offer-holly--bottom" />
  </dialog>, document.body);
}
