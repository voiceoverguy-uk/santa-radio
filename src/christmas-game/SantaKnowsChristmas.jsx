import { useEffect, useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { suggestFilms, matchesTitle, MAX_QUESTIONS, nextTurn } from './engine.js';
import { films } from './films.js';
import { questionWording } from './question-wording.js';
import './santa-knows-christmas.css';

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
  const [titleChoices, setTitleChoices] = useState(null);
  const [confirmedTitle, setConfirmedTitle] = useState(false);
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
      finishRound(matchesTitle(turn.guess, secret) ? 'santa' : 'player');
    } else {
      setPhase('guess');
    }
  }

  function resetRound(resetMatch = false) {
    if (resetMatch) setScore({ player: 0, santa: 0 });
    setSecret('');
    setSealed(false);
    setTitleChoices(null);
    setConfirmedTitle(false);
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
          <h2 ref={heading} tabIndex={-1}>Think of a Christmas film</h2>
          <p>Santa has up to {MAX_QUESTIONS} questions and one guess. Stump him to score a point. First to two points wins.</p>
          <form onSubmit={async event => {
            event.preventDefault();
            if (busy.current || sealing) return;
            if (secret.trim() && !confirmedTitle && films.filter(film => matchesTitle(film, secret)).length !== 1) {
              setTitleChoices(suggestFilms(secret));
              return;
            }
            const seed = Math.floor(Math.random() * 1_000_000);
            const recentOpeners = recentOpenerIds.current;
            const opener = nextTurn([], { seed, recentOpeners }).question.id;
            recentOpenerIds.current = [...recentOpeners, opener].slice(-3);
            wordingOffset.current ??= seed % 4;
            setQuestionOrder({ seed, recentOpeners, wordingIndex: wordingOffset.current + roundsStarted.current++ });
            const hasSecret = Boolean(secret.trim());
            setSealed(hasSecret);
            if (hasSecret) setPhase('sealing');
            const sealConfirmation = hasSecret
              ? new Promise(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 650))
              : undefined;
            const [turn] = await Promise.all([requestTurn([], seed), sealConfirmation]);
            setAiTurn(turn);
            setPhase('question');
          }}>
            <label htmlFor="christmas-secret">Seal your film title (optional)</label>
            <div className="christmas-study__vault-field">
              <input id="christmas-secret" disabled={sealing || pending} value={secret} onChange={event => {
                setSecret(event.target.value);
                setTitleChoices(null);
                setConfirmedTitle(false);
              }}
                placeholder="Type the film title" maxLength={160} autoComplete="off"
                aria-describedby="christmas-secret-help" />
              {sealing && <span className="christmas-study__vault" role="status">
                <LockKeyhole size={19} aria-hidden="true" /> Locked in Santa’s vault
              </span>}
            </div>
            {titleChoices && <div aria-live="polite">
              <p>{titleChoices.length ? 'Did you mean one of these films?' : 'Ho ho, that title has me stumped already! Is it a real Christmas film? Check the spelling or confirm your title.'}</p>
              {titleChoices.map(film => <button type="button" key={film.title + film.year} onClick={() => {
                setSecret(`${film.title} (${film.year})`);
                setTitleChoices(null);
                setConfirmedTitle(true);
              }}>{film.title} ({film.year})</button>)}
              {!films.some(film => matchesTitle(film, secret)) && <button type="button" onClick={() => {
                setTitleChoices(null);
                setConfirmedTitle(true);
              }}>Yes, my title is correct</button>}
            </div>}
            <small id="christmas-secret-help">Your title stays in this tab. It’s only used to check Santa’s guess.</small>
            <button type="submit" disabled={pending || sealing}>{pending || sealing ? "Santa’s thinking…" : `Start round ${round}`}</button>
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
          {winner === 'player' && (sealed || revealed) &&
            <p>Your film was <strong>{sealed ? secret.trim() : reveal.trim()}</strong>.</p>}
          {winner === 'player' && !sealed && !revealed && <form onSubmit={event => {
            event.preventDefault();
            if (reveal.trim()) setRevealed(true);
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
