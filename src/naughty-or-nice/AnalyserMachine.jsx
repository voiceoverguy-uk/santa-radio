import { useEffect, useRef, useState } from 'react';

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
  return (
    <div className={`nn-machine${busy ? ' is-busy' : ''}${variant !== 'checking' ? ` nn-machine--${variant}` : ''}`}>
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
      </div></>}
    </div>
  );
}

export default function AnalyserMachine(props) {
  // A different artwork starts with its overlays hidden, even during a fast restart.
  const variant = props.connecting ? 'connecting' : props.finalAnalysis ? 'final' : 'checking';
  return <Machine key={variant} {...props} variant={variant} />;
}
