import { useCallback, useEffect, useRef, useState } from 'react';
import { studioGiftExampleNames, allCertificateExamples } from '../lib/santaCertificateExamples.js';
import { createStudioLetter, CERTIFICATE_WRITE_MS, LETTER_CHARACTER_MS,
  SIGNATURE_WRITE_MS, GIFT_EXAMPLE_INTERVAL_MS, letterBodyDuration, letterDuration,
  createStudioPromotionalSampleLetter, studioPromotionalSampleProfiles,
  createStudioLetterVariation } from '../lib/santaStudioLetter.js';
import './SantaStudioGifts.css';
import { studioLetterLayout } from '../lib/studioLetterLayout.js';
import { LETTER_WIDTH, LETTER_HEIGHT } from '../lib/studioLetterLayout.js';
import SantaPictureName from './SantaPictureName.jsx';
import CertificateName from './CertificateName.jsx';
import StudioGiftDownload from './StudioGiftDownload.jsx';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const giftViews = ['certificate', 'letter', 'picture'];
const promotionGiftViews = ['picture', 'letter', 'certificate'];

function SampleWatermark() {
  return <div className="studio-gifts__watermark" aria-hidden="true">
    <span>Preview</span>
  </div>;
}

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
  if (!letter) return <article className="studio-letter__paper" aria-label="Preparing Santa’s letter" />;
  const bodyCount = Math.floor((elapsed - CERTIFICATE_WRITE_MS) / LETTER_CHARACTER_MS);
  const signatureProgress = Math.max(0, Math.min(1,
    (elapsed - CERTIFICATE_WRITE_MS - letterBodyDuration(letter)) / SIGNATURE_WRITE_MS));
  let offset = 0;
  return <article className="studio-letter__paper" aria-label={`Santa’s letter example for ${letter.name}`}
    data-letter-ready="true" data-letter-compact={letter.compact ? 'true' : 'false'}
    style={{
      '--letter-body': `${studioLetterLayout.body * 100}cqw`,
      '--letter-leading': letter.browserLayout.leading,
      '--letter-gap': `${letter.browserLayout.paragraphGap}em`,
      '--letter-inset': `${studioLetterLayout.inset * 100}%`,
      '--letter-top': `${studioLetterLayout.top * 100}%`,
      '--letter-closing-inset': `${(studioLetterLayout.closingInset - studioLetterLayout.inset)
        / (1 - studioLetterLayout.inset * 2) * 100}%`,
    }}>
    <div className="studio-gifts__sr">
      {letter.paragraphs.map((text, index) => <p key={index}>{text}</p>)}
      <p>Santa Claus</p>{letter.closing.map(text => <p key={text}>{text}</p>)}
    </div>
    <svg className="studio-letter__canvas" viewBox={`0 0 ${LETTER_WIDTH} ${LETTER_HEIGHT}`} aria-hidden="true">
    <foreignObject x={LETTER_WIDTH * studioLetterLayout.inset} y={LETTER_HEIGHT * studioLetterLayout.top}
      width={LETTER_WIDTH * (1 - 2 * studioLetterLayout.inset)} height={LETTER_HEIGHT}>
    <div className="studio-letter__text" style={{ fontSize: LETTER_WIDTH * studioLetterLayout.body }}>
      {letter.paragraphs.map((text, index) => {
        const count = bodyCount - offset;
        offset += text.length;
        return <p key={index}><WrittenText text={text} count={count} /></p>;
      })}
      <div className="studio-letter__signature" style={{ fontSize: LETTER_WIDTH * studioLetterLayout.signature }}>
        <ScriptReveal progress={signatureProgress}>Santa Claus</ScriptReveal>
      </div>
      <div className={`studio-letter__closing${signatureProgress < 1 ? ' studio-writing-hidden' : ''}`}>
        {letter.closing.map(text => <p key={text}>{text}</p>)}
      </div>
    </div>
    </foreignObject>
    </svg>
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
  downloadNotice = null, giftRevision = '', downloadUnavailableNotice, variant = null, children,
  onDownloadRequested, onGiftPreparing, requestedGifts, onPreviewOpen, sampleProfile = null }) {
  const promotion = variant === 'promotion' && !staticPreview;
  const views = promotion ? promotionGiftViews : giftViews;
  // Deterministic SSR; randomise only once after mounting in the browser.
  const createLetter = () => sampleProfile
    ? createStudioPromotionalSampleLetter(name, sampleProfile, () => 0.5)
    : createStudioLetter(name, () => 0.5);
  const [letter, setLetter] = useState(() => suppliedLetter || createLetter());
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
  const rawLetter = staticPreview && suppliedLetter ? suppliedLetter : letter;
  const letterKey = JSON.stringify(rawLetter);
  const [prepared, setPrepared] = useState(null);
  const [letterError, setLetterError] = useState(null);
  const [fitAttempt, setFitAttempt] = useState(0);
  const displayLetter = prepared?.key === letterKey ? prepared.letter : null;
  useEffect(() => {
    let cancelled = false;
    setLetterError(null);
    import('../lib/prepareStudioLetter.js').then(({ prepareStudioLetter }) => prepareStudioLetter(rawLetter))
      .then(result => { if (!cancelled) setPrepared({ key: letterKey, letter: result }); })
      .catch(() => { if (!cancelled) setLetterError('This complete letter could not be fitted safely. Please retry the letter preview; your audio and other gifts are unaffected.'); });
    return () => { cancelled = true; };
  }, [letterKey, fitAttempt]);
  const duration = letterDuration(displayLetter || rawLetter);
  const displayElapsed = staticPreview || reducedMotion ? duration : elapsed;
  const finished = displayElapsed >= duration;

  useEffect(() => { if (!staticPreview) setLetter(createLetter()); }, [name, staticPreview, sampleProfile]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    // Keep the shared recipient/artwork rotation alive while mobile gifts are
    // collapsed. The disclosure remains visible even when its content is not.
    observer.observe(sectionRef.current.closest('.santa-studio-promotion__gifts') || sectionRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (finished || !visible || !displayLetter) return undefined;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      setElapsed(value => Math.min(duration, value + delta));
    }, 40);
    return () => clearInterval(timer);
  }, [finished, visible, duration, Boolean(displayLetter)]);
  useEffect(() => {
    if (staticPreview || activeAudio || reducedMotion || !visible || !displayLetter || hovered || focused || reading || view) return undefined;
    // One shared name drives both documents. Writing completes within this cycle.
    const timer = setTimeout(onNext, GIFT_EXAMPLE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [staticPreview, activeAudio, reducedMotion, visible, Boolean(displayLetter), hovered, focused, reading, view, onNext, picture]);
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
    onPreviewOpen?.();
    setView(kind);
  };
  const changeGift = direction => {
    setView(current => views[(views.indexOf(current) + direction + views.length) % views.length]);
    const content = dialogRef.current?.querySelector('.studio-letter-dialog__content');
    if (content) content.scrollTop = content.scrollLeft = 0;
  };
  const renderGift = kind => <GiftCard enabled={staticPreview || promotion} kind={kind}>
    <button className={`studio-gifts__thumbnail studio-gifts__thumbnail--${kind}`} type="button"
      aria-label={kind === 'certificate' ? 'Enlarge certificate'
        : kind === 'letter' ? 'Enlarge letter to read' : 'Enlarge Santa’s Nice List picture'}
      disabled={kind === 'letter' && !displayLetter}
      onClick={event => open(event, kind)}>
      <div className="studio-gifts__thumbnail-artwork">
        {kind === 'certificate' ? <Certificate name={name} elapsed={displayElapsed} />
          : kind === 'letter' ? <Letter letter={displayLetter} elapsed={displayElapsed} />
            : <SantaPicture name={name} picture={picture} elapsed={displayElapsed}
              previousPicture={previousPicture} onDissolved={onDissolved} />}
        <SampleWatermark />
      </div>
      <span className="studio-gifts__thumbnail-label">
        {promotion ? (kind === 'picture' ? 'Santa picture included' : kind === 'letter' ? 'Letter included' : 'Certificate included')
          : kind === 'picture' ? 'Enlarge Santa picture' : `Enlarge ${kind}`}
      </span>
    </button>
    {staticPreview && <StudioGiftDownload key={`${giftRevision}-${name}-${downloadReady}-${kind}`}
      kind={kind} ready={downloadReady && (kind !== 'letter' || Boolean(displayLetter))} name={name} letter={displayLetter}
      requested={requestedGifts?.[kind]}
      onDownloadRequested={onDownloadRequested} onPreparing={onGiftPreparing}
      picture={picture} unavailableNotice={downloadUnavailableNotice} />}
  </GiftCard>;
  return <section ref={sectionRef} className="studio-gifts" aria-label="Paid Studio gift preview"
    data-demo-name={name} data-sample-profile={sampleProfile ? name : undefined} data-complete={finished}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {!promotion && <h4>{reviewHeading || `All 3 gifts included for ${name} with the paid version`}</h4>}
    {staticPreview && downloadNotice && <p>{downloadNotice}</p>}
    {!displayLetter && !letterError && <p className="studio-gifts__sr" role="status">Preparing the complete letter layout…</p>}
    {letterError && <p role="alert">{letterError} <button type="button"
      onClick={() => setFitAttempt(value => value + 1)}>Retry letter preview</button></p>}
    {children}
    <div className={`studio-gifts__preview-stack${staticPreview ? ' studio-gifts__preview-stack--review' : ''}${promotion ? ' studio-gifts__preview-stack--promotion' : ''}`}
      role="group" aria-label="Three gift previews"
      onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()}>
      {staticPreview ? <div className="studio-gifts__review-layout">
        <div className="studio-gifts__review-column studio-gifts__review-column--side">
          {renderGift('certificate')}
          {renderGift('picture')}
        </div>
        <div className="studio-gifts__review-column studio-gifts__review-column--letter">
          {renderGift('letter')}
        </div>
      </div> : promotion ? <div className="studio-gifts__promo-layout">
        <div className="studio-gifts__promo-pair">
          {renderGift('picture')}
          {renderGift('letter')}
        </div>
        {renderGift('certificate')}
      </div> : <>
        <div className="studio-gifts__gallery">
          {renderGift('certificate')}
          {renderGift('letter')}
        </div>
        {renderGift('picture')}
      </>}
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
          {view ? `${view === 'picture' ? 'Santa picture' : view === 'letter' ? 'Santa letter' : 'Nice List certificate'}, ${views.indexOf(view) + 1} of 3` : ''}
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
          <SampleWatermark />
        </div>
      </div>
    </dialog>
  </section>;
}

