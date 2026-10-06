import { useEffect, useRef, useState } from 'react';
import './Soundboard.css';

const PHRASES = [
  { label: 'Are you asleep', file: 'asleep' },
  { label: 'Been Naughty', file: 'been-naughty' },
  { label: 'Cookies', file: 'cookies' },
  { label: "It's Christmas", file: 'its-christmas' },
  { label: 'Jingle Bells', file: 'jingle-bells' },
  { label: 'Making a List', file: 'making-a-list' },
  { label: 'Tis the Season', file: 'tis-the-season' },
  { label: 'Very Quiet', file: 'very-quiet' },
  { label: 'Happy Holidays', file: 'happy-holidays' },
  { label: 'Merry Christmas', file: 'merry-christmas' },
  { label: 'Naughty or Nice', file: 'naughty-or-nice' },
  { label: 'What Would You Like?', file: 'what-would-you-like' },
];
export default function Soundboard() {
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const stop = () => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
  useEffect(() => stop, []);
  const play = async phrase => {
    const sameClip = audioRef.current?.dataset.clip === phrase.file;
    stop();
    setError('');
    if (sameClip) { setActive(null); return; }
    const audio = new Audio(`/audio/soundboard/${phrase.file}.mp3`);
    audio.dataset.clip = phrase.file;
    audioRef.current = audio;
    setActive(phrase.file);
    const finish = () => {
      if (audioRef.current !== audio) return;
      stop();
      setActive(null);
    };
    const fail = () => {
      if (audioRef.current !== audio) return;
      finish();
      setError(`Could not play “${phrase.label}”. Please try again.`);
    };
    audio.onended = finish;
    audio.onerror = fail;
    try { await audio.play(); } catch { fail(); }
  };
  return <section className="soundboard">
    <div className="container">
      <p className="eyebrow" style={{ textAlign: 'center' }}>From Santa’s workshop</p>
      <h2 className="section-title soundboard-title">Santa Soundboard</h2>
      <p className="section-subtitle soundboard-subtitle">Hear Santa’s original recordings! Pick a festive phrase below, or explore the <a href="https://apps.apple.com/gb/app/santa-radio/id1021183593" target="_blank" rel="noopener noreferrer" className="soundboard-link">Santa Radio app</a> for more Christmas fun.</p>
      <div className="soundboard-grid" aria-label="Santa recordings">
        {PHRASES.map(phrase => <button key={phrase.file} className={`soundboard-btn ${active === phrase.file ? 'active' : ''}`} aria-pressed={active === phrase.file} onClick={() => play(phrase)}>{phrase.label}</button>)}
      </div>
      <p className="soundboard-hint">Press a phrase to play. Press it again to stop, or choose another recording.</p>
      {error && <p role="status" className="soundboard-hint">{error}</p>}
    </div>
  </section>;
}
