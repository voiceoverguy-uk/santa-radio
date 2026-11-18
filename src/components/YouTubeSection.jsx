import { useEffect, useRef, useState } from 'react';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import ExternalMediaConsent from './ExternalMediaConsent.jsx';
import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import './YouTubeSection.css';

export default function YouTubeSection() {
  const { ready, homepageTVAllowed } = useCookieConsent();
  const screenRef = useRef(null);
  const [desktop, setDesktop] = useState(false);
  const [enteredView, setEnteredView] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEnteredView(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    if (screenRef.current) observer.observe(screenRef.current);
    return () => observer.disconnect();
  }, []);
  const autoplay = desktop && enteredView;
  return <section className="youtube-section section-dark">
    <div className="container">
      <HomepageSectionHeading
        eyebrow="A window to the North Pole"
        title="Best of the North Pole Webcams"
        subtitle="Highlights of the webcams at the North Pole. Keep checking back!"
        className="youtube-section-heading"
      />
      <div className="tv-frame"><div ref={screenRef} aria-busy={!ready} className={`tv-screen${ready && !homepageTVAllowed ? ' needs-media-permission' : ''}`}>
        {ready && (homepageTVAllowed
          ? <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/mMrHniQJNCM?si=O7nNcINykyWwgyXC&autoplay=${autoplay ? 1 : 0}&mute=1&controls=1&playsinline=1`} title="North Pole webcams" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          : <ExternalMediaConsent provider="YouTube" href="https://www.youtube.com/watch?v=mMrHniQJNCM" />)}
      </div></div>
      {ready && homepageTVAllowed && <p className="webcam-play-help">{desktop ? "Plays automatically on desktop. Starts muted." : "Tap play to watch. Starts muted."} <a href="https://www.youtube.com/watch?v=mMrHniQJNCM" target="_blank" rel="noopener noreferrer">Open on YouTube (new tab)</a></p>}
    </div>
  </section>;
}
