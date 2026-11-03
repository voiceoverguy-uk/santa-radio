import { useCallback, useEffect, useState } from 'react';
import AppScreenshotImage from './AppScreenshotImage.jsx';
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
  const santaRadioPreview = interactiveMode === 'santa-radio';
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

  const rotating = slides.length > 1 && autoplayEnabled && !reducedMotion && !hovered && !focused && !hidden;
  useEffect(() => {
    const next = (active + 1) % slides.length;
    // Keep the current image until its successor has fully decoded.
    if (!rotating || !ready[active] || !ready[next]) return;
    const timer = window.setTimeout(() => setActive(next), 5000);
    return () => window.clearTimeout(timer);
  }, [active, ready, rotating, slides.length]);

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
      className={`app-screenshots ${artworkPresentation ? 'app-screenshots-artwork' : 'app-screenshots-device'}${slides[0].width > slides[0].height ? ' app-screenshots-landscape' : ''}${!artworkPresentation && deviceStyle === 'classic' ? ' app-screenshots-classic' : ''}${darkLandscapeDevice ? ' app-screenshots-dark-landscape' : ''}${santaRadioPreview ? ' app-screenshots-santa-radio' : ''}`}
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
        {santaRadioPreview && !reducedMotion && (
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
          {slides.map((slide, index) => (
            <AppScreenshotImage
              key={slide.label}
              className={`app-screenshot-slide${active === index ? ' is-active' : ''}`}
              slide={slide}
              index={index}
              aria-hidden={active !== index}
              onReady={markReady}
              onFailure={markFailed}
            />
          ))}
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
    </figure>
  );
}
