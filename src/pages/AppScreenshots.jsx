import { useEffect, useState } from 'react';
import './AppScreenshots.css';

export default function AppScreenshots({
  slides,
  heading = 'Current iOS app',
  regionLabel = 'Santa Radio current iOS app screenshots',
  selectionLabel = 'Choose an iOS screenshot',
  imageType = 'screenshot',
  note = 'iOS screenshots only; the Amazon app’s appearance may differ.',
  maxWidth = 285,
}) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState({});
  const [failed, setFailed] = useState({});
  // Static during SSR and until the visitor's motion preference is known.
  const [paused, setPaused] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPaused(preference.matches);
    const onPreference = () => { if (preference.matches) setPaused(true); };
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    preference.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const rotating = !paused && !hovered && !focused && !hidden;
  useEffect(() => {
    const next = (active + 1) % slides.length;
    // Keep the current image until its successor has fully decoded.
    if (!rotating || !ready[active] || !ready[next]) return;
    const timer = window.setTimeout(() => setActive(next), 5000);
    return () => window.clearTimeout(timer);
  }, [active, ready, rotating, slides.length]);

  async function markReady(image, index) {
    try {
      await image.decode();
      setReady(previous => ({ ...previous, [index]: true }));
    } catch {
      setFailed(previous => ({ ...previous, [index]: true }));
    }
  }

  return (
    <figure
      className="app-screenshots"
      role="region"
      aria-roledescription="carousel"
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
        <div className="app-screenshots-stack" style={{ aspectRatio: `${slides[0].width} / ${slides[0].height}` }}>
          {slides.map((slide, index) => (
            <img
              key={slide.label}
              className={`app-screenshot-slide${active === index ? ' is-active' : ''}`}
              src={slide.image}
              width={slide.width}
              height={slide.height}
              alt={slide.alt}
              aria-hidden={active !== index}
              decoding="async"
              onLoad={event => markReady(event.currentTarget, index)}
              onError={() => setFailed(previous => ({ ...previous, [index]: true }))}
            />
          ))}
        </div>
      </div>
      <p className="app-screenshots-caption" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
        {slides[active].label} · {active + 1} of {slides.length}
      </p>
      <div className="app-screenshots-controls">
        <div className="app-screenshots-dots" role="group" aria-label={selectionLabel}>
          {slides.map((slide, index) => (
            <button
              key={slide.label}
              type="button"
              className="app-screenshots-dot"
              aria-label={`Show ${slide.label} ${imageType}`}
              aria-pressed={active === index}
              disabled={!ready[index]}
              onClick={() => setActive(index)}
            ><span aria-hidden="true" /></button>
          ))}
        </div>
        <button type="button" className="app-screenshots-toggle" onClick={() => setPaused(value => !value)}>
          {paused ? 'Resume slideshow' : 'Pause slideshow'}
        </button>
      </div>
      <p className="app-screenshots-note">{note}</p>
      {Object.keys(failed).length > 0 && <p role="status" className="app-screenshots-note">Some {imageType}s could not load. Please reload to try again.</p>}
    </figure>
  );
}
