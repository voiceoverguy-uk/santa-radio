import { useEffect, useRef, useState } from 'react';
import './analyserGlints.css';

/* North Pole analyser: supplied brass artwork with countdown + candy-cane slot overlays. */
const SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const DIGIT_MAP = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};
const ARTWORK = {
  checking: { src: '/images/north-pole-analyser-machine.webp', width: 1609, height: 977 },
  connecting: { src: '/images/north-pole-analyser-connecting.webp', width: 1610, height: 977 },
  final: { src: '/images/head-elf-list-engine.webp', width: 1632, height: 964 },
};

/* Glint anchors as % of each artwork: brass near tube tops, bell, lever. [x, y, dx px, dy px] */
const TOP_GLINTS = [
  [33.7, 9.5, 5, -4], [48.5, 3.6, -4, -5], [60, 12, 4, -3],
  [16.2, 15.5, -5, -3], [88, 18, 4, -4], [81.2, 69.5, 5, -3], [11, 7.5, -3, -5],
  [28, 19, -4, -4], [41, 12, 4, -5], [54, 17, -5, -3],
  [70, 10, 4, -4], [81, 8, -4, -5], [7, 32, 4, -3], [91, 35, -4, -4],
];
const GLINTS = {
  checking: TOP_GLINTS,
  connecting: TOP_GLINTS,
  final: [
    [32.2, 18, -4, -4], [40, 10.8, 4, -5], [49.8, 2.6, -4, -5], [59.6, 10.8, 5, -4],
    [67.9, 18, 4, -4], [22, 19, -5, -3], [83, 12.4, 4, -5], [78, 28.5, 5, -3],
    [29, 26, 4, -4], [36, 23, -4, -5], [45, 17, 5, -4], [54, 20, -5, -3],
    [64, 23, 4, -5], [72, 27, -4, -4], [19, 11, 5, -3], [85, 24, -4, -5],
  ],
};

function Glints({ variant }) {
  const list = GLINTS[variant];
  return (
    <div className="nn-machine-glints" aria-hidden="true" data-variant={variant}>
      {list.map(([x, y, dx, dy], i) => (
        <i key={i} className="nn-machine-glint" style={{
          '--x': `${x}%`, '--y': `${y}%`, '--dx': `${dx}px`, '--dy': `${dy}px`,
          // Begin part-way through staggered cycles: even a short countdown
          // has visible glints as soon as its artwork is ready.
          '--delay': `${(-0.22 - i * 4 / list.length).toFixed(2)}s`, '--cycle': '4s',
        }} />
      ))}
    </div>
  );
}

function Smoke() {
  return (
    <div className="nn-machine-smoke" aria-hidden="true">
      <i className="nn-machine-smoke__wisp nn-machine-smoke__wisp--left" />
      <i className="nn-machine-smoke__wisp nn-machine-smoke__wisp--middle" />
      <i className="nn-machine-smoke__wisp nn-machine-smoke__wisp--right" />
    </div>
  );
}

function Digit({ value }) {
  const on = DIGIT_MAP[value] || '';
  return (
    <span className="nn-seg-digit" aria-hidden="true">
      {SEGMENTS.map((s) => (
        <i key={s} className={`nn-seg nn-seg--${s}${on.includes(s) ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

function Machine({ busy = false, secondsRemaining = 0, variant }) {
  const connecting = variant === 'connecting';
  const artwork = ARTWORK[variant];
  const image = useRef(null);
  const [imageReady, setImageReady] = useState(false);
  useEffect(() => {
    const element = image.current;
    let active = true;
    const failed = () => { if (active) setImageReady(false); };
    const loaded = () => {
      const decoded = () => {
        if (active && element.complete && element.naturalWidth > 0) setImageReady(true);
      };
      if (typeof element.decode === 'function') element.decode().then(decoded, failed);
      else decoded();
    };
    element.addEventListener('load', loaded);
    element.addEventListener('error', failed);
    // Cached artwork can finish loading before the effect attaches its listener.
    if (element.complete && element.naturalWidth > 0) loaded();
    return () => {
      active = false;
      element.removeEventListener('load', loaded);
      element.removeEventListener('error', failed);
    };
  }, []);
  const n = Math.max(0, Math.min(99, Math.floor(Number(secondsRemaining) || 0)));
  const text = String(n).padStart(2, '0');
  // The homepage checking analyser is the only "checking" variant. Start the
  // decorative wisps with its displayed four-second window, and stop at zero.
  const smoking = busy && variant === 'checking' && n > 0 && n <= 4;
  // The homepage countdown settles for its final three seconds. Keep busy
  // independent so the slot animation and sparkles continue uninterrupted.
  const wobbling = busy && !connecting && (variant !== 'checking' || n > 3);
  return (
    <div className={`nn-machine${busy ? ' is-busy' : ''}${wobbling ? ' is-wobbling' : ''}${variant !== 'checking' ? ` nn-machine--${variant}` : ''}`}>
      <img ref={image} className="nn-machine-art"
        src={artwork.src} alt="" width={artwork.width} height={artwork.height} decoding="async" />
      {imageReady && <><div className="nn-machine-screen">
        {connecting ? <span className="nn-machine-connection">CONNECTING</span> : <div className="nn-machine-digits" role="timer" aria-live="off" aria-atomic="true">
          <span className="nn-sr-only">{n} {n === 1 ? 'second' : 'seconds'} remaining</span>
          <Digit value={Number(text[0])} />
          <Digit value={Number(text[1])} />
        </div>}
      </div>
      <div className="nn-machine-slot" aria-hidden="true">
        <span className="nn-progress nn-machine-progress" />
      </div>
      <Glints variant={variant} />
      {smoking && <Smoke />}</>}
    </div>
  );
}

export default function AnalyserMachine(props) {
  // A different artwork starts with its overlays hidden, even during a fast restart.
  const variant = props.connecting ? 'connecting' : props.finalAnalysis ? 'final' : 'checking';
  return <Machine key={variant} {...props} variant={variant} />;
}
