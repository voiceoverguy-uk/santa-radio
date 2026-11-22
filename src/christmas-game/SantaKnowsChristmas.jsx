import { useEffect, useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { suggestFilms, matchesTitle, MAX_QUESTIONS, nextTurn } from './engine.js';
import { films } from './films.js';
import { questionWording } from './question-wording.js';
import './santa-knows-christmas.css';

async function trackRound(action, eventId, title) {
  await fetch('/api/message-statistics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, eventId, title }), keepalive: true,
  }).catch(() => {});
}

const reactions = [
  'Ah yes, you got me. Next time I’ll try harder!',
  'One point to you. I’ll put that one on for the elves tonight!',
  'Well played! Pass the popcorn. Santa has some homework.',
  'You’ve earned bragging rights at the North Pole!',
  'Even with twenty questions in my stocking, that one got away!',
  'Mrs Claus is going to ask how I missed that one.',
];

export default function SantaKnowsChristmas() {
  const [aiTurn, setAiTurn] = useState(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [phase, setPhase] = useState('ready');
  const [history, setHistory] = useState([]);
  const recentOpenerIds = useRef([]);
  const roundsStarted = useRef(0);
  const wordingOffset = useRef(null);
  const [questionOrder, setQuestionOrder] = useState({ seed: 0, recentOpeners: [] });
  const [score, setScore] = useState({ player: 0, santa: 0 });
  const [secret, setSecret] = useState('');
  const [sealed, setSealed] = useState(false);
  const roundId = useRef(null);
  const trackingStart = useRef(null);
  const [reaction, setReaction] = useState('');
  const [reveal, setReveal] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [winner, setWinner] = useState(null);
  const heading = useRef(null);
  const sealing = phase === 'sealing';
  const { question, guess } = aiTurn ?? nextTurn(history, questionOrder);
  const matchWinner = score.player === 2 ? 'player' : score.santa === 2 ? 'santa' : null;
  const round = score.player + score.santa + (phase === 'result' ? 0 : 1);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [phase, history.length]);

  function finishRound(roundWinner) {
    setWinner(roundWinner);
    setScore(current => ({ ...current, [roundWinner]: current[roundWinner] + 1 }));
    setPhase('result');
  }

  async function requestTurn(turns, seed = questionOrder.seed) {
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/santa-knows-christmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, history: turns.map(({ question, answer }) => ({ question: question.text, answer })) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      const turn = await response.json();
      if (turn.mode !== 'ai') return null;
      if (turn.question) {
        return { question: { id: `ai-${turns.length}`, text: turn.question, responses: [] } };
      }
      const guess = turn.guess;
      return { guess: guess && (films.find(film => film.year === guess.year && matchesTitle(film, guess.title)) ??
        { ...guess, aliases: [] }) };
    } catch {
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function answer(value) {
    if (busy.current) return;
    const updated = [...history, { question, answer: value }];
    const adaptive = aiTurn ? await requestTurn(updated) : null;
    setAiTurn(adaptive);
    setHistory(updated);
    const turn = adaptive ?? nextTurn(updated, questionOrder);
    if (turn.question) return;
    if (!turn.guess) {
      finishRound('player');
    } else if (sealed) {
      if (matchesTitle(turn.guess, secret)) finishRound('santa');
      else if (suggestFilms(secret).some(film => film.title === turn.guess.title && film.year === turn.guess.year)) {
        setPhase('check-spelling');
      } else finishRound('player');
    } else {
      setPhase('guess');
    }
  }

  function openVault(title) {
    if (revealed || !title.trim()) return;
    const known = films.find(film => matchesTitle(film, title));
    const suggestion = known ? null : suggestFilms(title)[0];
    setReaction(known ? reactions[Math.floor(Math.random() * reactions.length)]
      : suggestion ? `Did you mean ${suggestion.title}? That spelling kept me on my toes!`
      : `“${title.trim()}”? That’s a new one on me! I’ll ask the elves on film night.`);
    setRevealed(true);
    const id = roundId.current;
    if (id) trackingStart.current?.then(() => trackRound('game-reveal', id, known?.title ?? title.trim()));
  }

  function resetRound(resetMatch = false) {
    if (resetMatch) setScore({ player: 0, santa: 0 });
    setSecret('');
    setSealed(false);
    setReaction('');
    setReveal('');
    setRevealed(false);
    setWinner(null);
    setHistory([]);
    setAiTurn(null);
    setPhase('ready');
  }

  return (
    <main id="main-content" className="christmas-study">
      <div className="christmas-study__hero">
        <h1><img src="/images/santa-film-cinema.jpg" alt="Santa Knows Christmas" fetchPriority="high" /></h1>
      </div>
      <div className="christmas-study__panel">
        <div className="christmas-study__score" aria-live="polite">
          <span>You <strong>{score.player}</strong></span>
          <span>Santa <strong>{score.santa}</strong></span>
        </div>

        {(phase === 'ready' || sealing) && <>
          <h2 ref={heading} tabIndex={-1}>Can you stump Santa?</h2>
          <p>Santa’s watched {films.length} Christmas films and specials. Pick one, keep it secret and put him to the test.</p>
          <p>Santa has up to {MAX_QUESTIONS} questions and one guess. Stump him to score a point. First to two points wins a 20% voucher for a bespoke message from Santa.</p>
          <form onSubmit={async event => {
            event.preventDefault();
            if (busy.current || sealing) return;
            roundId.current = window.crypto.randomUUID();
            trackingStart.current = trackRound('game-start', roundId.current);
            const seed = Math.floor(Math.random() * 1_000_000);
            const recentOpeners = recentOpenerIds.current;
            const opener = nextTurn([], { seed, recentOpeners }).question.id;
            recentOpenerIds.current = [...recentOpeners, opener].slice(-3);
            wordingOffset.current ??= seed % 4;
            setQuestionOrder({ seed, recentOpeners, wordingIndex: wordingOffset.current + roundsStarted.current++ });
            const hasSecret = Boolean(secret.trim());
            setSealed(hasSecret);
            if (hasSecret && !sealed) setPhase('sealing');
            const sealConfirmation = hasSecret && !sealed
              ? new Promise(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 650))
              : undefined;
            const [turn] = await Promise.all([requestTurn([], seed), sealConfirmation]);
            setAiTurn(turn);
            setPhase('question');
          }}>
            <label htmlFor="christmas-secret">Seal your film title (optional)</label>
            <div className="christmas-study__vault-field">
              <input id="christmas-secret" disabled={sealed || sealing || pending} value={secret} onChange={event => {
                setSecret(event.target.value);
              }}
                placeholder="Type the film title" maxLength={160} autoComplete="off"
                aria-describedby="christmas-secret-help" />
              {sealed && <span className="christmas-study__vault" role="status">
                <LockKeyhole size={19} aria-hidden="true" /> Locked in Santa’s vault
              </span>}
            </div>
            {secret.trim() && !sealed && <button type="button" disabled={pending} onClick={() => {
              setSealed(true);
            }}>Lock it in</button>}
            <small id="christmas-secret-help">Santa guesses from your answers alone. Reveal a winning title to add it to our film tally.</small>
            <button type="submit" disabled={pending || sealing}>{pending || sealing ? "Santa’s thinking…" : `Play round ${round}`}</button>
          </form>
        </>}

        {phase === 'question' && <>
          <p className="christmas-study__progress">Round {round} · Question {history.length + 1} of {MAX_QUESTIONS} · {aiTurn ? 'GPT' : 'Film catalogue'}</p>
          <h2 ref={heading} tabIndex={-1}>{questionWording(question, questionOrder.wordingIndex)}</h2>
          <div className="christmas-study__answers">
            <button type="button" disabled={pending} onClick={() => answer(true)}>Yes</button>
            <button type="button" disabled={pending} onClick={() => answer(false)}>No</button>
            <button type="button" disabled={pending} onClick={() => answer(null)}>I don’t know</button>
          </div>
        </>}

        {phase === 'check-spelling' && <>
          <h2 ref={heading} tabIndex={-1}>Santa guessed {guess.title} ({guess.year}).</h2>
          <p>The vault says “{secret.trim()}”. Did Santa guess the film you meant?</p>
          <div className="christmas-study__answers">
            <button type="button" onClick={() => finishRound('santa')}>Yes, that’s my film</button>
            <button type="button" onClick={() => finishRound('player')}>No, I stumped Santa</button>
          </div>
        </>}

        {phase === 'guess' && <>
          <h2 ref={heading} tabIndex={-1}>Is it {guess.title} ({guess.year})?</h2>
          <div className="christmas-study__answers">
            <button type="button" onClick={() => finishRound('santa')}>Yes, Santa got it</button>
            <button type="button" onClick={() => finishRound('player')}>No, I stumped Santa</button>
          </div>
        </>}

        {phase === 'result' && <>
          <h2 ref={heading} tabIndex={-1}>{winner === 'player' ? 'You stumped Santa!' : 'Santa got it!'}</h2>
          {guess && <p>Santa guessed <strong>{guess.title} ({guess.year})</strong>.</p>}
          {matchWinner && <p className="christmas-study__match">
            {matchWinner === 'player' ? 'You win the match!' : 'Santa wins the match!'}
          </p>}
          {matchWinner === 'player' && <div className="christmas-study__reward">
            <p>You beat Santa! Use <strong>Santa20</strong> at checkout for 20% off a bespoke message from Santa.</p>
            <a href="/#bespoke-santa-messages">Choose a message for the kids or Dad →</a>
          </div>}
          {winner === 'player' && sealed && !revealed && <>
            <p>You win this round. Let’s open the vault and see which film you were thinking of.</p>
            <button type="button" onClick={() => openVault(secret)}>Open the vault</button>
          </>}
          {winner === 'player' && revealed && <div aria-live="polite">
            <div className="christmas-study__vault-field christmas-study__reveal">
              <strong>{sealed ? secret.trim() : reveal.trim()}</strong>
              {sealed && <span className="christmas-study__vault christmas-study__vault--opening" aria-hidden="true" />}
            </div>
            <p>{reaction}</p>
          </div>}
          {winner === 'player' && !sealed && !revealed && <form onSubmit={event => {
            event.preventDefault();
            openVault(reveal);
          }}>
            <label htmlFor="christmas-reveal">Which Christmas film was it?</label>
            <input id="christmas-reveal" value={reveal} onChange={event => setReveal(event.target.value)}
              placeholder="Type the film title" maxLength={160} autoComplete="off" />
            <button type="submit" disabled={!reveal.trim()}>Reveal my film</button>
          </form>}
          <button type="button" className="christmas-study__next" onClick={() => resetRound(Boolean(matchWinner))}>
            {matchWinner ? 'Play a new match' : 'Next round'}
          </button>
        </>}
        {phase !== 'result' && round === 1 && <Link to="/" className="christmas-study__back">Back to Santa Radio</Link>}
      </div>
    </main>
  );
}
