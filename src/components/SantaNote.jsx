import { useEffect, useState } from 'react';
import { santaNotes } from '../data/santaNotes.js';
import './SantaNote.css';

export default function SantaNote() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const message = `Santa here... ${santaNotes[index]}`;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => (value + 1) % santaNotes.length), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setVisible(0);
    if (reducedMotion) return;
    let length = 0;
    let timer;
    const delay = setTimeout(() => {
      timer = setInterval(() => {
        length++;
        setVisible(length);
        if (length >= message.length) clearInterval(timer);
      }, 60);
    }, 2000);
    return () => { clearTimeout(delay); clearInterval(timer); };
  }, [message, reducedMotion]);
  const complete = reducedMotion || visible >= message.length;
  const waiting = !reducedMotion && visible === 0;
  return (
    <div className="santa-note" aria-label="A note from Santa">
      <p className="santa-note-sender">A message from Santa</p>
      <p className="santa-note-text" aria-label={message}>
        <span aria-hidden="true">
          {waiting ? <span className="santa-note-dots"><i /><i /><i /></span> : complete ? message : message.slice(0, visible)}
        </span>
      </p>
    </div>
  );
}
