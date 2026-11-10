import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { STUDIO_PATH, STUDIO_CHECKOUT_PATH } from '../lib/studioRoute.js';

export default function StudioPurchaseButton({ onPaidAccessChange }) {
  return <PurchaseButton sandbox={import.meta.env.DEV} onPaidAccessChange={onPaidAccessChange} />;
}

function PurchaseButton({ sandbox, onPaidAccessChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [paid, setPaid] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [embedded, setEmbedded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const noteId = useId();
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setChecking(true);
    setError('');
    (async () => {
      const access = await fetch('/api/santa-studio-access', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      });
      if (!access.ok) throw new Error('We couldn’t check your purchase. Please retry before paying again.');
      const entitlement = await access.json();
      if (controller.signal.aborted) return;
      const recognized = entitlement.authorized === true && (sandbox ? entitlement.mode !== 'live' : entitlement.mode === 'live');
      setPaid(recognized ? entitlement : null);
      onPaidAccessChange?.(recognized);
      if (recognized) { setAvailable(false); return; }
      const response = await fetch('/api/santa-studio-checkout', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      });
      const data = await response.json();
      setEmbedded(!sandbox && data.checkoutMode === 'embedded');
      if (!controller.signal.aborted) setAvailable(response.ok && data.available === true
        && (sandbox ? data.sandbox === true : data.mode === 'live' && data.sandbox === false
          && data.amount === 650 && data.currency === 'gbp'));
    })().catch(() => {
      if (!disposed) {
        setAvailable(false);
        setError('We couldn’t check your purchase. Please retry before paying again.');
      }
    }).finally(() => {
      clearTimeout(timeout);
      if (!disposed) setChecking(false);
    });
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [sandbox, refresh, onPaidAccessChange]);
  useEffect(() => {
    const recheck = () => { if (!document.hidden) setRefresh(value => value + 1); };
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    window.addEventListener('santa-workshop-access-change', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
      window.removeEventListener('santa-workshop-access-change', recheck);
    };
  }, []);
  const purchase = async () => {
    if (busy) return;
    if (embedded) { navigate(STUDIO_CHECKOUT_PATH); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/santa-studio-checkout', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout could not be started.');
      if (data.openStudio || data.pending) {
        window.dispatchEvent(new CustomEvent('santa-workshop-access-change'));
        navigate(`${STUDIO_PATH}?checkout=return`);
        setBusy(false);
        return;
      }
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected checkout address.');
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause.message || 'Checkout could not be started. Please try again.');
      setBusy(false);
    }
  };
  if (paid) return <div className="santa-studio-promotion__checkout-note">
    <button className="santa-studio-promotion__purchase" type="button" onClick={() => navigate(STUDIO_PATH)}>
      {paid.remaining === 0 ? 'Open your Studio' : 'Create your bespoke message'}
    </button>
    <p role="status">Payment confirmed. {Number.isInteger(paid.remaining)
      ? paid.remaining === 0 ? 'Both messages have been created. No further payment is needed to reopen Studio.'
        : `${paid.remaining} of 2 messages remaining. You don’t need to pay again.`
      : 'Open Studio to check your remaining messages. You don’t need to pay again.'}</p>
  </div>;
  return <div className="santa-studio-promotion__checkout-note">
    {(sandbox || available) && <button className="santa-studio-promotion__purchase" type="button"
      disabled={checking || !available || busy} onClick={purchase} aria-describedby={noteId}>
      {sandbox
        ? busy ? 'Opening test checkout…' : checking ? 'Checking test checkout…' : 'Purchase — £6.50 (test)'
        : busy ? 'Opening secure checkout…' : 'Purchase — £6.50'}
    </button>}
    <p id={noteId} role="status">
      {sandbox
        ? available
          ? 'Sandbox only — two successful creations for £6.50; no real money moves. Use test card 4242 4242 4242 4242, any future expiry and any three-digit CVC. Secure return emails are live-site only.'
          : checking ? 'Checking sandbox availability…' : 'Sandbox purchases are available in the development preview only.'
        : available
          ? '£6.50 once includes two successful message creations, each with personalised gifts for one child. After payment, you can start your messages or come back later; a private email link lets you use your remaining allowance without an account, not recover recordings. Download your MP3 and gifts before leaving.'
          : checking ? 'Checking purchase availability…' : 'Purchases are currently unavailable. Valid voucher codes still work.'}
    </p>
    {new URLSearchParams(location.search).get('studioCheckout') === 'cancelled' &&
      <p role="status">{sandbox ? 'Test checkout was cancelled.' : 'Checkout was cancelled.'} No new access has been granted. You can try Purchase again.</p>}
    {!checking && <p><Link to={`${STUDIO_PATH}#studio-return-access`}>Already paid? Open your Studio or request an email link</Link></p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Retry purchase check</button></div>}
  </div>;
}
