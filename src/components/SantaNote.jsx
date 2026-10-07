import { useEffect, useState } from 'react';
import { santaNotes, daysUntilChristmasEve, formatSantaNote } from '../data/santaNotes.js';
import './SantaNote.css';

export default function SantaNote() {
  const [index, setIndex] = useState(0);
  const [days, setDays] = useState(daysUntilChristmasEve);
  const message = `Santa here... ${formatSantaNote(santaNotes[index], days)}`;
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
  return (
    <div className="santa-note" aria-label="A note from Santa">
      <p key={message} className="santa-note-text" aria-label={message}>
        <span aria-hidden="true">
          {message}
        </span>
      </p>
    </div>
  );
}
