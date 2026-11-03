import { useCallback, useEffect, useRef, useState } from 'react';
import { studioGiftExampleNames, allCertificateExamples } from '../lib/santaCertificateExamples.js';
import { createStudioLetter, CERTIFICATE_WRITE_MS, LETTER_CHARACTER_MS,
  SIGNATURE_WRITE_MS, GIFT_EXAMPLE_INTERVAL_MS, letterBodyDuration, letterDuration,
  createStudioLetterVariation } from '../lib/santaStudioLetter.js';
import './SantaStudioGifts.css';
import SantaPictureName from './SantaPictureName.jsx';
import CertificateName from './CertificateName.jsx';
import StudioGiftDownload from './StudioGiftDownload.jsx';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const giftViews = ['certificate', 'letter', 'picture'];

const santaPictures = [
  '/images/santa-nice-list.jpg',
  '/images/santa-nice-list-2.jpg',
  '/images/santa-nice-list-3.jpg',
];

function WrittenText({ text, count }) {
  const end = Math.max(0, Math.min(text.length, count));
  return <>{text.slice(0, end)}<span className="studio-writing-hidden">{text.slice(end)}</span></>;
}

function ScriptReveal({ children, progress }) {
  return <span className="studio-script-reveal" style={{
    // Italic names and Santa's script paint beyond their line boxes. Reveal horizontally,
    // leaving room for upper/lower strokes and both side bearings.
    clipPath: progress >= 1 ? 'none'
      : `inset(-1em calc(${100 - progress * 100}% - ${progress * 0.5}em) -1em -0.5em)`,
    visibility: progress <= 0 ? 'hidden' : undefined,
  }}>{children}</span>;
}

function GiftCard({ enabled, kind, children }) {
  return enabled ? <div className={`studio-gifts__card studio-gifts__card--${kind}`}>{children}</div>
    : <>{children}</>;
}

