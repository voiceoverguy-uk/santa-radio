import { useEffect, useRef, useState } from 'react';
import OfficeScene, { NnComputer } from './OfficeScene.jsx';
import NaughtyNiceWidget from './NaughtyNiceWidget.jsx';
import FirstNameForm from './FirstNameForm.jsx';
import CheckerCertificate from './CheckerCertificate.jsx';
import useChristmasDays from './useChristmasDays.js';
import { HomepageCornerControls, keepCheckerFocusVisible } from './CheckerControls.jsx';
import useCheckerAudio from './useCheckerAudio.js';
import useCheckerRun from './useCheckerRun.js';
import useElfReaction, { ELF_REACTION_ART } from './useElfReaction.js';
import useOfficeEntryPosition from './useOfficeEntryPosition.js';
import { CERTIFICATE_REVEAL_LEAD_MS, resultAnalysisMs, ROUND_QUESTION_COUNT, selectAllNoPrompt, selectQuestionRound, classifyAnswers, readCheckerName, clearCheckerName } from './checkerLogic.js';
import './checker.css';

export default function NaughtyNicePage() {
  const [initialName, setInitialName] = useState(readCheckerName);
  const [showOffice, setShowOffice] = useState(() => Boolean(initialName));
  useEffect(() => { clearCheckerName(); }, []);
  if (!showOffice) return <NaughtyNiceWidget standalone onOpenHeadElf={name => {
    setInitialName(name);
    setShowOffice(true);
  }} />;
  return <NaughtyNiceOffice initialName={initialName} />;
}

function NaughtyNiceOffice({ initialName }) {
  // Initialisers may run twice in StrictMode; consume only after mounting.
  const [name, setName] = useState(initialName);
  const [stage, setStage] = useState('entry');
  const [round, setRound] = useState([]);
  const [answers, setAnswers] = useState(() => Array(ROUND_QUESTION_COUNT).fill(''));
  const [allNoPrompt, setAllNoPrompt] = useState('');
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
    setRound([]); setAnswers(Array(ROUND_QUESTION_COUNT).fill('')); setAllNoPrompt('');
    setQuestionIndex(0); setResult(null); setError(''); setEntryKey(value => value + 1);
  };
  useEffect(() => {
    // Discard private play state on leaving the document, including bfcache.
    const hide = () => {
      cancel(); audio.stop(); clearReaction(); setName(''); setRound([]); setAnswers(Array(ROUND_QUESTION_COUNT).fill(''));
      setAllNoPrompt('');
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
      <div className="nn-elf-artwork" aria-hidden="true">
        {Object.entries(ELF_REACTION_ART).map(([kind, src]) =>
          <span key={kind} className={`nn-elf-artwork-layer nn-elf-artwork-layer--${kind}`}
            style={{ borderImageSource: `url("${src}")` }} />)}
      </div>
      {stage === 'questions' && <div className="nn-toolbar nn-toolbar--progress">
        <div className="nn-question-progress" role="progressbar" aria-label="Question progress"
          aria-valuemin={0} aria-valuemax={round.length} aria-valuenow={completed}
          aria-valuetext={questionIndex < round.length ? `Question ${questionIndex + 1} of ${round.length}` : 'All ten questions answered'}>
          {round.map((_, index) => <span key={index} aria-hidden="true"
            className={index === questionIndex ? 'is-current' : answers[index] ? 'is-complete' : ''} />)}
        </div>
      </div>}
      {stage === 'entry' && <div ref={entry} className="nn-stage">
        <h2>Welcome to Head Elf’s Office</h2>
        <p>So, who is visiting Head Elf's office today?</p>
        <FirstNameForm key={entryKey} initialName={name} label="Confirm first name" inlineSuggestions
          buttonText={value => value ? `Is ${value} Naughty or Nice?` : 'Is this name Naughty or Nice?'}
          suggestionHelp="Let's see what Head Elf finds out."
          onSubmit={value => {
            if (!run(1800, () => { audio.stop(); setStage('questions'); })) return;
            setRound(selectQuestionRound());
            setAnswers(Array(ROUND_QUESTION_COUNT).fill('')); setAllNoPrompt('');
            setName(value); setQuestionIndex(0); setStage('connecting');
            audio.play('connecting'); audio.effect('click');
          }} />
      </div>}
      {stage === 'connecting' && <div className="nn-stage">
        <h2 ref={heading} tabIndex={-1}>Connecting to Santa’s office…</h2>
        <NnComputer busy connecting />
        <p role="status">Head Elf is preparing his naughty and nice list checker.</p>
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
        <p className="nn-question-count">{Math.min(questionIndex + 1, round.length)} of {round.length}</p>
        {questionIndex < round.length ? <fieldset className="nn-question-step" key={questionIndex}>
          <legend ref={heading} tabIndex={-1}>
            <span className="nn-sr-only">Question {questionIndex + 1} of {round.length}. </span>
            <span className="nn-question-wording">{round[questionIndex]}</span>
            {round.map((question, index) => <span key={index} className="nn-question-size"
              aria-hidden="true">{question}</span>)}
          </legend>
          <div className="nn-question-buttons">{['yes', 'no'].map(value => <button type="button" key={value}
            className="nn-primary" aria-pressed={answers[questionIndex] === value}
            onClick={() => {
              audio.effect('pop');
              const nextAnswers = answers.map((answer, index) => index === questionIndex ? value : answer);
              setAnswers(nextAnswers);
              const nextQuestionIndex = questionIndex + 1;
              setAllNoPrompt(nextQuestionIndex === round.length && nextAnswers.every(answer => answer === 'no')
                ? selectAllNoPrompt() : '');
              noteAnswers(nextAnswers);
              let consecutiveYes = 0;
              for (let index = questionIndex; index >= 0 && nextAnswers[index] === 'yes'; index--)
                consecutiveYes++;
              reactToAnswer(value, nextAnswers.filter(answer => answer === 'no').length, consecutiveYes);
              setQuestionIndex(nextQuestionIndex); setError('');
            }}>{value === 'yes' ? 'Yes' : 'No'}</button>)}</div>
        </fieldset> : <h3 ref={heading} tabIndex={-1}>All ten answers are in!</h3>}
        {questionIndex === round.length && <p>Are you on the nice list?</p>}
        {questionIndex === round.length && allNoPrompt && <p className="nn-all-no-nudge">{allNoPrompt}</p>}
        {error && <p role="alert" className="nn-error">{error}</p>}
        <div className="nn-actions nn-actions--questions">
          {questionIndex === round.length && <button type="submit" className="nn-primary nn-final-check">Press to find out</button>}
          {questionIndex < round.length && <button type="button" className="nn-secondary nn-previous-question"
            disabled={questionIndex === 0} aria-hidden={questionIndex === 0 ? true : undefined}
            style={questionIndex === 0 ? { visibility: 'hidden' } : undefined}
            onClick={() => setQuestionIndex(index => index - 1)}>Previous question</button>}
        </div>
      </form>}
      {stage === 'analysis' && <div className="nn-stage">
        <h2 ref={heading} tabIndex={-1}>The Head Elf’s analyser is checking…</h2>
        <NnComputer busy finalAnalysis secondsRemaining={secondsRemaining} />
        <p role="status">Counting your ten answers. A little Christmas patience, please!</p>
        <button className="nn-secondary" onClick={() => { cancel(); audio.stop(); setQuestionIndex(round.length); setStage('questions'); }}>Back to answers</button>
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
