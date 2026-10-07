import { useEffect, useState } from 'react';
import { santaNotes, daysUntilChristmasEve, formatSantaNote } from '../data/santaNotes.js';
import './SantaNote.css';

export default function SantaNote({ variant = 'bubble' }) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [readyMessage, setReadyMessage] = useState(null);
  const [days, setDays] = useState(daysUntilChristmasEve);
  const message = `Santa here... ${formatSantaNote(santaNotes[index], days)}`;
  useEffect(() => {
    const refresh = () => setDays(daysUntilChristmasEve());
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => (value + 1) % santaNotes.length), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (reducedMotion) {
      setReadyMessage(message);
      return undefined;
    }
    const timer = setTimeout(() => setReadyMessage(message), 2000);
    return () => clearTimeout(timer);
  }, [message, reducedMotion]);
  const waiting = !reducedMotion && readyMessage !== message;
  const inline = variant === 'inline';
  return (
    <div className={`santa-note${inline ? ' santa-note--inline' : ''}`} aria-label="A note from Santa">
      {!inline && <p className="santa-note-sender">A message from Santa</p>}
      <div className={inline ? 'santa-note-inline-group' : undefined}>
        <p className="santa-note-text" aria-label={message}>
          <span aria-hidden="true">
            {waiting ? <span className="santa-note-dots"><i /><i /><i /></span> : message}
          </span>
        </p>
        {inline && <p className="santa-note-caption">Sent with Elfie</p>}
      </div>
    </div>
  );
}