function Certificate({ name, elapsed }) {
  const progress = Math.min(1, elapsed / CERTIFICATE_WRITE_MS);
  return <div className="studio-certificate" role="img" aria-label={`Official Nice List certificate example for ${name}`}>
    <img src="/certificates/examples/blank-master.webp" alt="" width="1684" height="1191" draggable={false} />
    <CertificateName name={name}>
      {text => <ScriptReveal progress={progress}>{text}</ScriptReveal>}
    </CertificateName>
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

function SantaPicture({ name, elapsed, picture, previousPicture = null, onDissolved }) {
  const [loadedPicture, setLoadedPicture] = useState(null);
  const progress = Math.min(1, elapsed / CERTIFICATE_WRITE_MS);
  return <div className="studio-santa-picture" role="img"
    aria-label={`Santa’s Nice List picture example for ${name}`}>
    <img src={picture} alt="" width="1536" height="1024" draggable={false}
      onLoad={() => setLoadedPicture(picture)} />
    {previousPicture && <span key={previousPicture}
      className={`studio-santa-picture__outgoing${loadedPicture === picture ? ' studio-santa-picture__outgoing--dissolving' : ''}`}
      aria-hidden="true" onAnimationEnd={onDissolved}>
      <img src={previousPicture} alt="" width="1536" height="1024" draggable={false} />
    </span>}
    <SantaPictureName name={name} picture={picture}>
      {text => <ScriptReveal progress={progress}>{text}</ScriptReveal>}
    </SantaPictureName>
  </div>;
}

// Keyed by recipient: a deliberate demo change cancels every old animation,
// reading timer and random selection together, before rendering the new name.
function GiftExample({ name, picture, previousPicture, onDissolved, activeAudio, reducedMotion, onNext,
  staticPreview = false, suppliedLetter = null, reviewHeading = null, downloadReady = false,
  downloadNotice = null, giftRevision = '', downloadUnavailableNotice, children }) {
  // Deterministic SSR; randomise only once after mounting in the browser.
  const [letter, setLetter] = useState(() => suppliedLetter || createStudioLetter(name, () => 0.5));
  const [elapsed, setElapsed] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reading, setReading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState(null);
  const previewOpen = view !== null;
  const sectionRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const closeRef = useRef(null);
  const displayLetter = staticPreview && suppliedLetter ? suppliedLetter : letter;
  const duration = letterDuration(displayLetter);
  const displayElapsed = staticPreview || reducedMotion ? duration : elapsed;
  const finished = displayElapsed >= duration;

  useEffect(() => { if (!staticPreview) setLetter(createStudioLetter(name)); }, [name, staticPreview]);
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
    if (staticPreview || activeAudio || reducedMotion || !visible || hovered || focused || reading || view) return undefined;
    // One shared name drives both documents. Writing completes within this cycle.
    const timer = setTimeout(onNext, GIFT_EXAMPLE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [staticPreview, activeAudio, reducedMotion, visible, hovered, focused, reading, view, onNext, picture]);
  useEffect(() => {
    if (!previewOpen) return undefined;
    const dialog = dialogRef.current;
    dialog.showModal();
    closeRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [previewOpen]);
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
  const changeGift = direction => {
    setView(current => giftViews[(giftViews.indexOf(current) + direction + giftViews.length) % giftViews.length]);
    const content = dialogRef.current?.querySelector('.studio-letter-dialog__content');
    if (content) content.scrollTop = content.scrollLeft = 0;
  };
  return <section ref={sectionRef} className="studio-gifts" aria-label="Paid Studio gift preview"
    data-demo-name={name} data-complete={finished}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <h4>{reviewHeading || `All 3 gifts included for ${name} with the paid version`}</h4>
    {staticPreview && downloadNotice && <p>{downloadNotice}</p>}
    {children}
    <div className="studio-gifts__preview-stack" role="group" aria-label="Three gift previews"
      onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()}>
      <div className="studio-gifts__gallery">
        <GiftCard enabled={staticPreview} kind="certificate">
        <button className="studio-gifts__thumbnail studio-gifts__thumbnail--certificate" type="button"
          aria-label="Enlarge certificate" onClick={event => open(event, 'certificate')}>
          <Certificate name={name} elapsed={displayElapsed} />
          <span className="studio-gifts__thumbnail-label">Enlarge certificate</span>
        </button>
        {staticPreview && <StudioGiftDownload key={`${giftRevision}-${name}-${downloadReady}-certificate`}
          kind="certificate" ready={downloadReady} name={name} unavailableNotice={downloadUnavailableNotice} />}
        </GiftCard>
        <GiftCard enabled={staticPreview} kind="letter">
        <button className="studio-gifts__thumbnail studio-gifts__thumbnail--letter" type="button"
          aria-label="Enlarge letter to read" onClick={event => open(event, 'letter')}>
           <Letter letter={displayLetter} elapsed={displayElapsed} />
          <span className="studio-gifts__thumbnail-label">Enlarge letter</span>
        </button>
        {staticPreview && <StudioGiftDownload key={`${giftRevision}-${name}-${downloadReady}-letter`}
          kind="letter" ready={downloadReady} name={name} letter={displayLetter} unavailableNotice={downloadUnavailableNotice} />}
        </GiftCard>
      </div>
      <GiftCard enabled={staticPreview} kind="picture">
      <button className="studio-gifts__thumbnail studio-gifts__thumbnail--picture" type="button"
        aria-label="Enlarge Santa’s Nice List picture" onClick={event => open(event, 'picture')}>
        <SantaPicture name={name} picture={picture} elapsed={displayElapsed}
          previousPicture={previousPicture} onDissolved={onDissolved} />
        <span className="studio-gifts__thumbnail-label">Enlarge Santa picture</span>
      </button>
      {staticPreview && <StudioGiftDownload key={`${giftRevision}-${name}-${downloadReady}-picture`}
        kind="picture" ready={downloadReady} name={name} picture={picture} unavailableNotice={downloadUnavailableNotice} />}
      </GiftCard>
    </div>
    <dialog ref={dialogRef} className={`studio-letter-dialog${view === 'letter' ? ' studio-letter-dialog--letter' : ''}`}
      aria-label={`${name}’s ${view || 'gift'} example`}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          changeGift(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      onCancel={() => dialogRef.current.close()}>
      <div className="studio-letter-dialog__toolbar">
        <div className="studio-letter-dialog__navigation" role="group" aria-label="Browse gift previews">
          <button type="button" aria-label="Previous gift" title="Previous gift" onClick={() => changeGift(-1)}>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next gift" title="Next gift" onClick={() => changeGift(1)}>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </div>
        <span className="studio-gifts__sr" role="status" aria-live="polite">
          {view ? `${view === 'picture' ? 'Santa picture' : view === 'letter' ? 'Santa letter' : 'Nice List certificate'}, ${giftViews.indexOf(view) + 1} of 3` : ''}
        </span>
        <button ref={closeRef} type="button" onClick={() => dialogRef.current.close()}>Close preview</button>
      </div>
      <div className="studio-letter-dialog__content" role="region" aria-label="Enlarged gift preview"
        tabIndex={0} onScroll={() => setReading(true)}>
        <div className={`studio-letter-dialog__document studio-letter-dialog__document--${view || 'picture'}`}
          onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()}>
          {view === 'certificate' ? <Certificate name={name} elapsed={duration} />
             : view === 'letter' ? <Letter letter={displayLetter} elapsed={duration} />
              : <SantaPicture name={name} picture={picture} elapsed={duration} />}
          <div className="studio-gifts__watermark" aria-hidden="true">
            {[0, 1, 2].map(row => <span key={row}>NORTH POLE PROPERTY</span>)}
          </div>
        </div>
      </div>
    </dialog>
  </section>;
}

export function useStudioGiftExample({ activeExampleName = null, previewName = null, allowExamples = true } = {}) {
  const [index, setIndex] = useState(0);
  const [pictureIndex, setPictureIndex] = useState(0);
  // Keep the outgoing artwork above the new picture across recipient remounts.
  // Fade it only after the replacement image has loaded, never through blank paper.
  const [previousPicture, setPreviousPicture] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    // Prepare the next static picture before the shared ten-second change.
    const next = new Image();
    next.src = santaPictures[(pictureIndex + 1) % santaPictures.length];
  }, [pictureIndex]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPreviousPicture(null);
    };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const activeName = allCertificateExamples.find(item => item.name === activeExampleName)?.name;
  // Gift demonstrations stay available during cooldown; audio permission is
  // separate. Only a real selection stops the example-name rotation.
  const name = previewName || (allowExamples && activeName) || studioGiftExampleNames[index];
  const nextExample = useCallback(() => {
    setPreviousPicture(reducedMotion ? null : santaPictures[pictureIndex]);
    if (!previewName) setIndex(value => (value + 1) % studioGiftExampleNames.length);
    setPictureIndex(value => (value + 1) % santaPictures.length);
  }, [previewName, allowExamples, pictureIndex, reducedMotion]);
  const finishDissolve = useCallback(() => setPreviousPicture(null), []);
  // Keep the audio name on stop when it belongs to the idle rotation.
  useEffect(() => {
    const next = studioGiftExampleNames.indexOf(activeName);
    if (next >= 0 && !previewName && allowExamples) setIndex(next);
  }, [activeName, previewName, allowExamples]);
  return { name, picture: santaPictures[pictureIndex], previousPicture,
    onDissolved: finishDissolve, activeAudio: Boolean(activeName && !previewName && allowExamples),
    reducedMotion, onNext: nextExample };
}

export function StudioGiftPreview({ example }) {
  const name = example.name || studioGiftExampleNames[0];
  return <GiftExample key={name} {...example} name={name} />;
}

export function StudioKeepsakePreview({ name, details = {}, variation, downloadReady = false,
  downloadNotice, giftRevision, downloadUnavailableNotice, children }) {
  const [localVariation] = useState(createStudioLetterVariation);
  const letter = createStudioLetter(name, () => 0.5, details, variation || localVariation);
  return <GiftExample
    name={name}
    picture={santaPictures[0]}
    previousPicture={null}
    onDissolved={() => {}}
    activeAudio={false}
    reducedMotion={false}
    onNext={() => {}}
    staticPreview
    suppliedLetter={letter}
    downloadReady={downloadReady}
    downloadNotice={downloadNotice}
    downloadUnavailableNotice={downloadUnavailableNotice}
    giftRevision={giftRevision}
    reviewHeading="Santa gifts"
    children={children}
  />;
}

export default function SantaStudioGifts(props) {
  const example = useStudioGiftExample(props);
  return <StudioGiftPreview example={example} />;
}
