import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import './StudioPaymentSuccess.css';

export default function StudioPaymentSuccess({ remaining, firstName = '', sandbox = false }) {
  const title = useRef(null);
  useEffect(() => { title.current?.focus(); window.scrollTo(0, 0); }, []);
  return <main className="studio-success">
    <section className="studio-success__card" aria-labelledby="studio-success-title">
      <img className="studio-success__portrait" src="/images/north-pole-hero.webp"
        alt="The snowy North Pole village beneath the Northern Lights" />
      <div className="studio-success__content">
        <p className="studio-success__eyebrow">A LITTLE NORTH POLE MAGIC</p>
        <span className="studio-success__tick" aria-hidden="true">✓</span>
        <h1 ref={title} tabIndex={-1} id="studio-success-title">{sandbox ? 'Test payment confirmed' : 'Payment successful'}</h1>
        <p className="studio-success__lead">{firstName ? `Hi ${firstName}, thank you for your purchase!` : 'Thank you! Your Message Maker purchase is confirmed.'}</p>
        <p>Your purchase includes <strong>2 personalised messages from Santa</strong>, each with a Nice List certificate, a letter and a Santa picture.</p>
        <p className="studio-success__allowance" role="status">{remaining === null
          ? 'Your remaining messages will be checked when you open Studio.'
          : remaining === 0 ? 'Both messages from this purchase have been created.'
            : `You can now create ${remaining} ${remaining === 1 ? 'message' : 'messages'}.`}</p>
        {!sandbox && <p><Link to="/my-santa-messages">Sign in to save your messages and gifts</Link> using your purchase email before you start creating.</p>}
        <Link className="btn-red studio-success__start" to={STUDIO_PATH} replace>
          {remaining === 0 ? 'Open your Studio' : 'Create your bespoke message'}
        </Link>
        <div className="studio-success__return">
          <h2>Come back whenever you’re ready</h2>
          <p>On this browser, use “Create your messages” or the remaining-message button in the Message Maker section of our homepage. You won’t need to pay again.</p>
          <p>On another device, or if this browser no longer recognises you, use your private email link or “Already purchased?” on the Studio page to request a fresh link.</p>
          <p className="studio-success__download">Sign in before creating to save new recordings and gifts until 31 January after Christmas. Without an account, download everything before leaving Studio. Previously unsaved recordings cannot be recovered.</p>
        </div>
        <Link className="studio-success__later" to="/">Back to Santa Radio — I’ll create them later</Link>
      </div>
    </section>
  </main>;
}
