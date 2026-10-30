import { useCallback, useEffect, useRef, useState } from 'react';
import { certificateExampleNames, allCertificateExamples } from '../lib/santaCertificateExamples.js';
import { createStudioLetter, CERTIFICATE_WRITE_MS, LETTER_CHARACTER_MS,
  SIGNATURE_WRITE_MS, letterBodyDuration, letterDuration } from '../lib/santaStudioLetter.js';
import './SantaStudioGifts.css';

function WrittenText({ text, count }) {
  const end = Math.max(0, Math.min(text.length, count));
  return <>{text.slice(0, end)}<span className="studio-writing-hidden">{text.slice(end)}</span></>;
}

function ScriptReveal({ children, progress }) {
  return <span className="studio-script-reveal" style={{
    // Great Vibes paints beyond its advance/line box. Reveal horizontally,
    // leaving room for upper/lower strokes and both side bearings.
    clipPath: progress >= 1 ? 'none'
      : `inset(-1em calc(${100 - progress * 100}% - ${progress * 0.5}em) -1em -0.5em)`,
    visibility: progress <= 0 ? 'hidden' : undefined,
  }}>{children}</span>;
}

function Certificate({ name, elapsed }) {
  const progress = Math.min(1, elapsed / CERTIFICATE_WRITE_MS);
  return <div className="studio-certificate" role="img" aria-label={`Official Nice List certificate example for ${name}`}>
    <img src="/certificates/examples/blank-master.webp" alt="" width="1684" height="1191" />
    <span aria-hidden="true" className="studio-certificate__name">
      <ScriptReveal progress={progress}>{name}</ScriptReveal>
    </span>
  </div>;
}

function Letter({ letter, elapsed }) {
  const bodyCount = Math.floor((elapsed - CERTIFICATE_WRITE_MS) / LETTER_CHARACTER_MS);
  const signatureProgress = Math.max(0, Math.min(1,
    (elapsed - CERTIFICATE_WRITE_MS - letterBodyDuration(letter)) / SIGNATURE_WRITE_MS));
  let offset = 0;
  return <article className="studio-letter__paper" aria-label={`Santa’s letter example for ${letter.name}`}>
    <div className="studio-gifts__sr">
      {letter.paragraphs.map((text, index) => <p key={index}>{text}</p>)}
      <p>Santa Claus</p>{letter.closing.map(text => <p key={text}>{text}</p>)}
    </div>
    <div className="studio-letter__text" aria-hidden="true">
      {letter.paragraphs.map((text, index) => {
        const count = bodyCount - offset;
        offset += text.length;
        return <p key={index}><WrittenText text={text} count={count} /></p>;
      })}
      <div className="studio-letter__signature">
        <ScriptReveal progress={signatureProgress}>Santa Claus</ScriptReveal>
      </div>
      <div className={signatureProgress < 1 ? 'studio-writing-hidden' : ''}>
        {letter.closing.map(text => <p key={text}>{text}</p>)}
      </div>
    </div>
  </article>;
}

