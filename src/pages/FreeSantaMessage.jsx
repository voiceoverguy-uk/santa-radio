import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import PageSeo from '../seo/PageSeo.jsx';
import { messageMetadata } from '../seo/catalogue.js';
import { santaMessageRequestedName } from '../seo/santaMessageLinks.js';
import { settleSantaMessageDeskAfterEntry } from '../lib/scrollToSantaMessageDesk.js';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import { peekFreeSantaMessageName, clearFreeSantaMessageName } from '../lib/freeSantaMessageHandoff.js';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import './FreeSantaMessage.css';

export default function FreeSantaMessage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [handoff, setHandoff] = useState(() => ({
    name: peekFreeSantaMessageName(), entryKey: location.key,
  }));
  const handoffName = handoff.entryKey === location.key ? handoff.name : '';
  const requestedName = handoffName || santaMessageRequestedName(params.get('name'));
  useEffect(() => {
    // The mounted page owns the choice through signup. Leaving it, including
    // Back/Forward, must not seed an unrelated later visit.
    clearFreeSantaMessageName();
    setHandoff(current => current.entryKey === location.key
      ? current : { name: '', entryKey: location.key });
  }, [location.key]);
  useEffect(() => {
    if (location.hash === '#message-help') {
      const help = document.getElementById('message-help');
      help?.scrollIntoView({ block: 'start' });
      help?.focus({ preventScroll: true });
      return;
    }
    let cancelled = false;
    let frame;
    let stopSettling;
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const cancel = () => { cancelled = true; };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const stopListening = () => events.forEach(event => window.removeEventListener(event, cancel));
    events.forEach(event => window.addEventListener(event, cancel, { passive: true }));

    // Font metrics can change both the banner height and the centred columns.
    // Position when they are ready. On touch-sized screens, allow the keyboard
    // to settle briefly; interaction always cancels any remaining correction.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        stopListening();
        if (cancelled) return;
        const card = document.querySelector('#santa-messages .santa-message-box');
        const heading = card?.querySelector('h3');
        heading?.focus({ preventScroll: true });
        stopSettling = settleSantaMessageDeskAfterEntry(card);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopSettling?.();
      stopListening();
      window.history.scrollRestoration = restoration;
    };
  }, [location.key, location.hash]);
  return (
    <main>
      <PageSeo metadata={messageMetadata()} />
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <p className="fsm-kicker">Special delivery from the North Pole</p>
          <h1 className="fsm-sub">Free Personalised Santa Message</h1>
          <p className="fsm-desc">Create a free message from Santa with your child’s name. Choose a name, ask Santa to record it, then enjoy your personalised Santa audio greeting to download and keep.</p>
          <Link className="fsm-help-link" to="#message-help">Need help? Troubleshooting &amp; cookies</Link>
        </div>
      </div>
      <SantaMessageForm key={requestedName} showDetailLink={false} initialName={requestedName}
        selectedChildName={requestedName} layout="dedicated" />
      <section className="fsm-help" id="message-help" tabIndex={-1} aria-labelledby="message-help-title">
        <h2 id="message-help-title">A little help from the elves</h2>
        <p>Troubleshooting for free messages and the paid Message Maker Studio.</p>
        <details open>
          <summary>Checkout won’t load? Check blocked cookies</summary>
          <p>Secure checkout needs an essential cookie to remember your purchase session. Blocking all cookies can stop the payment form opening.</p>
          <ol>
            <li>On iPhone or iPad, open <strong>Settings → Apps → Safari → Advanced</strong>.</li>
            <li>Turn off <strong>Block All Cookies</strong>, then return here and reload checkout.</li>
          </ol>
          <p>You can leave <strong>Prevent Cross-Site Tracking</strong> on. You don’t need to accept optional advertising cookies on Santa Radio.</p>
          <p>Using another browser? Allow cookies for Santa Radio in its site settings. <a href="https://support.apple.com/en-gb/105082" target="_blank" rel="noopener noreferrer">Apple’s Safari cookie guide</a></p>
        </details>
        <details>
          <summary>I’ve paid — how do I get back in?</summary>
          <p><Link to={STUDIO_PATH}>Open your Studio</Link> in the same browser, or use your private email link. If needed, request a new link using the email you paid with. You don’t need to pay again to use your remaining messages.</p>
          <p>Your link keeps your unused allowance, not your recordings. Download each MP3 and its gifts before leaving Studio.</p>
        </details>
        <details>
          <summary>I can’t hear or find my message</summary>
          <p>Tap Play and check your media volume. If another app is playing audio, pause it and try again. After downloading, check your browser’s Downloads or the Files app on your phone.</p>
        </details>
        <details>
          <summary>Still stuck?</summary>
          <p><Link to="/submit-a-song">Contact the Santa Radio team</Link> with your device, browser and the error wording. A screenshot helps — leave out card details, voucher codes and private access links.</p>
        </details>
      </section>
    </main>
  );
}
