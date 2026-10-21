import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSeo from '../seo/PageSeo.jsx';
import { messageMetadata } from '../seo/catalogue.js';
import { santaMessageRequestedName } from '../seo/santaMessageLinks.js';
import { scrollToSantaMessageDesk } from '../lib/scrollToSantaMessageDesk.js';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import './FreeSantaMessage.css';

export default function FreeSantaMessage() {
  const [params] = useSearchParams();
  const requestedName = santaMessageRequestedName(params.get('name'));
  useEffect(() => {
    let cancelled = false;
    let frame;
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const cancel = () => { cancelled = true; };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const stopListening = () => events.forEach(event => window.removeEventListener(event, cancel));
    events.forEach(event => window.addEventListener(event, cancel, { passive: true }));

    // Font metrics can change both the banner height and the centred columns.
    // Position once when they are ready, never after the visitor starts using
    // the page. No resize observer or form-state dependency should pull them back.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        stopListening();
        if (cancelled) return;
        scrollToSantaMessageDesk();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopListening();
      window.history.scrollRestoration = restoration;
    };
  }, []);
  return (
    <main>
      <PageSeo metadata={messageMetadata()} />
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <p className="fsm-kicker">Special delivery from the North Pole</p>
          <h1 className="fsm-sub">Free Personalised Santa Message</h1>
          <p className="fsm-desc">Create a free message from Santa with your child’s name. Choose a recorded name, listen to a personalised Santa audio greeting and download your MP3 to keep.</p>
        </div>
      </div>
      <SantaMessageForm key={requestedName} showDetailLink={false} initialName={requestedName} />
    </main>
  );
}
