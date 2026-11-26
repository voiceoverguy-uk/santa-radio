import { useEffect, useRef, useState } from 'react';
import HomepageSantaRunner from './HomepageSantaRunner.jsx';
import { advanceRound, jumpHeight, pressJump, releaseJump, newRound, ROUND_MS } from './miniSantaDash.js';
import './MiniSantaDash.css';

export default function MiniSantaDash({ onFinishedChange }) {
  const [mode, setMode] = useState('idle');
  const [round, setRound] = useState(newRound);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const root = useRef(null);
  const pointer = useRef(null);
  const audio = useRef({ context: null, buffer: null });
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const finishedCallback = useRef(onFinishedChange);
  finishedCallback.current = onFinishedChange;
  const arena = useRef(null);
  const startButton = useRef(null);
  const state = useRef(round);
  const active = mode === 'playing' && visible && !hidden && !paused;

  function enableSound() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audio.current.context) {
      const context = new Context();
      audio.current.context = context;
      fetch('/media/studio-mini-dash/coin.wav').then(r => { if (!r.ok) throw Error(); return r.arrayBuffer(); })
        .then(bytes => context.decodeAudioData(bytes)).then(buffer => { audio.current.buffer = buffer; }).catch(() => {});
    }
    audio.current.context.resume().catch(() => {});
  }
  function collectionSound() {
    const { context, buffer } = audio.current;
    if (mutedRef.current || context?.state !== 'running' || !buffer) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; gain.gain.value = .55;
    source.connect(gain); gain.connect(context.destination); source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  useEffect(() => () => { audio.current.context?.close().catch(() => {}); }, []);
  useEffect(() => {
    finishedCallback.current?.(mode === 'finished');
    if (mode !== 'finished') return undefined;
    const timer = setTimeout(() => {
      const restoreFocus = root.current?.contains(document.activeElement);
      setMode('idle');
      if (restoreFocus) requestAnimationFrame(() => startButton.current?.focus({ preventScroll: true }));
    }, 4000);
    return () => { clearTimeout(timer); finishedCallback.current?.(false); };
  }, [mode]);

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
        const previousCollected = state.current.collected;
        state.current = advanceRound(state.current, dt, width);
        if (state.current.collected > previousCollected) collectionSound();
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
    enableSound();
    state.current = newRound();
    setRound(state.current);
    setPaused(false);
    setMode('playing');
    requestAnimationFrame(() => arena.current?.focus({ preventScroll: true }));
  }
  function jump() {
    if (!active || state.current.held) return;
    enableSound();
    state.current = pressJump(state.current);
    setRound(state.current);
  }
  function release() {
    pointer.current = null;
    state.current = releaseJump(state.current);
  }
  useEffect(() => {
    if (!active) release();
  }, [active]);
  useEffect(() => {
    window.addEventListener('blur', release);
    window.addEventListener('pointerup', release);
    window.addEventListener('keyup', release);
    return () => {
      window.removeEventListener('blur', release);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('keyup', release);
    };
  }, []);
  function close() {
    setMode('idle');
    requestAnimationFrame(() => startButton.current?.focus({ preventScroll: true }));
  }

  return <div className="mini-santa-dash" ref={root}>
    {mode === 'idle' ? <button ref={startButton} className="mini-santa-dash__start" onClick={start} aria-label="Play Mini Santa Dash for one minute">
      <HomepageSantaRunner />
      <span>Tap Santa for a one-minute mince-pie dash</span>
    </button> : <div className={`mini-santa-dash__game${mode === 'finished' ? ' mini-santa-dash__game--finished' : ''}`}>
      {mode !== 'finished' && <div className="mini-santa-dash__toolbar">
        <strong>Mini Santa Dash</strong>
        <span aria-label={`${Math.ceil((ROUND_MS - round.elapsed) / 1000)} seconds remaining`}>{Math.ceil((ROUND_MS - round.elapsed) / 1000)}s</span>
        <span>{round.score} {round.score === 1 ? 'pie' : 'pies'}</span>
        {mode === 'playing' && <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume' : 'Pause'}</button>}
        {mode === 'playing' && <button aria-pressed={muted} onClick={() => { enableSound(); mutedRef.current = !muted; setMuted(!muted); }}>{muted ? 'Sound on' : 'Mute sound'}</button>}
        <button onClick={close}>Close</button>
      </div>}
      {mode === 'finished' ? <div className="mini-santa-dash__result" role="status">
        <img src="/images/tracker/mince-pie.png" width="64" height="64" alt="" />
        <strong>Congratulations!</strong>
        <p>You collected {round.score} mince {round.score === 1 ? 'pie' : 'pies'}!</p>
        <p>Your mince pie score <b>{round.score * 10}</b></p>
        <p>Enjoyed that? Download Santa Dash using the highlighted button above.</p>
      </div> : <>
        <button ref={arena} type="button" className="mini-santa-dash__arena"
          onPointerDown={event => {
            if (event.button !== 0 || pointer.current !== null) return;
            event.preventDefault();
            pointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.focus({ preventScroll: true });
            jump();
          }}
          onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
          onClick={event => { if (event.detail === 0 && !state.current.held) { jump(); release(); } }}
          onKeyUp={event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); release(); } }}
          aria-label="Jump for a mince pie. Press Space or Enter, or tap. Hold longer to jump higher."
          aria-describedby="mini-santa-dash-instructions"
          onKeyDown={event => {
            if (event.code === 'Space' || event.code === 'Enter') {
              event.preventDefault();
              if (!event.repeat) jump();
            }
          }}>
          <span className="mini-santa-dash__santa" data-tripped={round.elapsed < round.tripUntil} style={{ transform: round.elapsed < round.tripUntil ? 'translate(-50%, 6px) rotate(65deg)' : `translate(-50%, ${-jumpHeight(round)}px)` }}>
            <picture><source media="(prefers-reduced-motion: reduce)" srcSet="/images/studio-runners/classic-still.png" /><img src="/images/studio-runners/classic.webp" alt="" width="60" height="64" draggable="false" /></picture>
          </span>
          {round.pies.map(pie => <img key={pie.id} className="mini-santa-dash__pie" src="/images/tracker/mince-pie.png" alt="" draggable="false" style={{ left: `${pie.x * 100}%`, bottom: `${pie.height + 12}px` }} />)}
          {round.obstacles.map(item => <img key={item.id} className={`mini-santa-dash__obstacle mini-santa-dash__obstacle--${item.kind}`} src={`/media/studio-mini-dash/${item.kind}.png`} alt="" draggable="false" style={{ left: `${item.x * 100}%` }} />)}
          {!active && <span className="mini-santa-dash__paused">Paused</span>}
        </button>
        <p id="mini-santa-dash-instructions">Tap the game or press Space to jump. Hold longer to jump higher. Collect pies and jump over Gary, trees, and snowmen. Each trip costs 2 pies!</p>
      </>}
    </div>}
  </div>;
}
