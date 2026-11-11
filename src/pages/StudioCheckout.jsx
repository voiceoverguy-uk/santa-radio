import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata } from '../seo/catalogue.js';
import { STUDIO_PATH, STUDIO_CHECKOUT_PATH } from '../lib/studioRoute.js';
import './StudioCheckout.css';

let stripeScript;
function loadStripeScript() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeScript) stripeScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error('Stripe loading timed out.')); }, 20000);
    script.onload = () => { clearTimeout(timer); window.Stripe ? resolve(window.Stripe) : reject(new Error('Stripe did not load.')); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Stripe could not load.')); };
    document.head.appendChild(script);
  }).catch(error => { stripeScript = null; throw error; });
  return stripeScript;
}

export default function StudioCheckout() {
  const navigate = useNavigate();
  const container = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'santaradio.co.uk') {
      window.location.replace(`https://www.santaradio.co.uk${STUDIO_CHECKOUT_PATH}`);
      return;
    }
    let disposed = false, checkout, stage = 'purchase-check';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    setError(''); setReady(false);
    const request = async (path, options = {}) => {
      const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...options });
      const data = await response.json();
      if (!response.ok) { const error = new Error('Checkout request failed.'); error.status = response.status; throw error; }
      return data;
    };
    (async () => {
      const stripeReady = loadStripeScript().then(Stripe => ({ Stripe }), () => ({ failed: true }));
      const [access, offer] = await Promise.all([
        request('/api/santa-studio-access'), request('/api/santa-studio-checkout?prepare=1'),
      ]);
      if (disposed) return;
      if (access.authorized === true && access.mode === 'live' && access.remaining !== 0) { navigate(STUDIO_PATH, { replace: true }); return; }
      if (!offer.configured || offer.mode !== 'live' || offer.amount !== 650 || offer.currency !== 'gbp') {
        throw new Error('Purchases are currently unavailable. Please try again later.');
      }
      if (offer.checkoutMode !== 'embedded' || !/^pk_live_[A-Za-z0-9]+$/.test(offer.publishableKey || '')) {
        throw new Error('This payment page is being prepared. Please return to Santa Radio to purchase.');
      }
      stage = 'payment-session';
      const session = await request('/api/santa-studio-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (disposed) return;
      if (session.pending) { navigate(`${STUDIO_PATH}?checkout=return`, { replace: true }); return; }
      // A checkout already opened before the redesign is safely resumed.
      if (session.url) {
        const url = new URL(session.url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('Unexpected checkout address.');
        window.location.assign(url.href); return;
      }
      if (typeof session.clientSecret !== 'string' || !session.clientSecret.startsWith('cs_live_')) throw new Error('Checkout could not be loaded.');
      stage = 'stripe-form';
      const loaded = await stripeReady;
      if (disposed) return;
      if (loaded.failed) throw new Error('Stripe could not load.');
      checkout = await loaded.Stripe(offer.publishableKey).initEmbeddedCheckout({ clientSecret: session.clientSecret });
      if (disposed) { checkout.destroy(); return; }
      checkout.mount(container.current);
      setReady(true);
    })().catch(cause => {
      if (!disposed) {
        console.warn('[studio-checkout]', { stage, status: cause.status || null });
        setError(cause.status === 409
          ? 'Your browser couldn’t keep the essential checkout cookie. If Block All Cookies is enabled, turn it off and retry. You can keep cross-site tracking protection on.'
          : cause.status === 429
          ? 'There have been several checkout attempts. Please wait 15 minutes before trying again. If you have already paid, open your Studio below.'
          : stage === 'stripe-form'
            ? 'Stripe’s secure payment form couldn’t load in this browser. Please retry. If you use a content blocker, allow Stripe on this page.'
            : 'We couldn’t prepare secure checkout. Please retry in a moment. If you have already paid, open your Studio below.');
      }
    }).finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); checkout?.destroy(); };
  }, [attempt, navigate]);
  return <>
    <PageSeo metadata={pageMetadata({ path: STUDIO_CHECKOUT_PATH, title: 'Secure Message Maker checkout | Santa Radio',
      description: 'Purchase two personalised Santa messages securely with Stripe.', noindex: true })} />
    <main className="studio-checkout">
      <section className="studio-checkout__story" aria-labelledby="checkout-title">
        <Link className="studio-checkout__home" to="/" aria-label="Back to Santa Radio">
          <img src="/images/santa-radio-gold-nav.webp" alt="Santa Radio" />
        </Link>
        <div className="studio-checkout__copy">
          <p className="studio-checkout__eyebrow">STRAIGHT FROM THE NORTH POLE</p>
          <h1 id="checkout-title">A little Christmas magic.<br />Just for them.</h1>
          <p className="studio-checkout__lead">Two bespoke messages, in Santa’s own voice.</p>
          <p className="studio-checkout__price">£6.50 <span>one-off payment</span></p>
          <ul><li>2 personalised MP3 messages</li><li>3 personalised gifts with each message: a Santa picture, letter and Nice List certificate</li><li>Create now, or return later with your private access link</li></ul>
          <p className="studio-checkout__small">Download your messages and gifts before leaving Studio. Your unused allowance is kept; recordings aren’t stored.</p>
        </div>
        <Link className="studio-checkout__back" to="/">← Back to Santa Radio</Link>
      </section>
      <section className="studio-checkout__payment" aria-label="Secure Stripe payment">
        <div className="studio-checkout__payment-inner">
          <p className="studio-checkout__secure">SECURE PAYMENT · POWERED BY STRIPE</p>
          {!ready && !error && <p role="status">Preparing your secure payment form…</p>}
          {error && <div role="alert" className="studio-checkout__error"><p>{error}</p>
            <button className="btn-red" type="button" onClick={() => setAttempt(value => value + 1)}>Retry checkout</button>
            <p><Link to="/free-santa-message#message-help">Troubleshooting &amp; cookie help</Link></p>
            <p><Link to={STUDIO_PATH}>Already paid? Open your Studio</Link></p>
          </div>}
          <div ref={container} />
          <p className="studio-checkout__terms">After payment, we’ll confirm your purchase before you start creating.</p>
          <Link to="/privacy-policy">Privacy policy</Link>
        </div>
      </section>
    </main>
  </>;
}
