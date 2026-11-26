import { useEffect, useRef } from 'react';
import './MiniSantaDashTeaser.css';

export default function MiniSantaDashTeaser() {
  const lane = useRef(null), runner = useRef(null), facing = useRef(null);
  useEffect(() => {
    const element = lane.current;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let width = element.clientWidth, visible = false, frame, previous, distance = 0;
    const paint = () => {
      const travel = Math.max(1, width - 60);
      const phase = distance % (travel * 2);
      const right = phase <= travel;
      const x = right ? phase : travel * 2 - phase;
      const gap = Math.abs(x + 30 - width / 2);
      const hop = gap < 110 ? 90 * Math.cos(gap / 110 * Math.PI / 2) : 0;
      runner.current.style.transform = `translate3d(${x}px, ${-hop}px, 0)`;
      facing.current.style.transform = `scaleX(${right ? 1 : -1})`;
    };
    const tick = time => {
      distance += previous === undefined ? 0 : Math.min(time - previous, 50) * .11;
      previous = time;
      paint();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); previous = undefined;
      if (motion.matches) {
        runner.current.style.transform = 'translate3d(12px, 0, 0)';
      } else if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(() => { width = element.clientWidth; if (!motion.matches) paint(); });
    resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return <span className="mini-dash-teaser" ref={lane} aria-hidden="true">
    <span className="mini-dash-teaser__box">PLAY</span>
    <span className="mini-dash-teaser__runner" ref={runner}><picture ref={facing}>
      <source media="(prefers-reduced-motion: reduce)" srcSet="/images/studio-runners/classic-still.png" />
      <img src="/images/studio-runners/classic.webp" width="60" height="64" alt="" draggable="false" />
    </picture></span>
  </span>;
}
