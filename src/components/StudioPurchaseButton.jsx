import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function StudioPurchaseButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/santa-studio-checkout', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!controller.signal.aborted) setAvailable(response.ok && data.available === true && data.sandbox === true);
      }).catch(() => { if (!controller.signal.aborted) setAvailable(false); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  const purchase = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/santa-studio-checkout', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sandbox checkout could not be started.');
      if (data.openStudio || data.pending) { navigate('/santa-message-workshop?checkout=return'); return; }
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected checkout address.');
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause.message || 'Sandbox checkout could not be started. Please try again.');
      setBusy(false);
    }
  };
  return <div>
    <button className="santa-studio-promotion__purchase" type="button"
      disabled={checking || !available || busy} onClick={purchase} aria-describedby="studio-purchase-note">
      {busy ? 'Opening test checkout…' : checking ? 'Checking test checkout…' : 'Purchase — £6.50 (test)'}
    </button>
    <p id="studio-purchase-note">
      {available
        ? 'Sandbox only — no real money moves. Use test card 4242 4242 4242 4242, any future expiry and any three-digit CVC. This opens the Studio preview; bundle downloads and email return links are not connected yet.'
        : checking ? 'Checking sandbox availability…' : 'Sandbox purchases are available in the development preview only.'}
    </p>
    {new URLSearchParams(location.search).get('studioCheckout') === 'cancelled' &&
      <p role="status">Test checkout was cancelled. No new access has been granted. You can try Purchase again.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
