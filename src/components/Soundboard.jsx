import { useEffect, useRef, useState } from 'react';
import './Soundboard.css';

const PHRASES = ['Are you asleep', 'Been Naughty', 'Cookies', "It's Christmas", 'Jingle Bells', 'Making a List', 'Tis the Season', 'Very Quiet', 'Yes 1', 'Yes 2', 'No 1', 'No 2', 'Happy Holidays', 'Merry Christmas', 'Naughty or Nice', 'Would You Like?'];
const PREVIEWS = [
  "Are you asleep? Because if you're not, I can't come!",
  'Ho ho ho! Have you been naughty or nice this year?',
  'Ho ho ho! I love cookies! Have you left some out for me?',
  "Ho ho ho! Merry Christmas! It's the most wonderful time of the year!",
  'Jingle bells, jingle bells, jingle all the way! Ho ho ho!',
  "Ho ho ho! I'm making a list and checking it twice!",
  'Tis the season to be jolly! Ho ho ho! Merry Christmas!',
  "Shh, be very quiet! I'm sneaking down the chimney!",
  'Ho ho ho! Yes, yes indeed! Santa is on his way!',
  'Why yes! Of course! Ho ho ho! Santa never forgets!',
  "Ho ho! No no no! That's not very nice now is it!",
  "No no no! Ho ho ho! You'd better be good!",
  'Happy holidays to you and your family! Ho ho ho!',
  'Merry Christmas! Ho ho ho! Have a wonderful Christmas!',
  'Hmm, have you been naughty or nice? Ho ho ho!',
  'Ho ho ho! What would you like for Christmas this year?',
];
export default function Soundboard() {
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const speech = useRef(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const play = phrase => {
    if (!window.speechSynthesis) {
      setError('Your browser does not support spoken phrases. Try the Santa Radio app instead.');
      return;
    }
    window.speechSynthesis.cancel();
    if (active === phrase) { setActive(null); return; }
    setError('');
    const utterance = new SpeechSynthesisUtterance(PREVIEWS[PHRASES.indexOf(phrase)]);
    utterance.lang = 'en-GB';
    utterance.pitch = .75;
    utterance.rate = .85;
    speech.current = utterance;
    setActive(phrase);
    utterance.onend = () => { if (speech.current === utterance) setActive(null); };
    utterance.onerror = event => {
      if (speech.current !== utterance) return;
      setActive(null);
      if (event.error !== 'interrupted' && event.error !== 'canceled') setError('No speech voice is available on this device. Try the Santa Radio app instead.');
    };
    window.speechSynthesis.speak(utterance);
  };
  return <section className="soundboard">
    <div className="container">
      <p className="eyebrow" style={{ textAlign: 'center' }}>From Santa’s workshop</p>
      <h2 className="section-title soundboard-title">Santa Soundboard</h2>
      <p className="section-subtitle soundboard-subtitle">A collection of festive phrases to bring a smile. Try a spoken preview below, or explore the <a href="https://apps.apple.com/gb/app/santa-radio/id1021183593" target="_blank" rel="noopener noreferrer" className="soundboard-link">Santa Radio app</a> for more Christmas fun.</p>
      <div className="soundboard-grid" aria-label="Festive spoken previews">
        {PHRASES.map(phrase => <button key={phrase} className={`soundboard-btn ${active === phrase ? 'active' : ''}`} aria-pressed={active === phrase} onClick={() => play(phrase)}>{phrase}</button>)}
      </div>
      <p className="soundboard-hint">These previews use your device’s text-to-speech voice, not an original Santa recording. Press the active phrase again to stop.</p>
      {error && <p role="status" className="soundboard-hint">{error}</p>}
    </div>
  </section>;
}
