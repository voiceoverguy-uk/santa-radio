import { containsWorkshopProfanity } from '../lib/workshopSpellingLanguage.js';
import { useEffect, useRef, useState } from 'react';
import { ShipWheel } from 'lucide-react';
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

function VaultDoors({ opening = false }) {
  return <span className={`christmas-study__vault${opening ? ' christmas-study__vault--opening' : ''}`}
    role={opening ? undefined : 'status'} aria-hidden={opening || undefined}>
    <span className="christmas-study__vault-plate"><ShipWheel size={26} aria-hidden="true" /> Locked in Santa’s vault</span>
  </span>;
}

function MoviesWatched() {
  const [count, setCount] = useState(films.length);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    let frame;
    function tick(now) {
      const progress = Math.min(1, (now - start) / 650);
      setCount(Math.round(films.length * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    setCount(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <span className="christmas-study__watched">Christmas movies watched: <b aria-hidden="true">{count}</b><span className="sr-only">{films.length}</span></span>;
}

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
  const [strikes, setStrikes] = useState(0);
  const [choices, setChoices] = useState([]);
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
    setPhase('committed');
  }

  function rejectEntry(reason) {
    if (reason === 'unknown') setStrikes(0);
    else setStrikes(count => count + 1);
    setPhase(reason);
  }

  function scoreFilm(film) {

    setStrikes(0);
    if (guess && film.year === guess.year && (matchesTitle(guess, film.title) || matchesTitle(film, guess.title))) {
      finishRound('santa');
      return;
    }
    setReaction(reactions[Math.floor(Math.random() * reactions.length)]);
    const id = roundId.current;
    trackingStart.current?.then(() => trackRound('game-reveal', id, film.title));
    finishRound('player');
  }

  async function revealCommittedGuess() {
    if (busy.current) return;
    busy.current = true;
    setPhase('opening');
    try {
      await new Promise(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 850 : 1300));
      if (containsWorkshopProfanity(secret)) return rejectEntry('language');
      const exact = films.filter(film => matchesTitle(film, secret));
      if (exact.length === 1) return scoreFilm(exact[0]);
      const candidates = exact.length ? exact : suggestFilms(secret);
      if (candidates.length) {
        setChoices(candidates);
        return setPhase('confirm-film');
      }
      if (/\b(?:poo|poop|pooping|farting)\b/i.test(secret)) return rejectEntry('language');
      const response = await fetch('/api/santa-knows-christmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-film', title: secret.trim() }), signal: AbortSignal.timeout(9000),
      });
      const result = response.ok ? await response.json() : {};
      if (result.verdict === 'recognised') return scoreFilm({ title: result.title, year: result.year, aliases: [] });
      rejectEntry(['language','invented'].includes(result.verdict) ? result.verdict : 'unknown');
    } catch {
      rejectEntry('unknown');
    } finally {
      busy.current = false;
    }
  }

  function resetRound(resetMatch = false) {
    if (resetMatch) setScore({ player: 0, santa: 0 });
    setSecret('');
    setSealed(false);
    setReaction('');
    setChoices([]);
    if (resetMatch) { setWinner(null); setStrikes(0); }
    setHistory([]);
    setAiTurn(null);
    setPhase('ready');
  }

  return (
    <main id="main-content" className="christmas-study">
      <div className="christmas-study__hero">
        <h1><Link to="/" aria-label="Santa Knows Christmas – Santa Radio homepage"><img src="/images/santa-film-cinema.jpg" alt="Santa Knows Christmas" fetchPriority="high" /></Link></h1>
        <MoviesWatched />
      </div>
      <div className="christmas-study__panel">
        <div className="christmas-study__score" aria-live="polite">
          <span>You <strong>{score.player}</strong></span>
          <span>Santa <strong>{score.santa}</strong></span>
        </div>

        {(phase === 'ready' || sealing) && <>
          <h2 ref={heading} tabIndex={-1}>{round === 1 ? 'Can you stump Santa?' : round === 3 ? 'One apiece! Time for the decider.' : winner === 'player' ? 'Nice win! Right, my turn to try for a point…' : 'Got that one! Can you stump me this time?'}</h2>
          {round === 1 && <p className="christmas-study__challenge">{MAX_QUESTIONS} questions. One guess. Beat Santa twice for 20% off a bespoke Santa&nbsp;message.</p>}
          <form onSubmit={async event => {
            event.preventDefault();
            if (busy.current || sealing || !secret.trim()) return;
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
            <label htmlFor="christmas-secret">{round === 1 ? 'Which Christmas film are you thinking of?' : round === 2 ? 'Which film shall we seal for round two?' : 'One last film for the vault?'} </label>
            <div className="christmas-study__vault-field">
              <input id="christmas-secret" required disabled={sealed || sealing || pending} value={secret} onChange={event => {
                setSecret(event.target.value);
              }}
                placeholder="Lock your answer in the vault" maxLength={160} autoComplete="off"
                aria-describedby="christmas-secret-help" />
              {sealed && <VaultDoors />}
            </div>
            {secret.trim() && !sealed && <button type="button" disabled={pending} onClick={() => {
              setSealed(true);
            }}>Lock it in</button>}
            <small id="christmas-secret-help">Play seals your title until Santa’s final guess.</small>
            <button type="submit" disabled={pending || sealing || !secret.trim()}>{pending || sealing ? "Santa’s thinking…" : `Play round ${round}`}</button>
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

        {['opening', 'confirm-film', 'unknown', 'invented', 'language', 'result'].includes(phase) && <div
          className="christmas-study__vault-field christmas-study__reveal" aria-live="polite">
          <small>Your locked-in film</small>
          <strong>{phase === 'language' || containsWorkshopProfanity(secret) ? 'Title hidden for language' : secret}</strong>
          {phase === 'opening' && <VaultDoors opening />}
        </div>}

        {(phase === 'committed' || phase === 'opening') && <>
          <h2 ref={heading} tabIndex={-1}>{guess ? `My final guess is ${guess.title} (${guess.year})!` : 'You’ve got me guessing. I’ll pass!'}</h2>
          {phase === 'committed' ? <>
            <p>Your film is still sealed. Shall we see what’s inside?</p>
            <button type="button" onClick={revealCommittedGuess}>Open the vault</button>
          </> : null}
        </>}

        {phase === 'confirm-film' && <>
          <h2 ref={heading} tabIndex={-1}>The vault is open. Which film did you mean?</h2>
          {choices.map(film => <button key={film.title + film.year} onClick={() => scoreFilm(film)}>{film.title} ({film.year})</button>)}
          <button onClick={() => rejectEntry('unknown')}>A different film</button>
        </>}

        {['language','invented','unknown'].includes(phase) && <>
          <h2 ref={heading} tabIndex={-1}>{strikes >= 3 ? 'Careful, you’re getting close to the naughty list!' :
            phase === 'language' ? 'Let’s keep it family-friendly, shall we?' :
            phase === 'invented' ? 'Ho ho, I think you made that one up!' : 'That one has my film elves scratching their heads.'}</h2>
          <p>{strikes >= 3 ? 'Three cheeky entries in a row! Back to the start. Pick a real Christmas film this time.' :
            phase === 'unknown' ? 'I couldn’t verify that Christmas film. Check the spelling or try another. No point either way.' :
            'We’ll pretend that didn’t happen. No point either way. Let’s try this round again with a real Christmas film.'}</p>
          <button onClick={() => resetRound(strikes >= 3)}>{strikes >= 3 ? 'Start a new match' : 'Replay this round'}</button>
        </>}

        {phase === 'result' && <>
          <h2 ref={heading} tabIndex={-1}>{winner === 'player' ? 'You stumped Santa!' : 'Santa got it!'}</h2>
          {guess && <p>Santa guessed <strong>{guess.title} ({guess.year})</strong>.</p>}
          {matchWinner && <p className="christmas-study__match">
            {matchWinner === 'player' ? 'You win the match!' : 'Santa wins the match!'}
          </p>}
          {matchWinner === 'player' && <div className="christmas-study__reward">
            <p>You beat Santa! Use <strong>ELFDISCOUNT20</strong> at checkout for 20% off a bespoke message from Santa.</p>
            <a href="/#bespoke-santa-messages">Choose a message for the kids or Dad →</a>
          </div>}
          {winner === 'player' && <p>{reaction}</p>}
          <button type="button" className="christmas-study__next" onClick={() => resetRound(Boolean(matchWinner))}>
            {matchWinner ? 'Play a new match' : 'Next round'}
          </button>
        </>}
      </div>
    </main>
  );
}
