import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCategory, VaultDoors } from './VaultControls.jsx';
import { vaultTransfer } from './vault-transfer.js';
import './santa-knows-christmas.css';

export default function ChristmasStudyPromo() {
  const [category, setCategory] = useState('film');
  const [answer, setAnswer] = useState('');
  const [locked, setLocked] = useState(false);
  const timer = useRef();
  const navigate = useNavigate();
  useEffect(() => () => clearTimeout(timer.current), []);
  function play(event) {
    event.preventDefault();
    if (!answer.trim() || locked) return;
    setLocked(true);
    timer.current = setTimeout(() => {
      vaultTransfer.current = { category, answer: answer.trim() };
      navigate('/santa-knows-christmas');
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
  }
  return <section className="christmas-study-promo" aria-labelledby="christmas-study-promo-title">
    <h2 id="christmas-study-promo-title">Santa Knows Christmas</h2>
    <p>Can you beat Santa at Christmas films?</p>
    <form onSubmit={play}>
      <GameCategory value={category} disabled={locked} onChange={value => {setCategory(value); setAnswer('');}} />
      <label htmlFor="homepage-game-secret">Your secret {category}</label>
      <div className="christmas-study__vault-field">
        <input id="homepage-game-secret" required maxLength={160} autoComplete="off" disabled={locked} value={answer}
          placeholder="Lock your answer in the vault" onChange={e => setAnswer(e.target.value)} />
        {locked && <VaultDoors />}
      </div>
      <button disabled={locked || !answer.trim()}>Lock in &amp; play</button>
    </form>
  </section>;
}
