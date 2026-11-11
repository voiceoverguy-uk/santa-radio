import { useCallback, useEffect, useRef, useState } from 'react';
import AppScreenshotImage from './AppScreenshotImage.jsx';
import AppScreenshotVideo from './AppScreenshotVideo.jsx';
import './AppScreenshots.css';

const santaRadioTabs = ['Radio', 'Tracker', 'MugShots', 'Artists', 'Games'];

export default function AppScreenshots({
  slides,
  heading = 'Current iOS app',
  regionLabel = 'Santa Radio current iOS app screenshots',
  imageType = 'screenshot',
  presentation,
  deviceStyle,
  maxWidth = 285,
  interactiveMode,
  randomOrder = false,
  liveClock,
}) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState({});
  const [failed, setFailed] = useState({});
  const [pendingSelection, setPendingSelection] = useState(null);
  const [selectionFailure, setSelectionFailure] = useState(null);
  // Static during SSR and until the visitor's motion preference is known.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [completedVideo, setCompletedVideo] = useState(null);
  const [videoFailed, setVideoFailed] = useState({});
  const figureRef = useRef(null);
  const mixedMedia = slides.some(slide => slide.video);
  const santaRadioPreview = interactiveMode === 'santa-radio';
  const voicemailPreview = deviceStyle === 'voicemail';
  const darkLandscapeDevice = deviceStyle === 'dark-landscape';
  const artworkPresentation = !darkLandscapeDevice && (presentation === 'artwork' || imageType !== 'screenshot');

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setHidden(document.hidden);
    onPreference();
    onVisibility();
    preference.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!mixedMedia || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), { threshold: 0 });
    observer.observe(figureRef.current);
    return () => observer.disconnect();
  }, [mixedMedia]);

  useEffect(() => {
    if (mixedMedia && reducedMotion) setActive(0);
  }, [mixedMedia, reducedMotion]);

  const rotating = slides.length > 1 && autoplayEnabled && !reducedMotion && !hovered && !focused && !hidden && (!mixedMedia || inViewport);
  const advance = useCallback(() => {
    const candidates = randomOrder
      ? slides.map((_, index) => index).filter(index => index !== active && ready[index] && !failed[index] && !videoFailed[index])
      : [(active + 1) % slides.length].filter(index => ready[index]);
    if (candidates.length) {
      setCompletedVideo(null);
      setActive(candidates[randomOrder ? Math.floor(Math.random() * candidates.length) : 0]);
    }
  }, [active, ready, failed, videoFailed, randomOrder, slides]);
  const failVideo = useCallback(() => {
    setVideoFailed(previous => ({ ...previous, [active]: true }));
  }, [active]);
  useEffect(() => {
    // Keep the current image until its successor has fully decoded.
    if (!rotating || !ready[active]) return;
    if (slides[active].video && !videoFailed[active]) {
      if (completedVideo === active) advance();
      return;
    }
    const candidates = randomOrder
      ? slides.map((_, index) => index).filter(index => index !== active && ready[index] && !failed[index] && !videoFailed[index])
      : [(active + 1) % slides.length].filter(index => ready[index]);
    if (!candidates.length) return;
    const timer = window.setTimeout(() => {
      advance();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [active, ready, failed, rotating, slides, randomOrder, advance, videoFailed, completedVideo]);

  const markReady = useCallback(index => {
    setReady(previous => previous[index] ? previous : { ...previous, [index]: true });
  }, []);
  const markFailed = useCallback(index => {
    setFailed(previous => previous[index] ? previous : { ...previous, [index]: true });
  }, []);
  useEffect(() => {
    if (pendingSelection === null) return;
    if (ready[pendingSelection]) {
      setActive(pendingSelection);
      setPendingSelection(null);
      setSelectionFailure(null);
    } else if (failed[pendingSelection]) {
      setSelectionFailure(pendingSelection);
      setPendingSelection(null);
    }
  }, [failed, pendingSelection, ready]);
  const selectScreen = index => {
    if (!santaRadioPreview) {
      setActive(index);
      return;
    }
    setAutoplayEnabled(false);
    setSelectionFailure(null);
    if (ready[index]) {
      setActive(index);
      setPendingSelection(null);
    } else if (failed[index]) {
      setPendingSelection(null);
      setSelectionFailure(index);
    } else {
      setPendingSelection(index);
    }
  };

  return (
    <figure
      ref={figureRef}
      data-mixed-media={mixedMedia || undefined}
      className={`app-screenshots ${artworkPresentation ? 'app-screenshots-artwork' : 'app-screenshots-device'}${slides[0].width > slides[0].height ? ' app-screenshots-landscape' : ''}${!artworkPresentation && deviceStyle === 'classic' ? ' app-screenshots-classic' : ''}${darkLandscapeDevice ? ' app-screenshots-dark-landscape' : ''}${santaRadioPreview ? ' app-screenshots-santa-radio' : ''}${voicemailPreview ? ' app-screenshots-voicemail' : ''}`}
      role="region"
      aria-roledescription={slides.length > 1 ? 'carousel' : undefined}
      aria-label={regionLabel}
      style={{ '--app-screenshots-max-width': `${maxWidth}px` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <figcaption className="app-screenshots-heading">{heading}</figcaption>
      <div className="app-screenshots-frame">
        {(santaRadioPreview || randomOrder) && !reducedMotion && (
          <button
            type="button"
            className="santa-radio-autoplay"
            aria-label={autoplayEnabled ? 'Pause automatic screen previews' : 'Resume automatic screen previews'}
            aria-pressed={autoplayEnabled}
            onClick={() => setAutoplayEnabled(value => !value)}
          >
            <span aria-hidden="true">{autoplayEnabled ? 'Ⅱ' : '▶'}</span>
          </button>
        )}
        <div className="app-screenshots-stack" style={{ aspectRatio: `${slides[0].width} / ${slides[0].height}` }}>
          {slides.map((slide, index) => slide.video ? (
            <div key={`${slide.label}-${index}`}
              className={`app-screenshot-slide${active === index ? ' is-active' : ''}`}
              aria-hidden={active !== index}>
              <AppScreenshotImage slide={slide} index={index} onReady={markReady} onFailure={markFailed}
                className="app-screenshot-video-poster" aria-hidden={active === index && !reducedMotion && !videoFailed[index]} />
              {active === index && !reducedMotion && !videoFailed[index] && (
                <AppScreenshotVideo slide={slide} playing={rotating}
                  onComplete={() => setCompletedVideo(index)} onFailure={failVideo} />
              )}
            </div>
          ) : (
            <AppScreenshotImage
              key={`${slide.label}-${index}`}
              className={`app-screenshot-slide${active === index ? ' is-active' : ''}`}
              slide={slide}
              index={index}
              aria-hidden={active !== index}
              onReady={markReady}
              onFailure={markFailed}
            />
          ))}
          {liveClock && <AppPreviewClock background={liveClock} />}
          {santaRadioPreview && active < santaRadioTabs.length && (
            <nav className="santa-radio-screen-hotspots" aria-label="Preview app tab screens">
              {santaRadioTabs.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`santa-radio-hotspot${active === index ? ' is-selected' : ''}`}
                  aria-label={`Preview ${label} screen`}
                  aria-pressed={active === index}
                  aria-busy={pendingSelection === index}
                  onClick={() => selectScreen(index)}
                />
              ))}
            </nav>
          )}
          {santaRadioPreview && active === 5 && (
            <button
              type="button"
              className="santa-radio-welcome-hotspot"
              aria-label="Continue to Santa Radio preview"
              onClick={() => selectScreen(0)}
            />
          )}
        </div>
        {!artworkPresentation && (
          <span className="app-phone-hardware" aria-hidden="true">
            <span className="app-phone-action" />
            <span className="app-phone-volume app-phone-volume-up" />
            <span className="app-phone-volume app-phone-volume-down" />
            <span className="app-phone-power" />
          </span>
        )}
      </div>
      {voicemailPreview && (
        <div className="app-voicemail-controls">
          <span aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
            {slides[active].label} · {active + 1} of {slides.length}
          </span>
          {!reducedMotion && (
            <button
              type="button"
              className="app-voicemail-autoplay"
              aria-label={autoplayEnabled ? 'Pause automatic screen previews' : 'Resume automatic screen previews'}
              aria-pressed={autoplayEnabled}
              onClick={() => setAutoplayEnabled(value => !value)}
            >
              {autoplayEnabled ? 'Pause previews' : 'Resume previews'}
            </button>
          )}
        </div>
      )}
      {santaRadioPreview && (
        <div className="santa-radio-preview-feedback-only">
          <div className="santa-radio-preview-status" aria-live="polite">
            <span className="santa-radio-current-screen">{slides[active]?.label}</span>
            {pendingSelection !== null && (
              <span className="santa-radio-preview-feedback" role="status">
                Loading {slides[pendingSelection]?.label} preview…
              </span>
            )}
            {selectionFailure !== null && (
              <span className="santa-radio-preview-feedback" role="status">
                Could not load {slides[selectionFailure]?.label} preview. Still showing {slides[active]?.label}.
              </span>
            )}
          </div>
        </div>
      )}
      {Object.keys(failed).length > 0 && <p role="status" className="app-screenshots-note">Some {imageType}s could not load. Please reload to try again.</p>}
      {Object.keys(videoFailed).length > 0 && <p role="status" className="app-screenshots-note">Gameplay could not play. Still previews remain available.</p>}
    </figure>
  );
}

// Decorative screenshot clock: local to the visitor, never announced repeatedly.
function AppPreviewClock({ background }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    let timer;
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      timer = window.setTimeout(update, 60000 - Date.now() % 60000);
    };
    update();
    return () => window.clearTimeout(timer);
  }, []);
  return <span className="app-preview-clock" style={{ background }} aria-hidden="true">{time}</span>;
}
