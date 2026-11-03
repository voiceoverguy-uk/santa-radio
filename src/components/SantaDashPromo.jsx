import { useEffect, useRef, useState } from 'react';
import santaDashArtwork from '../assets/home/santa-dash-back-to-the-grotto.webp';
import santaDashWobblyBobArtwork from '../assets/home/santa-dash-wobbly-bob.webp';
import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import './SantaDashPromo.css';

const GAMEPLAY_URL = '/media/santa-dash-gameplay-v1.mp4';
const POSTER_URL = '/media/santa-dash-gameplay-poster.webp';
const APP_STORE_URL = 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397';
const INITIAL_REDUCED_MOTION = true;

function getReducedMotionPreference() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function SantaDashPromo() {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const playAttemptRef = useRef(0);
  const shouldPlayRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(INITIAL_REDUCED_MOTION);
  const [nearViewport, setNearViewport] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );
  const [userRequested, setUserRequested] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [sourceAttached, setSourceAttached] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const loadedRetryVersionRef = useRef(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = event => {
      setReducedMotion(event.matches);
      if (event.matches) setUserRequested(false);
    };
    setReducedMotion(preference.matches);
    if (preference.addEventListener) {
      preference.addEventListener('change', updatePreference);
      return () => preference.removeEventListener('change', updatePreference);
    }
    preference.addListener(updatePreference);
    return () => preference.removeListener(updatePreference);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    if (!('IntersectionObserver' in window)) {
      setNearViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    if (!('IntersectionObserver' in window)) {
      setInViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInViewport(entry.isIntersecting && entry.intersectionRatio > 0);
    }, { threshold: 0 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const shouldLoad = nearViewport && (!reducedMotion || userRequested);

  useEffect(() => {
    if (!shouldLoad || !videoRef.current) return;
    const video = videoRef.current;
    // React sets the muted property, but WebKit also relies on the reflected
    // muted attribute/defaultMuted for reliable inline silent autoplay.
    video.defaultMuted = true;
    video.muted = true;
    if (
      loadedRetryVersionRef.current === retryVersion &&
      video.getAttribute('src') === GAMEPLAY_URL
    ) {
      setSourceAttached(true);
      return;
    }
    video.src = GAMEPLAY_URL;
    video.load();
    loadedRetryVersionRef.current = retryVersion;
    setSourceAttached(true);
  }, [shouldLoad, retryVersion]);

  const wantsPlayback = !manuallyPaused &&
    !playBlocked &&
    !failed &&
    (!reducedMotion || userRequested);
  const shouldPlay = sourceAttached &&
    inViewport &&
    documentVisible &&
    wantsPlayback;
  shouldPlayRef.current = shouldPlay;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const attempt = ++playAttemptRef.current;
    if (!shouldPlay) {
      video.pause();
      setPlaying(false);
      return undefined;
    }

    let playPromise;
    try {
      playPromise = video.play();
    } catch {
      setPlaying(false);
      setPlayBlocked(true);
      return undefined;
    }
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        if (playAttemptRef.current === attempt && shouldPlayRef.current) {
          setPlaying(true);
        } else if (!shouldPlayRef.current) {
          video.pause();
        }
      }).catch(error => {
        if (playAttemptRef.current !== attempt || error?.name === 'AbortError') return;
        setPlaying(false);
        setPlayBlocked(true);
      });
    }
    return () => {
      if (playAttemptRef.current === attempt) playAttemptRef.current += 1;
    };
  }, [shouldPlay, retryVersion]);

  const pauseButtonMeansPause = wantsPlayback;
  const status = failed
    ? 'Gameplay video unavailable. Showing the still preview.'
    : playing
      ? 'Gameplay is playing.'
      : playBlocked
        ? 'Gameplay did not start. Select Play to try again.'
        : reducedMotion && !userRequested
          ? 'Still preview shown. Select Play to start the video.'
          : manuallyPaused
            ? 'Gameplay paused.'
            : sourceAttached && inViewport
              ? 'Loading gameplay video.'
              : 'Gameplay preview ready.';
  const previewState = failed
    ? 'failed'
    : playing
      ? 'playing'
      : playBlocked
        ? 'play-blocked'
        : manuallyPaused
          ? 'manually-paused'
          : reducedMotion && !userRequested
            ? 'reduced-motion-still'
            : sourceAttached && inViewport
              ? 'loading'
              : 'ready';

  const handlePlaybackToggle = () => {
    if (failed) {
      setFailed(false);
      setPlayBlocked(false);
      setManuallyPaused(false);
      setUserRequested(true);
      setRetryVersion(version => version + 1);
      return;
    }
    if (pauseButtonMeansPause) {
      setManuallyPaused(true);
      return;
    }
    setManuallyPaused(false);
    setPlayBlocked(false);
    setUserRequested(true);
  };

  return (
    <section
      ref={sectionRef}
      className={`santa-dash-promo${playing ? ' santa-dash-promo--artwork-playing' : ''}`}
      data-preview-state={previewState}
      aria-labelledby="santa-dash-promo-title"
    >
      <div className="santa-dash-promo__inner">
        <HomepageSectionHeading
          eyebrow="A festive rooftop adventure"
          title="Santa Dash — Back to the Grotto"
          subtitle="Race across snowy rooftops with Santa."
          titleId="santa-dash-promo-title"
          className="santa-dash-promo__heading"
          eyebrowClassName="santa-dash-promo__eyebrow"
          titleClassName="santa-dash-promo__title"
          subtitleClassName="santa-dash-promo__subtitle"
        />
        <div className="santa-dash-promo__visual">
          <a
            className="santa-dash-promo__artwork-link"
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Santa Dash — Back to the Grotto on the App Store (opens in a new tab)"
          >
            <span className="santa-dash-promo__artwork-stage">
              <img
                className="santa-dash-promo__artwork santa-dash-promo__artwork--first"
                src={santaDashArtwork}
                width="1600"
                height="554"
                alt="Santa Dash — Back to the Grotto: Santa leaps across snowy rooftops to collect mince pies. Play on iPhone and iPad."
                loading="lazy"
              />
              <img
                className="santa-dash-promo__artwork santa-dash-promo__artwork--second"
                src={santaDashWobblyBobArtwork}
                width="1600"
                height="555"
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            </span>
          </a>
          <div className="santa-dash-promo__handset">
            <div className="santa-dash-promo__handset-screen">
              <video
                ref={videoRef}
                className="santa-dash-promo__video"
                muted
                loop
                playsInline
                preload="none"
                aria-hidden="true"
                onPlaying={() => {
                  if (shouldPlayRef.current) setPlaying(true);
                  else videoRef.current?.pause();
                }}
                onPause={() => setPlaying(false)}
                onError={() => {
                  setPlaying(false);
                  setFailed(true);
                  setPlayBlocked(true);
                }}
              />
              <img
                className={`santa-dash-promo__poster${playing ? ' is-hidden' : ''}`}
                src={POSTER_URL}
                alt=""
                aria-hidden="true"
                draggable="false"
              />
            </div>
            <span className="santa-dash-promo__hardware" aria-hidden="true">
              <i className="santa-dash-promo__speaker" />
              <i className="santa-dash-promo__camera" />
            </span>
          </div>
        </div>
        <div className="santa-dash-promo__controls">
          <button
            className="santa-dash-promo__playback"
            type="button"
            onClick={handlePlaybackToggle}
            aria-label={failed
              ? 'Retry Santa Dash gameplay video'
              : `${pauseButtonMeansPause ? 'Pause' : 'Play'} Santa Dash gameplay video`}
            aria-pressed={pauseButtonMeansPause && playing}
          >
            <span className="santa-dash-promo__playback-icon" aria-hidden="true">
              {pauseButtonMeansPause ? 'Ⅱ' : '▶'}
            </span>
            <span>{failed ? 'Retry preview' : pauseButtonMeansPause ? 'Pause preview' : 'Play preview'}</span>
          </button>
          <p className="santa-dash-promo__status" role="status" aria-live="polite">{status}</p>
        </div>
        <a
          className="santa-dash-promo__download"
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download Santa Dash for iPhone and iPad (opens in a new tab)"
        >
          Download Santa Dash for iPhone and iPad <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
