import { useEffect, useRef, useState } from 'react';
import OfficeScene, { NnComputer } from './OfficeScene.jsx';
import FirstNameForm from './FirstNameForm.jsx';
import CheckerCertificate from './CheckerCertificate.jsx';
import useChristmasDays from './useChristmasDays.js';
import { SoundControl, keepCheckerFocusVisible } from './CheckerControls.jsx';
import useCheckerAudio from './useCheckerAudio.js';
import useCheckerRun from './useCheckerRun.js';
import { CERTIFICATE_REVEAL_LEAD_MS, resultAnalysisMs, QUESTIONS, classifyAnswers, readCheckerName, clearCheckerName } from './checkerLogic.js';
import './checker.css';

export default function NaughtyNicePage() {
  // Initialisers may run twice in StrictMode; consume only after mounting.
  const [name, setName] = useState(readCheckerName);
  useEffect(() => { clearCheckerName(); }, []);
  const [stage, setStage] = useState('entry');
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ''));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState(null);
  const christmasDays = useChristmasDays(stage === 'result');
  const [error, setError] = useState('');
  const [entryKey, setEntryKey] = useState(0);
  const heading = useRef(null);
  const entry = useRef(null);
  const questions = useRef(null);
  const visited = useRef(false);
  const audio = useCheckerAudio();
  const { run, cancel, audioCallbacks, secondsRemaining } = useCheckerRun();
  const completed = answers.filter(Boolean).length;
  const busy = stage === 'connecting' || stage === 'analysis';
  useEffect(() => {
    if (stage === 'entry') {
      if (entryKey || visited.current) entry.current?.querySelector('input')?.focus();
    } else {
      visited.current = true;
      heading.current?.focus();
    }
  }, [stage, entryKey, questionIndex]);
  const reset = () => {
    cancel(); audio.stop(); setStage('entry'); setName('');
    setAnswers(QUESTIONS.map(() => '')); setQuestionIndex(0); setResult(null); setError(''); setEntryKey(value => value + 1);
  };
  useEffect(() => {
    // Discard private play state on leaving the document, including bfcache.
    const hide = () => {
      cancel(); audio.stop(); setName(''); setAnswers(QUESTIONS.map(() => ''));
      setResult(null); setQuestionIndex(0); setError(''); setStage('entry'); setEntryKey(value => value + 1);
    };
    const show = event => { if (event.persisted) hide(); };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [cancel, audio.stop]);
  return <main id="main-content" className="nn-office" onFocusCapture={keepCheckerFocusVisible}>
    <OfficeScene busy={busy} title="Naughty or Nice List Checker">
      <div className="nn-panel">
      <SoundControl audio={audio}>
        {stage === 'questions' && <div className="nn-question-progress" role="progressbar" aria-label="Question progress"
          aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={completed}
          aria-valuetext={questionIndex < QUESTIONS.length ? `Question ${questionIndex + 1} of ${QUESTIONS.length}` : 'All ten questions answered'}>
          {QUESTIONS.map((_, index) => <span key={index} aria-hidden="true"
            className={index === questionIndex ? 'is-current' : answers[index] ? 'is-complete' : ''} />)}
        </div>}
      </SoundControl>
      {stage === 'entry' && <div ref={entry} className="nn-stage">
        <h2>Welcome to Head Elf’s Office</h2>
        <p>First things first — who’s visiting Santa’s office today?</p>
        <FirstNameForm key={entryKey} initialName={name} buttonText="Let's check if Naughty or Nice"
          suggestionHelp="Select your name and lets find out which list you are on."
          onSubmit={value => {
            if (!run(1800, () => setStage('questions'))) return;
            if (value !== name) setAnswers(QUESTIONS.map(() => ''));
            setName(value); setQuestionIndex(0); setStage('connecting');
          }} />
      </div>}
      {stage === 'connecting' && <div className="nn-stage">
        <h2 ref={heading} tabIndex={-1}>Connecting to Santa’s office…</h2>
        <NnComputer busy connecting />
        <p role="status">The Head Elf is opening the pretend inspection book. Nearly ready!</p>
        <button className="nn-secondary" onClick={reset}>Start over</button>
      </div>}
      {stage === 'questions' && <form ref={questions} className="nn-stage" noValidate onSubmit={event => {
        event.preventDefault();
        const final = classifyAnswers(answers);
        if (!final) {
          setError('Please answer all ten questions before the Head Elf checks.');
          const missing = answers.findIndex(answer => !answer);
          setQuestionIndex(missing);
          return;
        }
        if (!run(resultAnalysisMs(final), () => { setResult(final); setStage('result'); })) return;
        setError(''); setStage('analysis'); audio.play(final, audioCallbacks(CERTIFICATE_REVEAL_LEAD_MS));
      }}>
        <h2>A few questions for {name}</h2>
        <p className="nn-question-count">{Math.min(questionIndex + 1, QUESTIONS.length)} of {QUESTIONS.length}</p>
        {questionIndex < QUESTIONS.length ? <fieldset className="nn-question-step" key={questionIndex}>
          <legend ref={heading} tabIndex={-1}>
            <span className="nn-sr-only">Question {questionIndex + 1} of {QUESTIONS.length}. </span>{QUESTIONS[questionIndex]}
          </legend>
          <div className="nn-question-buttons">{['yes', 'no'].map(value => <button type="button" key={value}
            className="nn-primary" aria-pressed={answers[questionIndex] === value}
            onClick={() => {
              setAnswers(current => current.map((answer, index) => index === questionIndex ? value : answer));
              setQuestionIndex(index => index + 1); setError('');
            }}>{value === 'yes' ? 'Yes' : 'No'}</button>)}</div>
        </fieldset> : <h3 ref={heading} tabIndex={-1}>All ten answers are in!</h3>}
        {error && <p role="alert" className="nn-error">{error}</p>}
        <div className="nn-actions nn-actions--questions">
          {questionIndex === QUESTIONS.length && <button type="submit" className="nn-primary nn-final-check">Let’s just have another little check!</button>}
          {questionIndex > 0 && questionIndex < QUESTIONS.length && <button type="button" className="nn-secondary nn-previous-question"
            onClick={() => setQuestionIndex(index => index - 1)}>Previous question</button>}
          <button type="button" className="nn-secondary" onClick={reset}>Start over</button>
        </div>
      </form>}
      {stage === 'analysis' && <div className="nn-stage">
        <h2 ref={heading} tabIndex={-1}>The Head Elf’s analyser is checking…</h2>
        <NnComputer busy finalAnalysis secondsRemaining={secondsRemaining} />
        <p role="status">Counting your ten answers. A little Christmas patience, please!</p>
        <button className="nn-secondary" onClick={() => { cancel(); audio.stop(); setQuestionIndex(QUESTIONS.length); setStage('questions'); }}>Back to answers</button>
        <button className="nn-secondary" onClick={reset}>Start over</button>
      </div>}
      {stage === 'result' && <div className={`nn-result nn-result--${result}`}>
        <p className="nn-kicker">THE HEAD ELF’S VERY UNOFFICIAL VERDICT</p>
        <h2 ref={heading} tabIndex={-1}>{result === 'nice' ? `${name}: NICE LIST!` : 'Oh no! NAUGHTY LIST'}</h2>
        {result === 'nice' ? <p>Well Done {name} Only {christmasDays} {christmasDays === 1 ? 'day' : 'days'} to go. Keep sharing, helping and being kind. Little acts of kindness make Christmas brighter!</p>
          : <p>{name} don't panic! We all have tricky days. With {christmasDays} {christmasDays === 1 ? 'day' : 'days'} to go until Christmas there is still time to work on it and come and try again.</p>}
        <CheckerCertificate name={name} result={result} days={christmasDays} />
        <div className="nn-actions">
          <button className="nn-primary" onClick={reset}>Try again from the start</button>
        </div>
      </div>}
      </div>
    </OfficeScene>
  </main>;
}