// Keyed by recipient: a deliberate demo change cancels every old animation,
// reading timer and random selection together, before rendering the new name.
function GiftExample({ name, activeAudio, reducedMotion, onNext }) {
  // Deterministic SSR; randomise only once after mounting in the browser.
  const [letter, setLetter] = useState(() => createStudioLetter(name, () => 0.5));
  const [elapsed, setElapsed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reading, setReading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState(null);
  const sectionRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const closeRef = useRef(null);
  const duration = letterDuration(letter);
  const displayElapsed = revealed || reducedMotion ? duration : elapsed;
  const finished = displayElapsed >= duration;

  useEffect(() => { setLetter(createStudioLetter(name)); }, [name]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (finished || !visible) return undefined;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      setElapsed(value => Math.min(duration, value + delta));
    }, 40);
    return () => clearInterval(timer);
  }, [finished, visible, duration]);
  useEffect(() => {
    if (!finished || activeAudio || reducedMotion || !visible || hovered || focused || reading || view) return undefined;
    // Full typing time PLUS a minute to read; never the old five-second loop.
    const timer = setTimeout(onNext, 60000);
    return () => clearTimeout(timer);
  }, [finished, activeAudio, reducedMotion, visible, hovered, focused, reading, view, onNext]);
  useEffect(() => {
    if (!view) return undefined;
    const dialog = dialogRef.current;
    dialog.showModal();
    closeRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [view]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const close = () => {
      setView(null);
      openerRef.current?.focus({ preventScroll: true });
    };
    dialog.addEventListener('close', close);
    return () => dialog.removeEventListener('close', close);
  }, []);

  const open = (event, kind) => {
    openerRef.current = event.currentTarget;
    setView(kind);
  };
  return <section ref={sectionRef} className="studio-gifts" aria-label="Paid Studio gift preview"
    data-demo-name={name} data-complete={finished}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <h4>From Santa’s desk — a gift preview</h4>
    <p>A coming-soon certificate and letter for the paid Studio, not the free greeting. This visual trial does not create downloads.</p>
    <p>Example for <strong>{name}</strong>{activeAudio ? ' — matching the audio demo.' : '.'}</p>
    <div className="studio-gifts__gallery" role="group" aria-label="Certificate and letter previews">
      <button className="studio-gifts__thumbnail studio-gifts__thumbnail--certificate" type="button"
        aria-label="Enlarge certificate" onClick={event => open(event, 'certificate')}>
        <Certificate name={name} elapsed={displayElapsed} />
        <span className="studio-gifts__thumbnail-label">Enlarge certificate</span>
      </button>
      <button className="studio-gifts__thumbnail studio-gifts__thumbnail--letter" type="button"
        aria-label="Enlarge letter to read" onClick={event => open(event, 'letter')}>
        <Letter letter={letter} elapsed={displayElapsed} />
        <span className="studio-gifts__thumbnail-label">Enlarge letter</span>
      </button>
    </div>
    <div className="studio-gifts__actions">
      <button type="button" onClick={() => setRevealed(true)} disabled={finished}>Show full letter now</button>
      <button type="button" onClick={onNext} disabled={activeAudio}>Next example</button>
    </div>
    <p className="studio-gifts__reading-note">Examples pause while you read or enlarge them.</p>
    <dialog ref={dialogRef} className="studio-letter-dialog"
      aria-label={`${name}’s ${view || 'gift'} example`}
      onCancel={() => dialogRef.current.close()}>
      <div className="studio-letter-dialog__toolbar">
        <button type="button" onClick={() => setRevealed(true)} disabled={finished}>Show full letter now</button>
        <button ref={closeRef} type="button" onClick={() => dialogRef.current.close()}>Close preview</button>
      </div>
      <div className="studio-letter-dialog__content" role="region" aria-label="Enlarged gift preview"
        tabIndex={0} onScroll={() => setReading(true)}>
        {view === 'certificate' ? <Certificate name={name} elapsed={displayElapsed} />
          : <Letter letter={letter} elapsed={displayElapsed} />}
      </div>
    </dialog>
  </section>;
}

export default function SantaStudioGifts({ activeExampleName = null }) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const activeName = allCertificateExamples.find(item => item.name === activeExampleName)?.name;
  const name = activeName || certificateExampleNames[index];
  const nextExample = useCallback(() => setIndex(value => (value + 1) % certificateExampleNames.length), []);
  // Keep the audio name on stop when it belongs to the idle rotation.
  useEffect(() => {
    const next = certificateExampleNames.indexOf(activeName);
    if (next >= 0) setIndex(next);
  }, [activeName]);
  return <GiftExample key={name} name={name} activeAudio={Boolean(activeName)} reducedMotion={reducedMotion}
    onNext={nextExample} />;
}
