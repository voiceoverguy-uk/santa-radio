import { useEffect, useId, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function StudioPurchaseButton() {
  return <PurchaseButton sandbox={import.meta.env.DEV} />;
}

function PurchaseButton({ sandbox }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const noteId = useId();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/santa-studio-checkout', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!controller.signal.aborted) setAvailable(response.ok && data.available === true
          && (sandbox ? data.sandbox === true : data.mode === 'live' && data.sandbox === false
            && data.amount === 650 && data.currency === 'gbp'));
      }).catch(() => { if (!controller.signal.aborted) setAvailable(false); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [sandbox]);
  const purchase = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/santa-studio-checkout', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout could not be started.');
      if (data.openStudio || data.pending) { navigate('/santa-message-workshop?checkout=return'); return; }
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected checkout address.');
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause.message || 'Checkout could not be started. Please try again.');
      setBusy(false);
    }
  };
  return <div>
    {(sandbox || available) && <button className="santa-studio-promotion__purchase" type="button"
      disabled={checking || !available || busy} onClick={purchase} aria-describedby={noteId}>
      {sandbox
        ? busy ? 'Opening test checkout…' : checking ? 'Checking test checkout…' : 'Purchase — £6.50 (test)'
        : busy ? 'Opening secure checkout…' : 'Purchase — £6.50'}
    </button>}
    <p id={noteId} role="status">
      {sandbox
        ? available
          ? 'Sandbox only — no real money moves. Use test card 4242 4242 4242 4242, any future expiry and any three-digit CVC. This opens the individual Studio preview. Secure return emails are live-site only.'
          : checking ? 'Checking sandbox availability…' : 'Sandbox purchases are available in the development preview only.'
        : available
          ? '£6.50 once for personalised content for one child. Payment opens Studio immediately; a private email link lets you return without an account. Download your MP3 and gifts before leaving.'
          : checking ? 'Checking purchase availability…' : 'Purchases are currently unavailable. Valid voucher codes still work.'}
    </p>
    {new URLSearchParams(location.search).get('studioCheckout') === 'cancelled' &&
      <p role="status">{sandbox ? 'Test checkout was cancelled.' : 'Checkout was cancelled.'} No new access has been granted. You can try Purchase again.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
