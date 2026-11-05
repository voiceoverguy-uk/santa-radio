import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FirstNameForm from './FirstNameForm.jsx';
import NaughtyNiceQuizIntro from './NaughtyNiceQuizIntro.jsx';
import { SoundControl, keepCheckerFocusVisible } from './CheckerControls.jsx';
import useCheckerAudio, { CHECKER_SOUNDS } from './useCheckerAudio.js';
import useCheckerRun from './useCheckerRun.js';
import useCheckingPanelDelay from './useCheckingPanelDelay.js';
import { NnComputer } from './OfficeScene.jsx';
import { HOMEPAGE_ANALYSIS_MS, CHECKER_PATH, clearCheckerName, offerCheckerName, preliminaryScore } from './checkerLogic.js';
import './checker.css';

export default function NaughtyNiceWidget() {
  const [stage, setStage] = useState('entry');
  const [name, setName] = useState('');
  const [score, setScore] = useState(null);
  const [entryKey, setEntryKey] = useState(0);
  const focus = useRef(null);
  const section = useRef(null);
  const visited = useRef(false);
  const audio = useCheckerAudio(CHECKER_SOUNDS.homepageChecking);
  const { run, cancel, audioCallbacks, secondsRemaining } = useCheckerRun();
  const { begin: delayPanel, cancel: cancelPanel } = useCheckingPanelDelay();
  useEffect(() => {
    if (stage !== 'entry') {
      visited.current = true;
      focus.current?.focus({ preventScroll: true });
    } else if (visited.current) section.current?.querySelector('input')?.focus();
  }, [stage]);
  useEffect(() => {
    clearCheckerName();
    const clear = () => { cancelPanel(); cancel(); audio.stop(); clearCheckerName(); setName(''); setScore(null); setStage('entry'); setEntryKey(value => value + 1); };
    const show = event => { if (event.persisted) clear(); };
    window.addEventListener('pagehide', clear);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', clear);
      window.removeEventListener('pageshow', show);
    };
  }, [cancelPanel, cancel, audio.stop]);
  const restart = () => { cancelPanel(); cancel(); audio.stop(); setScore(null); setName(''); setStage('entry'); setEntryKey(value => value + 1); };
  return <section ref={section} className="nn-widget" aria-labelledby="nn-quiz-intro-heading" onFocusCapture={keepCheckerFocusVisible}>
    <NaughtyNiceQuizIntro />
    <div className="nn-widget-inner">
      <div className="nn-widget-intro">
        <div className="nn-widget-logo">
          <img src="/images/naughty-or-nice-logo.webp" width="1659" height="948" alt="" decoding="async" />
        </div>
        <h3 id="nn-widget-heading" className="nn-widget-title">Head Elf’s Naughty or Nice List Checker</h3>
        <p className="nn-intro">Enter your first name for a quick North Pole check. Then visit Head Elf for the full Christmas quiz.</p>
      </div>
      <div className="nn-panel nn-widget-frame">
        {(stage === 'entry' || stage === 'starting') && <h3 className="nn-widget-form-heading">Quick Nice List Check</h3>}
        {(stage === 'entry' || stage === 'starting') && <FirstNameForm key={entryKey} disabled={stage === 'starting'} onSubmit={value => {
          if (!run(HOMEPAGE_ANALYSIS_MS, () => { cancelPanel(); setScore(preliminaryScore()); setStage('result'); })) return;
          setName(value); setStage('starting');
          audio.play('checking', delayPanel(audioCallbacks(),
            () => setStage(current => current === 'starting' ? 'checking' : current), audio.enabled));
        }} />}
        {stage === 'checking' && <div className="nn-stage">
          <h3 ref={focus} tabIndex={-1}>Checking at the North Pole…</h3>
          <NnComputer busy secondsRemaining={secondsRemaining} />
          <p role="status">The Workshop Naughty &amp; Nice Analyiser</p>
          <button className="nn-secondary" onClick={restart}>Cancel check</button>
        </div>}
        {stage === 'result' && <div className="nn-result">
          <h3 ref={focus} tabIndex={-1}>{name}, you’re <span className="nn-score">{score}% nice!</span></h3>
          <p>Mmmm.... surely that can't be right?</p>
          <Link className="nn-primary nn-head-elf-link" to={CHECKER_PATH} onClick={event => {
            if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
              offerCheckerName(name);
          }}>Lets check again with Head Elf!</Link>
          <button className="nn-secondary nn-check-another" onClick={restart}>Check another name</button>
        </div>}
        <SoundControl audio={audio} />
      </div>
    </div>
  </section>;
}