export function useStudioGiftExample({
  activeExampleName = null, paidExampleName = null, previewName = null, allowExamples = true,
} = {}) {
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
  const activeName = allCertificateExamples.find(item =>
    item.name === (paidExampleName || activeExampleName))?.name;
  // Gift demonstrations stay available during cooldown; audio permission is
  // separate. Only a real selection stops the example-name rotation.
  const name = previewName || (allowExamples && activeName) || studioGiftExampleNames[index];
  const sampleProfile = !previewName && allowExamples && paidExampleName
    ? studioPromotionalSampleProfiles[paidExampleName] || null : null;
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
  return { name, picture: santaPictures[pictureIndex], previousPicture, sampleProfile,
    onDissolved: finishDissolve, activeAudio: Boolean(activeName && !previewName && allowExamples),
    reducedMotion, onNext: nextExample };
}

export function StudioGiftPreview({ example, variant = null, onPreviewOpen }) {
  const name = example.name || studioGiftExampleNames[0];
  return <GiftExample key={`${name}-${example.sampleProfile ? 'sample' : 'example'}`}
    {...example} name={name} variant={variant} onPreviewOpen={onPreviewOpen} />;
}

export function StudioKeepsakePreview({ name, details = {}, variation, downloadReady = false,
  downloadNotice, giftRevision, downloadUnavailableNotice, children, onDownloadRequested, onGiftPreparing, requestedGifts }) {
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
    requestedGifts={requestedGifts}
    onDownloadRequested={onDownloadRequested} onGiftPreparing={onGiftPreparing}
    reviewHeading="Santa gifts"
    children={children}
  />;
}

export default function SantaStudioGifts(props) {
  const example = useStudioGiftExample(props);
  return <StudioGiftPreview example={example} />;
}
