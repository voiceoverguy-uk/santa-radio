import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import PageSeo from '../seo/PageSeo.jsx';
import { messageMetadata } from '../seo/catalogue.js';
import { santaMessageRequestedName } from '../seo/santaMessageLinks.js';
import { settleSantaMessageDeskAfterEntry } from '../lib/scrollToSantaMessageDesk.js';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import { peekFreeSantaMessageName, clearFreeSantaMessageName } from '../lib/freeSantaMessageHandoff.js';
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
    // Reset the previous page's scroll position before fonts and form layout settle.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // Ordinary visitors start at the page heading; name handoffs still open the maker.
    if (!requestedName && !location.hash) return;
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
        stopSettling = settleSantaMessageDeskAfterEntry(location.hash === '#santa-messages' ? document.querySelector('#santa-messages .message-layout') : card);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopSettling?.();
      stopListening();
      window.history.scrollRestoration = restoration;
    };
  }, [location.key, location.hash, requestedName]);
  return (
    <main>
      <PageSeo metadata={messageMetadata()} />
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <p className="fsm-kicker">Special delivery from the North Pole</p>
          <h1 className="fsm-sub">Free Personalised Santa Message</h1>
          <p className="fsm-desc">Create a free message from Santa with your child’s name. Choose a name from over 10,000. Ask Santa to record it, then preview and download a personalised message with their name and Santa’s voice.</p>
        </div>
      </div>
      <SantaMessageForm key={requestedName} showDetailLink={false} initialName={requestedName}
        selectedChildName={requestedName} layout="dedicated" />
    </main>
  );
}
