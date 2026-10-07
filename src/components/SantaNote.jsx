import { useEffect, useState } from 'react';
import { santaNotes, daysUntilChristmasEve, formatSantaNote } from '../data/santaNotes.js';
import './SantaNote.css';

export default function SantaNote() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [readyMessage, setReadyMessage] = useState(null);
  const [days, setDays] = useState(daysUntilChristmasEve);
  const message = `Santa here... ${formatSantaNote(santaNotes[index], days)}`;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setReadyMessage(message), 2000);
    return () => clearTimeout(timer);
  }, [message, reducedMotion]);
  useEffect(() => {
    const refresh = () => setDays(daysUntilChristmasEve());
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => (value + 1) % santaNotes.length), 15000);
    return () => clearInterval(timer);
  }, []);
  const waiting = !reducedMotion && readyMessage !== message;
  return (
    <div className="santa-note" aria-label="A note from Santa">
      <p key={`${message}-${waiting ? 'waiting' : 'ready'}`} className={`santa-note-text${waiting ? ' is-waiting' : ''}`} aria-label={message}>
        <span aria-hidden="true">
          {waiting ? <span className="santa-note-dots"><i /><i /><i /></span> : message}
        </span>
      </p>
    </div>
  );
}
