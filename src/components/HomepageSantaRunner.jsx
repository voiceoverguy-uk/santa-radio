import { useEffect, useRef, useState } from 'react';
import './StudioPreparationRunner.css';
import './HomepageSantaRunner.css';

const BASE = '/images/studio-runners/classic';
const JUMP_STRIP_URL = '/images/santa-dash/classic-jump-strip.png';
const JUMP_DURATION_MS = 550;
const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 12000;

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Random delay in [5000, 12000] ms; pass a deterministic random() for tests. */
export function nextJumpDelay(random = Math.random) {
  const r = Math.min(Math.max(Number(random()) || 0, 0), 0.999999);
  return MIN_DELAY_MS + Math.floor(r * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

export default function HomepageSantaRunner() {
  const laneRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(false);
  const [docVisible, setDocVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );
  const [stripReady, setStripReady] = useState(false);
  const [jumping, setJumping] = useState(false);

  const enabled = !reducedMotion && inView && docVisible;

  // Live reduced-motion preference.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setReducedMotion(false);
      return undefined;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    setReducedMotion(prefersReducedMotion());
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // Lane visibility.
  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return undefined;
    if (!('IntersectionObserver' in window)) {
      // If visibility cannot be observed, retain the running artwork only.
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting && entry.intersectionRatio > 0);
    }, { threshold: 0 });
    observer.observe(lane);
    return () => observer.disconnect();
  }, []);

  // Document visibility.
  useEffect(() => {
    const update = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    update();
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // Preload/decode strip once, only for motion-allowed visitors in view.
  useEffect(() => {
    if (stripReady || reducedMotion || !inView) return undefined;
    let cancelled = false;
    const img = new Image();
    const markReady = () => { if (!cancelled) setStripReady(true); };
    img.onload = () => {
      if (cancelled) return;
      if (typeof img.decode === 'function') img.decode().then(markReady, () => {});
      else markReady();
    };
    img.onerror = () => {}; // failure: keep running only
    img.src = JUMP_STRIP_URL;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [stripReady, reducedMotion, inView]);

  // Cancel any active jump when disabled.
  useEffect(() => {
    if (!enabled) setJumping(false);
  }, [enabled]);

  // Schedule the next jump after readiness and after each landing.
  useEffect(() => {
    if (!enabled || !stripReady || jumping) return undefined;
    const delay = nextJumpDelay();
    const timer = window.setTimeout(() => {
      setJumping(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, stripReady, jumping]);

  // Explicit completion timer matching the CSS duration.
  useEffect(() => {
    if (!jumping) return undefined;
    const timer = window.setTimeout(() => setJumping(false), JUMP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [jumping]);

  const showJump = jumping && enabled && stripReady;

  return (
    <div
      ref={laneRef}
      className="studio-runner-lane homepage-santa-runner"
      aria-hidden="true"
      data-jumping={showJump ? 'true' : 'false'}
      data-jump-ready={stripReady ? 'true' : 'false'}
      data-jump-enabled={enabled ? 'true' : 'false'}
    >
      <div className="studio-runner-travel">
        <div
          className={`homepage-santa-hop${showJump ? ' is-jumping' : ''}`}
        >
          <div className="homepage-santa-facing">
            <picture className={`homepage-santa-runner__run${showJump ? ' is-hidden' : ''}`}>
              <source media="(prefers-reduced-motion: reduce)" srcSet={`${BASE}-still.png`} />
              <img src={`${BASE}.webp`} alt="" width="60" height="64" draggable="false" />
            </picture>
            {showJump && (
              <span className="homepage-santa-runner__jump">
                <span
                  className="homepage-santa-sprite"
                  style={{ backgroundImage: `url(${JUMP_STRIP_URL})` }}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
