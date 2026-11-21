import { useEffect, useRef, useState } from 'react';
import './StudioMiniDash.css';

import { RUN_SPEED, startJump, advanceJump, nextItem, nextGap } from '../lib/studioMiniDashPhysics.js';
const ASSETS = '/media/studio-mini-dash/';
export default function StudioMiniDash() {
  const [playing, setPlaying] = useState(false);
  return playing ? <SantaDashGame onClose={() => setPlaying(false)} /> : <div className="studio-mini-dash">
    <button className="smw-button" type="button" onClick={() => setPlaying(true)}>Play Santa Dash</button>
    <small>A little game while you wait. Your video keeps building.</small>
  </div>;
}

function SantaDashGame({ onClose }) {
  const lane = useRef(null), santa = useRef(null), items = useRef([]);
  const engine = useRef({ height: 0, velocity: 0, held: false, tripUntil: 0, time: 1, objects: null });
  const [kinds, setKinds] = useState(() => Array.from({ length: 8 }, () => nextItem()));
  const pointer = useRef(null);
  const sound = useRef({ context: null, buffers: {}, muted: false });
  const [score, setScore] = useState(0), [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState('Collect pies and jump over the obstacles!');
  const [paused, setPaused] = useState(false);
  const enableSound = () => {
    const audio = sound.current;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audio.context) {
      audio.context = new Context();
      for (const [key, file] of Object.entries({ pie: 'coin.wav' })) {
        fetch(ASSETS + file).then(r => { if (!r.ok) throw Error('Audio unavailable'); return r.arrayBuffer(); })
          .then(bytes => audio.context.decodeAudioData(bytes)).then(buffer => { audio.buffers[key] = buffer; }).catch(() => {});
      }
    }
    audio.context.resume().catch(() => {});
  };
  const playSound = key => {
    const audio = sound.current;
    if (audio.muted || audio.context?.state !== 'running' || !audio.buffers[key]) return;
    const source = audio.context.createBufferSource(), gain = audio.context.createGain();
    source.buffer = audio.buffers[key]; gain.gain.value = .55;
    source.connect(gain); gain.connect(audio.context.destination); source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  };
  useEffect(() => () => { sound.current.context?.close().catch(() => {}); }, []);
  const release = () => { engine.current.held = false; pointer.current = null; };
  const press = () => {
    enableSound();
    if (paused) setPaused(false);
    if (engine.current.held) return;
    engine.current.held = true;
    startJump(engine.current);
  };
  const holdControls = {
    onPointerDown: event => {
      if (event.button !== 0 || pointer.current !== null) return;
      event.preventDefault();
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      press();
    },
    onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release,
    onKeyDown: event => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) press();
    },
    onKeyUp: event => {
      if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); release(); }
    },
    onBlur: release,
  };
  const accessibleClick = event => { if (event.detail === 0 && !engine.current.held) { press(); release(); } };
  useEffect(() => {
    window.addEventListener('blur', release);
    window.addEventListener('pointerup', release);
    window.addEventListener('keyup', release);
    return () => { window.removeEventListener('blur', release); window.removeEventListener('pointerup', release); window.removeEventListener('keyup', release); };
  }, []);
  useEffect(() => {
    if (paused) return;
    let frame, last = performance.now();

    let laneWidth = lane.current.clientWidth;
    const resize = new ResizeObserver(() => { laneWidth = lane.current.clientWidth; });
    resize.observe(lane.current);
    let spawnX = Math.min(laneWidth, 420);
    const objects = engine.current.objects ||= kinds.map(kind => { const object = { kind, x: spawnX, checked: false, collected: false }; spawnX += nextGap(); return object; });
    const tick = frameTime => {
      const dt = Math.min((frameTime - last) / 1000, .05); last = frameTime;
      const now = engine.current.time += dt * 1000;
      const height = advanceJump(engine.current, dt);
      const tripped = now < engine.current.tripUntil;
      santa.current.style.transform = tripped ? 'translate3d(0,6px,0) rotate(65deg)' : `translate3d(0,${-height}px,0)`;
      objects.forEach((object, i) => {
        const element = items.current[i];
        object.x -= RUN_SPEED * dt;
        if (!object.checked && object.x < 100 && object.x > 25) {
          if (object.kind === 'pie' && height > 35 && !tripped) {
            object.checked = true; object.collected = true; setScore(n => n + 10); playSound('pie');
            setNotice('Mince pie collected!'); element.style.visibility = 'hidden';
          } else if (object.kind !== 'pie' && height < 60 && !tripped) {
            object.checked = true; engine.current.tripUntil = now + 650; engine.current.height = 0; engine.current.velocity = 0;
            setNotice('Oops! Jump a little earlier — keep going!');
          }
        }
        if (object.x < -60) {
          object.x = Math.max(laneWidth + 40, ...objects.map(other => other.x)) + nextGap();
          object.kind = nextItem(object.kind);
          setKinds(current => current.map((kind, index) => index === i ? object.kind : kind));
          object.checked = false; object.collected = false;
        }
        element.style.visibility = object.collected ? 'hidden' : 'visible';
        element.style.transform = `translate3d(${object.x}px,0,0)`;
      });
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      release();
      cancelAnimationFrame(frame);
      if (!document.hidden) { last = performance.now(); frame = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden) frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [paused]);
  return <section className="studio-mini-dash" aria-label="Mini Santa Dash while your video is prepared">
    <div className="studio-mini-dash__heading"><strong>Santa Dash</strong><span>Score: {score}</span></div>
    <div className="studio-mini-dash__lane" ref={lane} {...holdControls}>
      <button ref={santa} className="studio-mini-dash__santa" type="button" aria-label="Make Santa jump" onClick={accessibleClick}>
        <img src={`/images/studio-runners/classic${paused ? '-still.png' : '.webp'}`} width="60" height="64" alt="" draggable="false" />
      </button>
      {kinds.map((kind, i) => <span key={i} ref={node => { items.current[i] = node; }} className={`studio-mini-dash__item studio-mini-dash__item--${kind}`} aria-hidden="true" >
        {kind === 'chimney' ? <span className="studio-mini-dash__chimney" /> : <img src={kind === 'pie' ? '/images/tracker/mince-pie.png' : `${ASSETS}${kind}.png`} alt="" width={kind === 'pie' ? 36 : 44} height={kind === 'pie' ? 36 : 60} />}
      </span>)}
    </div>
    <div className="studio-mini-dash__controls">
      <button className="smw-button" type="button"  {...holdControls} onClick={accessibleClick}>{paused ? 'Play Santa Dash' : 'Jump ↑'}</button>
      {!paused && <button className="smw-change" type="button" onClick={() => { release(); setPaused(true); sound.current.context?.suspend().catch(() => {}); }}>Pause game</button>}
      <button className="smw-change" type="button" aria-pressed={muted} onClick={() => { enableSound(); sound.current.muted = !muted; setMuted(!muted); }}>{muted ? 'Sound on' : 'Mute sound'}</button>
      <button className="smw-change" type="button" onClick={onClose}>Close game</button>
      <span>{notice}</span>
    </div>
    <small>Press and hold the game or Jump for a higher jump. Release for a shorter hop. You can also hold Space on the Jump button. Your video keeps building.</small>
  </section>;
}
