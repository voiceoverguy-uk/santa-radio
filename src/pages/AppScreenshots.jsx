import { useEffect, useState } from 'react';
import './AppScreenshots.css';

export default function AppScreenshots({
  slides,
  heading = 'Current iOS app',
  regionLabel = 'Santa Radio current iOS app screenshots',
  imageType = 'screenshot',
  presentation,
  deviceStyle,
  maxWidth = 285,
}) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState({});
  const [failed, setFailed] = useState({});
  // Static during SSR and until the visitor's motion preference is known.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const artworkPresentation = presentation === 'artwork' || imageType !== 'screenshot';

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

  const rotating = slides.length > 1 && !reducedMotion && !hovered && !hidden;
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
      className={`app-screenshots ${artworkPresentation ? 'app-screenshots-artwork' : 'app-screenshots-device'}${slides[0].width > slides[0].height ? ' app-screenshots-landscape' : ''}${!artworkPresentation && deviceStyle === 'classic' ? ' app-screenshots-classic' : ''}`}
      role="region"
      aria-roledescription={slides.length > 1 ? 'carousel' : undefined}
      aria-label={regionLabel}
      style={{ '--app-screenshots-max-width': `${maxWidth}px` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        {!artworkPresentation && (
          <span className="app-phone-hardware" aria-hidden="true">
            <span className="app-phone-action" />
            <span className="app-phone-volume app-phone-volume-up" />
            <span className="app-phone-volume app-phone-volume-down" />
            <span className="app-phone-power" />
          </span>
        )}
      </div>
      {Object.keys(failed).length > 0 && <p role="status" className="app-screenshots-note">Some {imageType}s could not load. Please reload to try again.</p>}
    </figure>
  );
}
