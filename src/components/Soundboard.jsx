import { useState, useEffect, useRef } from 'react';
import './Soundboard.css';

const PHRASES = [
  { label: 'Are you asleep', text: "Are you asleep? Because if you're not, I can't come!" },
  { label: 'Been Naughty', text: "Ho ho ho! Have you been naughty or nice this year?" },
  { label: 'Cookies', text: "Ho ho ho! I love cookies! Have you left some out for me?" },
  { label: "It's Christmas", text: "Ho ho ho! Merry Christmas! It's the most wonderful time of the year!" },
  { label: 'Jingle Bells', text: "Jingle bells, jingle bells, jingle all the way! Ho ho ho!" },
  { label: 'Making a List', text: "Ho ho ho! I'm making a list and checking it twice!" },
  { label: 'Tis the Season', text: "Tis the season to be jolly! Ho ho ho! Merry Christmas!" },
  { label: 'Very Quiet', text: "Shh, be very quiet! I'm sneaking down the chimney!" },
  { label: 'Yes 1', text: "Ho ho ho! Yes, yes indeed! Santa is on his way!" },
  { label: 'Yes 2', text: "Why yes! Of course! Ho ho ho! Santa never forgets!" },
  { label: 'No 1', text: "Ho ho! No no no! That's not very nice now is it!" },
  { label: 'No 2', text: "No no no! Ho ho ho! You'd better be good!" },
  { label: 'Happy Holidays', text: "Happy holidays to you and your family! Ho ho ho!" },
  { label: 'Merry Christmas', text: "Merry Christmas! Ho ho ho! Have a wonderful Christmas!" },
  { label: 'Naughty or Nice', text: "Hmm, have you been naughty or nice? Ho ho ho!" },
  { label: 'Would You Like?', text: "Ho ho ho! What would you like for Christmas this year?" },
];

function speakPhrase(text, onStart, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.toLowerCase().includes('daniel') ||
    v.name.toLowerCase().includes('alex') ||
    v.name.toLowerCase().includes('george') ||
    v.name.toLowerCase().includes('arthur') ||
    (v.lang === 'en-GB' && v.localService)
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

  if (preferred) utterance.voice = preferred;
  utterance.pitch = 0.75;
  utterance.rate = 0.85;
  utterance.volume = 1;

  utterance.onstart = onStart;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.speak(utterance);
}

export default function Soundboard() {
  const [activePhrase, setActivePhrase] = useState(null);
  const [voicesReady, setVoicesReady] = useState(false);

  useEffect(() => {
    const load = () => setVoicesReady(true);
    if (window.speechSynthesis) {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoicesReady(true);
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', load, { once: true });
      }
    }
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', load);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handlePress = (phrase) => {
    if (activePhrase === phrase.label) {
      window.speechSynthesis?.cancel();
      setActivePhrase(null);
      return;
    }
    speakPhrase(
      phrase.text,
      () => setActivePhrase(phrase.label),
      () => setActivePhrase(null)
    );
  };

  return (
    <section className="soundboard starry-bg">
      <div className="container">
        <h2 className="section-title soundboard-title">Santa Soundboard</h2>
        <p className="section-subtitle soundboard-subtitle">
          Press the buttons to hear Santa speak! Have fun exploring festive phrases straight from the North Pole!
          <br />
          Or{' '}
          <a
            href="https://apps.apple.com/gb/app/santa-radio/id1021183593"
            target="_blank"
            rel="noopener noreferrer"
            className="soundboard-link"
          >
            <strong>download the free app</strong>
          </a>{' '}
          for even more Christmas fun!
        </p>
        <div className="soundboard-grid">
          {PHRASES.map(phrase => (
            <button
              key={phrase.label}
              className={`soundboard-btn ${activePhrase === phrase.label ? 'active' : ''}`}
              onClick={() => handlePress(phrase)}
              title={phrase.text}
            >
              {phrase.label}
              {activePhrase === phrase.label && <span className="speaking-dot" />}
            </button>
          ))}
        </div>
        {!voicesReady && (
          <p className="soundboard-hint">Loading Santa's voice...</p>
        )}
      </div>
      <div className="snow-trees" />
    </section>
  );
}
