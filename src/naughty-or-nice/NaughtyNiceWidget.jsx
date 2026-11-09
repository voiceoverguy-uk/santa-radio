import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import FirstNameForm from './FirstNameForm.jsx';
import NaughtyNiceQuizIntro from './NaughtyNiceQuizIntro.jsx';
import { HomepageCornerControls, keepCheckerFocusVisible } from './CheckerControls.jsx';
import useCheckerAudio, { CHECKER_SOUNDS } from './useCheckerAudio.js';
import useCheckerRun from './useCheckerRun.js';
import useQuickCheckerReaction from './useQuickCheckerReaction.js';
import useCheckingPanelDelay from './useCheckingPanelDelay.js';
import { NnComputer } from './OfficeScene.jsx';
import { HOMEPAGE_ANALYSIS_MS, CHECKER_LAUNCH_MS, CHECKER_PATH, clearCheckerName, offerCheckerName, preliminaryScore } from './checkerLogic.js';
import './checker.css';

export default function NaughtyNiceWidget({ onOpenHeadElf, standalone = false } = {}) {
  const location = useLocation();
  const [stage, setStage] = useState('entry');
  const [name, setName] = useState('');
  const [score, setScore] = useState(null);
  const [entryKey, setEntryKey] = useState(0);
  const focus = useRef(null);
  const section = useRef(null);
  const frameElement = useRef(null);
  const visited = useRef(false);
  useEffect(() => {
    if (location.hash !== '#nice-list') return;
    // Wait for route rendering and the navigation's ordinary scroll-to-top.
    // A fresh location key also handles clicking this link again on the home page.
    let active = true;
    let frame;
    let settleTimer;
    let layoutObserver;
    const position = () => {
      if (!active || !section.current) return;
      const navBottom = document.querySelector('.navbar')?.getBoundingClientRect().bottom || 100;
      section.current?.focus({ preventScroll: true });
      // Position explicitly: global fragment padding and descendant focus
      // margins must not add another offset. Avoid competing smooth scrolls
      // while images, fonts and preceding sections are still settling.
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      // On desktop, align the checker heading rather than the section box.
      // The section has generous top padding, so aligning the section itself
      // leaves the previous banner visible and pushes the checker heading down.
      const destination = mobile ? frameElement.current : section.current?.querySelector('.nn-quiz-intro');
      if (!destination) return;
      const delta = destination.getBoundingClientRect().top - navBottom - 16;
      if (Math.abs(delta) > 1) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
    };
    const schedule = () => {
      document.fonts.ready.then(() => {
        if (active) {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(position);
        }
      });
    };
    const stopSettling = () => {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      layoutObserver?.disconnect();
      window.removeEventListener('load', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
        window.removeEventListener(event, stopSettling);
    };
    // Fresh documents can restore a fragment position after hydration. Fonts
    // loaded by lower sections can also change earlier section heights.
    // Briefly settle that position, but never fight a visitor's own scrolling.
    window.addEventListener('load', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    // Route navigation does not fire window.load again. Watch the preceding
    // homepage sections as well, including images loading after that event.
    layoutObserver = new ResizeObserver(schedule);
    for (const sibling of section.current?.parentElement?.children || []) {
      if (sibling === section.current) break;
      layoutObserver.observe(sibling);
    }
    const navbar = document.querySelector('.navbar');
    if (navbar) layoutObserver.observe(navbar);
    const player = document.querySelector('.radio-dock:not([hidden])');
    if (player && player.getBoundingClientRect().height) layoutObserver.observe(player);
    if (frameElement.current) layoutObserver.observe(frameElement.current);
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
      window.addEventListener(event, stopSettling, { passive: true });
    settleTimer = setTimeout(stopSettling, 5000);
    schedule();
    return stopSettling;
  }, [location.key, location.hash]);
  const audio = useCheckerAudio(CHECKER_SOUNDS.homepageChecking);
  const reaction = useQuickCheckerReaction(audio);
  const { run, cancel, audioCallbacks, secondsRemaining } = useCheckerRun();
  const { begin: delayPanel, cancel: cancelPanel } = useCheckingPanelDelay();
  // React can reuse this widget when moving between direct and homepage entry.
  // Route changes must therefore stop audio even when it does not unmount.
  useEffect(() => () => {
    cancelPanel(); cancel(); audio.stop();
  }, [location.key, cancelPanel, cancel, audio.stop]);
  const TitleTag = standalone ? 'h1' : 'h3';
  useEffect(() => {
    if (stage !== 'entry') {
      visited.current = true;
      focus.current?.focus({ preventScroll: true });
    } else if (visited.current || entryKey) section.current?.querySelector('input')?.focus();
  }, [stage, entryKey]);
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
  const restart = () => { cancelPanel(); cancel(); audio.stop(); clearCheckerName(); setScore(null); setName(''); setStage('entry'); setEntryKey(value => value + 1); };
  return <section id="nice-list" ref={section} tabIndex={-1} className="nn-widget" aria-labelledby="nn-quiz-intro-heading" onFocusCapture={event => {
    // Pointer focus must not scroll a corner button away before pointer-up.
    if (event.target !== section.current && event.target.matches(':focus-visible')) keepCheckerFocusVisible(event);
  }}>
    <NaughtyNiceQuizIntro />
    <div className="nn-widget-inner">
      <div className="nn-widget-intro">
        <div className="nn-widget-logo">
          <img src="/images/naughty-or-nice-logo.webp" width="1659" height="948" alt="" decoding="async" />
        </div>
        <TitleTag id="nn-widget-heading" className="nn-widget-title">Head Elf’s Naughty or Nice List Checker</TitleTag>
        <p className="nn-intro">Enter your first name for a quick North Pole check. Then visit Head Elf for the full Christmas quiz.</p>
      </div>
      <div ref={frameElement} className="nn-panel nn-widget-frame">
        {(stage === 'entry' || stage === 'starting') && <h3 className="nn-widget-form-heading">Quick Nice List Check</h3>}
        {(stage === 'entry' || stage === 'starting') && <FirstNameForm key={entryKey} label="Confirm first name" inlineSuggestions
          enteredHelp="Ready to find out?" buttonText="Lets check" disabled={stage === 'starting'} onSubmit={value => {
          if (!run(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS, () => { cancelPanel(); setScore(preliminaryScore()); setStage('result'); reaction.reveal(); })) return;
          setName(value); setStage('starting');
          audio.effect('click');
          delayPanel(() => {
            setStage('checking');
            audio.play('checking', reaction.checkingCallbacks(audioCallbacks()));
          });
        }} />}
        {stage === 'checking' && <div className="nn-stage">
          <h3 ref={focus} tabIndex={-1}>Checking at the North Pole…</h3>
          <NnComputer busy secondsRemaining={secondsRemaining} />
          <p role="status">The Workshop Naughty &amp; Nice Analyiser</p>
        </div>}
        {stage === 'result' && <div className="nn-result">
          <h3 ref={focus} tabIndex={-1}>{name}, you’re <span className="nn-score">{score}% nice!</span></h3>
          <p>Mmmm.... surely that can't be right?</p>
          {onOpenHeadElf
            ? <button type="button" className="nn-primary nn-head-elf-link"
              onClick={() => { audio.stop(); onOpenHeadElf(name); }}>Lets check with Head Elf</button>
            : <Link className="nn-primary nn-head-elf-link" to={CHECKER_PATH} onClick={event => {
              audio.stop();
              if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
                offerCheckerName(name);
            }}>Lets check with Head Elf</Link>}
        </div>}
        <HomepageCornerControls audio={audio} onRestart={restart} showRestart={stage !== 'entry'} />
      </div>
    </div>
  </section>;
}
