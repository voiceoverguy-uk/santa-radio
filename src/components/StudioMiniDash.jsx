import { useEffect, useRef, useState } from 'react';
import './StudioMiniDash.css';

export default function StudioMiniDash() {
  const lane = useRef(null), santa = useRef(null), item = useRef(null);
  const engine = useRef({ jump: 0, active: true });
  const [score, setScore] = useState(0), [streak, setStreak] = useState(0);
  const [kind, setKind] = useState('pie'), [notice, setNotice] = useState('Collect pies and jump over the obstacles!');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const jump = () => {
    if (paused) { setPaused(false); return; }
    if (!engine.current.jump) engine.current.jump = performance.now();
  };
  useEffect(() => {
    engine.current.jump = 0;
    if (paused) return;
    let frame, last = performance.now(), x = lane.current.clientWidth + 40, count = 0, checked = false;
    const sequence = ['pie', 'tree', 'pie', 'chimney'];
    setKind('pie');
    const tick = now => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      if (now - last < 33) return;
      const dt = Math.min((now - last) / 1000, .06); last = now;
      const elapsed = engine.current.jump ? (now - engine.current.jump) / 850 : 0;
      const height = elapsed > 0 && elapsed < 1 ? Math.sin(elapsed * Math.PI) * 105 : 0;
      if (elapsed >= 1) engine.current.jump = 0;
      santa.current.style.transform = `translateY(${-height}px)`;
      x -= 155 * dt;
      item.current.style.transform = `translateX(${x}px)`;
      if (!checked && x < 100 && x > 25) {
        const pie = sequence[count % 4] === 'pie';
        if (pie && height > 35 && height < 115) {
          checked = true; setScore(n => n + 10); setStreak(n => n + 1);
          setNotice('Mince pie collected!'); item.current.style.visibility = 'hidden';
        } else if (!pie && height < 55) {
          checked = true; setStreak(0); setNotice('Oops! Keep going — jump a little earlier.');
        }
      }
      if (x < -45) {
        count++; checked = false; x = lane.current.clientWidth + 70;
        setKind(sequence[count % 4]); item.current.style.visibility = 'visible';
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);
  return <section className="studio-mini-dash" aria-label="Mini Santa Dash while your video is prepared">
    <div className="studio-mini-dash__heading"><strong>Santa Dash</strong><span>Score: {score} · Streak: {streak}</span></div>
    <div className="studio-mini-dash__lane" ref={lane}>
      <button ref={santa} className="studio-mini-dash__santa" type="button" aria-label="Make Santa jump" onClick={jump}>
        <img src={`/images/studio-runners/classic${paused ? '-still.png' : '.webp'}`} width="60" height="64" alt="" draggable="false" />
      </button>
      <span ref={item} className={`studio-mini-dash__item studio-mini-dash__item--${kind}`} aria-hidden="true" style={paused ? { visibility: 'hidden' } : undefined}>
        {kind === 'pie' ? <img src="/images/tracker/mince-pie.png" alt="" width="36" height="36" /> : kind === 'tree' ? '🎄' : <span className="studio-mini-dash__chimney" />}
      </span>
    </div>
    <div className="studio-mini-dash__controls">
      <button className="smw-button" type="button" onClick={jump}>{paused ? 'Play Santa Dash' : 'Jump ↑'}</button>
      {!paused && <button className="smw-change" type="button" onClick={() => setPaused(true)}>Pause game</button>}
      <span>{notice}</span>
    </div>
    <small>Tap Santa or Jump. With the button selected, Space jumps too. Your video keeps building.</small>
  </section>;
}
