import { useEffect, useRef, useState } from 'react';
import OfficeScene, { NnComputer } from './OfficeScene.jsx';
import FirstNameForm from './FirstNameForm.jsx';
import CheckerCertificate from './CheckerCertificate.jsx';
import useChristmasDays from './useChristmasDays.js';
import { HomepageCornerControls, keepCheckerFocusVisible } from './CheckerControls.jsx';
import useCheckerAudio from './useCheckerAudio.js';
import useCheckerRun from './useCheckerRun.js';
import useElfReaction from './useElfReaction.js';
import useOfficeEntryPosition from './useOfficeEntryPosition.js';
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
  useOfficeEntryPosition(entry);
  const questions = useRef(null);
  const visited = useRef(false);
  const audio = useCheckerAudio();
  const { reaction, curiousReady, noteAnswers, reactToAnswer, clear: clearReaction } = useElfReaction();
  const { run, cancel, audioCallbacks, secondsRemaining, elapsedMs } = useCheckerRun();
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
    cancel(); audio.stop(); clearReaction(); setStage('entry'); setName('');
    setAnswers(QUESTIONS.map(() => '')); setQuestionIndex(0); setResult(null); setError(''); setEntryKey(value => value + 1);
  };
  useEffect(() => {
    // Discard private play state on leaving the document, including bfcache.
    const hide = () => {
      cancel(); audio.stop(); clearReaction(); setName(''); setAnswers(QUESTIONS.map(() => ''));
      setResult(null); setQuestionIndex(0); setError(''); setStage('entry'); setEntryKey(value => value + 1);
    };
    const show = event => { if (event.persisted) hide(); };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [cancel, audio.stop, clearReaction]);
  return <main id="main-content" className="nn-office" onFocusCapture={event => {
    if (event.target.matches(':focus-visible')) keepCheckerFocusVisible(event);
  }}>
    <OfficeScene busy={busy} title="Naughty or Nice List Checker">
      <div className="nn-panel" data-elf-reaction={
        stage === 'result' && result === 'naughty'
          ? answers.filter(answer => answer === 'no').length >= 8 ? 'extra-shocked' : 'shocked'
          : stage === 'analysis' && elapsedMs >= 1000 && curiousReady ? 'curious' : reaction
      }>
      {stage === 'questions' && <div className="nn-toolbar nn-toolbar--progress">
        <div className="nn-question-progress" role="progressbar" aria-label="Question progress"
          aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={completed}
          aria-valuetext={questionIndex < QUESTIONS.length ? `Question ${questionIndex + 1} of ${QUESTIONS.length}` : 'All ten questions answered'}>
          {QUESTIONS.map((_, index) => <span key={index} aria-hidden="true"
            className={index === questionIndex ? 'is-current' : answers[index] ? 'is-complete' : ''} />)}
        </div>
      </div>}
      {stage === 'entry' && <div ref={entry} className="nn-stage">
        <h2>Welcome to Head Elf’s Office</h2>
        <p>First things first — who’s visiting Santa’s office today?</p>
        <FirstNameForm key={entryKey} initialName={name} label="Confirm first name" inlineSuggestions
          buttonText={value => value ? `Lets check if ${value} is Naughty or Nice` : 'Lets check if Naughty or Nice'}
          suggestionHelp="Select your name and lets find out which list you are really on."
          onSubmit={value => {
            if (!run(1800, () => { audio.stop(); setStage('questions'); })) return;
            if (value !== name) setAnswers(QUESTIONS.map(() => ''));
            setName(value); setQuestionIndex(0); setStage('connecting');
            audio.play('connecting'); audio.effect('click');
          }} />
      </div>}
      {stage === 'connecting' && <div className="nn-stage">
        <h2 ref={heading} tabIndex={-1}>Connecting to Santa’s office…</h2>
        <NnComputer busy connecting />
        <p role="status">The Head Elf is opening the pretend inspection book. Nearly ready!</p>
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
        setError(''); setStage('analysis'); audio.play(final, audioCallbacks(CERTIFICATE_REVEAL_LEAD_MS)); audio.effect('click');
      }}>
        <h2>A few questions for {name}</h2>
        <p className="nn-question-count">{Math.min(questionIndex + 1, QUESTIONS.length)} of {QUESTIONS.length}</p>
        {questionIndex < QUESTIONS.length ? <fieldset className="nn-question-step" key={questionIndex}>
          <legend ref={heading} tabIndex={-1}>
            <span className="nn-sr-only">Question {questionIndex + 1} of {QUESTIONS.length}. </span>
            <span className="nn-question-wording">{QUESTIONS[questionIndex]}</span>
            {QUESTIONS.map((question, index) => <span key={index} className="nn-question-size"
              aria-hidden="true">{question}</span>)}
          </legend>
          <div className="nn-question-buttons">{['yes', 'no'].map(value => <button type="button" key={value}
            className="nn-primary" aria-pressed={answers[questionIndex] === value}
            onClick={() => {
              audio.effect('pop');
              const nextAnswers = answers.map((answer, index) => index === questionIndex ? value : answer);
              setAnswers(nextAnswers);
              noteAnswers(nextAnswers);
              let consecutiveYes = 0;
              for (let index = questionIndex; index >= 0 && nextAnswers[index] === 'yes'; index--)
                consecutiveYes++;
              reactToAnswer(value, nextAnswers.filter(answer => answer === 'no').length, consecutiveYes);
              setQuestionIndex(index => index + 1); setError('');
            }}>{value === 'yes' ? 'Yes' : 'No'}</button>)}</div>
        </fieldset> : <h3 ref={heading} tabIndex={-1}>All ten answers are in!</h3>}
        {error && <p role="alert" className="nn-error">{error}</p>}
        <div className="nn-actions nn-actions--questions">
          {questionIndex === QUESTIONS.length && <button type="submit" className="nn-primary nn-final-check">Let’s just have another little check!</button>}
          {questionIndex < QUESTIONS.length && <button type="button" className="nn-secondary nn-previous-question"
            disabled={questionIndex === 0} aria-hidden={questionIndex === 0 ? true : undefined}
            style={questionIndex === 0 ? { visibility: 'hidden' } : undefined}
            onClick={() => setQuestionIndex(index => index - 1)}>Previous question</button>}
        </div>
      </form>}
      {stage === 'analysis' && <div className="nn-stage">
        <h2 ref={heading} tabIndex={-1}>The Head Elf’s analyser is checking…</h2>
        <NnComputer busy finalAnalysis secondsRemaining={secondsRemaining} />
        <p role="status">Counting your ten answers. A little Christmas patience, please!</p>
        <button className="nn-secondary" onClick={() => { cancel(); audio.stop(); setQuestionIndex(QUESTIONS.length); setStage('questions'); }}>Back to answers</button>
      </div>}
      {stage === 'result' && <div className={`nn-result nn-result--${result}`}>
        <p className="nn-kicker">HEAD ELF’S VERY UNOFFICIAL VERDICT</p>
        <h2 ref={heading} tabIndex={-1}>{result === 'nice' ? `${name}: NICE LIST!` : 'Oh no! NAUGHTY LIST'}</h2>
        {result === 'nice' ? <p>Well Done {name} Only {christmasDays} {christmasDays === 1 ? 'day' : 'days'} to go. Keep sharing, helping and being kind. Little acts of kindness make Christmas brighter!</p>
          : <p>{name} don't panic! With {christmasDays} {christmasDays === 1 ? 'day' : 'days'} to go until Christmas there is still time to work on it and come and try again.</p>}
        <CheckerCertificate name={name} result={result} days={christmasDays} />
      </div>}
      <HomepageCornerControls audio={audio} onRestart={reset} showRestart={stage !== 'entry'} />
      </div>
    </OfficeScene>
  </main>;
}
