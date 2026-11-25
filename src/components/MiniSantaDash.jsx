import { useEffect, useRef, useState } from 'react';
import HomepageSantaRunner from './HomepageSantaRunner.jsx';
import { advanceRound, jumpHeight, newRound, ROUND_MS } from './miniSantaDash.js';
import './MiniSantaDash.css';

export default function MiniSantaDash() {
  const [mode, setMode] = useState('idle');
  const [round, setRound] = useState(newRound);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const root = useRef(null);
  const arena = useRef(null);
  const startButton = useRef(null);
  const state = useRef(round);
  const active = mode === 'playing' && visible && !hidden && !paused;

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(root.current);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let frame;
    let previous;
    const tick = now => {
      let remaining = previous === undefined ? 0 : Math.min(now - previous, 250);
      previous = now;
      const width = arena.current?.clientWidth || 320;
      while (remaining > 0) {
        const dt = Math.min(remaining, 16);
        state.current = advanceRound(state.current, dt, width);
        remaining -= dt;
      }
      setRound(state.current);
      if (state.current.elapsed >= ROUND_MS) { setMode('finished'); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  function start() {
    state.current = newRound();
    setRound(state.current);
    setPaused(false);
    setMode('playing');
    requestAnimationFrame(() => arena.current?.focus({ preventScroll: true }));
  }
  function jump() {
    if (active && state.current.jump === null) {
      state.current = { ...state.current, jump: 0 };
      setRound(state.current);
    }
  }
  function close() {
    setMode('idle');
    requestAnimationFrame(() => startButton.current?.focus({ preventScroll: true }));
  }

  return <div className="mini-santa-dash" ref={root}>
    {mode === 'idle' ? <button ref={startButton} className="mini-santa-dash__start" onClick={start} aria-label="Play Mini Santa Dash for one minute">
      <HomepageSantaRunner />
      <span>Tap Santa for a one-minute mince-pie dash</span>
    </button> : <div className="mini-santa-dash__game">
      <div className="mini-santa-dash__toolbar">
        <strong>Mini Santa Dash</strong>
        <span aria-label={`${Math.ceil((ROUND_MS - round.elapsed) / 1000)} seconds remaining`}>{Math.ceil((ROUND_MS - round.elapsed) / 1000)}s</span>
        <span>{round.score} {round.score === 1 ? 'pie' : 'pies'}</span>
        {mode === 'playing' && <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume' : 'Pause'}</button>}
        <button onClick={close}>Close</button>
      </div>
      {mode === 'finished' ? <div className="mini-santa-dash__result">
        <p role="status">Time’s up! Santa collected {round.score} {round.score === 1 ? 'mince pie' : 'mince pies'}.</p>
        <button onClick={start}>Play again</button>
      </div> : <>
        <button ref={arena} type="button" className="mini-santa-dash__arena" onClick={jump}
          aria-label="Jump for a mince pie. Press Space or Enter, or tap to jump."
          aria-describedby="mini-santa-dash-instructions"
          onKeyDown={event => {
            if (event.code === 'Space' || event.code === 'Enter') {
              event.preventDefault();
              if (!event.repeat) jump();
            }
          }}>
          <span className="mini-santa-dash__santa" style={{ transform: `translate(-50%, ${-jumpHeight(round.jump)}px)` }}>
            <picture><source media="(prefers-reduced-motion: reduce)" srcSet="/images/studio-runners/classic-still.png" /><img src="/images/studio-runners/classic.webp" alt="" width="60" height="64" draggable="false" /></picture>
          </span>
          {round.pies.map(pie => <img key={pie.id} className="mini-santa-dash__pie" src="/images/tracker/mince-pie.png" alt="" draggable="false" style={{ left: `${pie.x * 100}%`, bottom: `${pie.height + 12}px` }} />)}
          {!active && <span className="mini-santa-dash__paused">Paused</span>}
        </button>
        <p id="mini-santa-dash-instructions">Tap the game or press Space to jump. Collect the pies as they approach Santa!</p>
      </>}
    </div>}
  </div>;
}
