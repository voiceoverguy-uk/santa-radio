import { useEffect, useRef, useState } from 'react';
import './StudioMiniDash.css';

import { RUN_SPEED, startJump, advanceJump, nextObstacle, nextPieGap, nextPieHeight, nextObstacleGap } from '../lib/studioMiniDashPhysics.js';
const ASSETS = '/media/studio-mini-dash/';
export default function StudioMiniDash({ progress = 0, onFinish }) {
  const [playing, setPlaying] = useState(false);
  const finishCallback = useRef(onFinish);
  finishCallback.current = onFinish;
  const finished = progress !== null && progress >= .92;
  useEffect(() => {
    if (!finished) return;
    if (!playing) { finishCallback.current?.(); return; }
    const timer = setTimeout(() => finishCallback.current?.(), 6000);
    return () => clearTimeout(timer);
  }, [finished, playing]);
  if (finished && !playing) return null;
  return playing ? <SantaDashGame finished={finished} onClose={() => setPlaying(false)} /> : <div className="studio-mini-dash">
    <button className="studio-mini-dash__teaser" type="button" aria-label="Play Santa Dash Mini" onClick={() => setPlaying(true)}>
      <strong>Santa Dash Mini</strong>
      <span className="studio-mini-dash__teaser-copy">Mince pies and Christmas magic</span>
      <span className="studio-mini-dash__teaser-wait">While you wait</span>
      <span className="studio-mini-dash__teaser-play">Play Santa Dash Mini <span aria-hidden="true">→</span></span>
    </button>
    <small>A little game while you wait. Your video keeps building.</small>
  </div>;
}

function SantaDashGame({ onClose, finished }) {
  const lane = useRef(null), santa = useRef(null), items = useRef([]);
  const engine = useRef({ height: 0, velocity: 0, held: false, tripUntil: 0, time: 1, objects: null });
  const [kinds, setKinds] = useState(() => [...Array(24).fill('pie'), ...Array.from({length:4}, () => nextObstacle())]);
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
    if (finished) return;
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
    if (paused || finished) return;
    let frame, last = performance.now();

    let laneWidth = lane.current.clientWidth;
    const resize = new ResizeObserver(() => { laneWidth = lane.current.clientWidth; });
    resize.observe(lane.current);
    let pieX = Math.min(laneWidth, 240), obstacleX = Math.min(laneWidth + 80, 520);
    const objects = engine.current.objects ||= kinds.map(kind => {
      const pie = kind === 'pie';
      const object = {kind, x:pie ? pieX : obstacleX, y:pie ? nextPieHeight() : 0, checked:false};
      if(pie) pieX += nextPieGap(); else obstacleX += nextObstacleGap();
      return object;
    });
    const tick = frameTime => {
      const dt = Math.min((frameTime - last) / 1000, .05); last = frameTime;
      const now = engine.current.time += dt * 1000;
      const height = advanceJump(engine.current, dt);
      const tripped = now < engine.current.tripUntil;
      santa.current.style.transform = tripped ? 'translate3d(0,6px,0) rotate(65deg)' : `translate3d(0,${-height}px,0)`;
      objects.forEach((object, i) => {
        const element = items.current[i];
        object.x -= RUN_SPEED * dt;
        if (object.kind === 'pie') {
          if (!object.checked && object.x < 100 && object.x > 25 && height + 60 > object.y && height < object.y + 32 && !tripped) {
            object.checked = true; setScore(n => n + 10); playSound('pie'); setNotice('Mince pie collected!');
          }
        } else if (!object.checked && object.x < 90 && object.x > (object.kind === 'gary' ? -10 : 25) && height < (object.kind === 'gary' ? 100 : 60) && !tripped) {
          object.checked = true; engine.current.tripUntil = now + 650; engine.current.height = 0; engine.current.velocity = 0;
          setNotice('Oops! Jump a little earlier — keep going!');
        }
        if (object.x < -100) {
          const pie = object.kind === 'pie';
          const group = objects.filter(other => (other.kind === 'pie') === pie);
          object.x = Math.max(laneWidth + 40, ...group.map(other => other.x)) + (pie ? nextPieGap() : nextObstacleGap());
          if(pie) object.y = nextPieHeight();
          else {
            object.kind = nextObstacle(object.kind);
            setKinds(current => current.map((kind, index) => index === i ? object.kind : kind));
          }
          object.checked = false;
        }
        if(element.children[0]) element.children[0].style.visibility = object.kind === 'pie' && object.checked ? 'hidden' : 'visible';
        element.style.bottom = `${object.y}px`;
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
  }, [paused, finished]);
  if (finished) return <section className="studio-mini-dash studio-mini-dash--finished" role="status">
    <img className="studio-mini-dash__reward" src="/images/tracker/mince-pie.png" width="64" height="64" alt=""/>
    <strong>Congratulations!</strong>
    <p className="studio-mini-dash__collected">You collected {score / 10} mince {score === 10 ? 'pie' : 'pies'}!</p>
    <div className="studio-mini-dash__final-score"><span>Your mince pie score</span><b>{score}</b></div>
    
    <a className="studio-mini-dash__download" href="https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397" target="_blank" rel="noopener noreferrer">Download the full game <span aria-hidden="true">↗</span></a>
    
  </section>;
  return <section className="studio-mini-dash" aria-label="Mini Santa Dash while your video is prepared">
    <div className="studio-mini-dash__heading"><strong>Santa Dash Mini</strong><span>Score: {score}</span></div>
    <div className="studio-mini-dash__lane" ref={lane} {...holdControls}>
      <button ref={santa} className="studio-mini-dash__santa" type="button" aria-label="Make Santa jump" onClick={accessibleClick}>
        <img src={`/images/studio-runners/classic${paused ? '-still.png' : '.webp'}`} width="60" height="64" alt="" draggable="false" />
      </button>
      {kinds.map((kind, i) => <span key={i} ref={node => { items.current[i] = node; }} className={`studio-mini-dash__item studio-mini-dash__item--${kind}`} aria-hidden="true" >
        {kind === 'pie' ? <img src="/images/tracker/mince-pie.png" alt="" width="36" height="36"/> : <img src={`${ASSETS}${kind}.png`} alt="" width={kind === 'gary' ? 88 : 44} height={kind === 'gary' ? 120 : 60}/>}
      </span>)}
    </div>
    <div className="studio-mini-dash__controls">
      <button className="smw-button" type="button"  {...holdControls} onClick={accessibleClick}>{paused ? 'Play Santa Dash' : 'Jump ↑'}</button>
      {!paused && <button className="smw-change" type="button" onClick={() => { release(); setPaused(true); sound.current.context?.suspend().catch(() => {}); }}>Pause game</button>}
      <button className="smw-change" type="button" aria-pressed={muted} onClick={() => { enableSound(); sound.current.muted = !muted; setMuted(!muted); }}>{muted ? 'Sound on' : 'Mute sound'}</button>
      <button className="smw-change" type="button" onClick={onClose}>Close game</button>
      <span>{notice}</span>
    </div>
    <small>Press to jump or press longer to jump higher. Your video keeps building.</small>
  </section>;
}
