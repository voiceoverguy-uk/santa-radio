import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import ExternalMediaConsent from './ExternalMediaConsent.jsx';
import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import './YouTubeSection.css';

export default function YouTubeSection() {
  const { ready, homepageTVAllowed } = useCookieConsent();
  return <section className="youtube-section section-dark">
    <div className="container">
      <HomepageSectionHeading
        eyebrow="A window to the North Pole"
        title="Best of the North Pole Webcams"
        subtitle="Highlights of the webcams at the North Pole. Keep checking back!"
        className="youtube-section-heading"
      />
      <div className="tv-frame"><div aria-busy={!ready} className={`tv-screen${ready && !homepageTVAllowed ? ' needs-media-permission' : ''}`}>
        {ready && (homepageTVAllowed
          ? <iframe width="100%" height="100%" src="https://www.youtube.com/embed/mMrHniQJNCM?si=O7nNcINykyWwgyXC&autoplay=0&mute=1&controls=1&playsinline=1" title="North Pole webcams — tap play to watch" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          : <ExternalMediaConsent provider="YouTube" href="https://www.youtube.com/watch?v=mMrHniQJNCM" />)}
      </div></div>
      {ready && homepageTVAllowed && <p className="webcam-play-help">Tap play to watch. Starts muted. <a href="https://www.youtube.com/watch?v=mMrHniQJNCM" target="_blank" rel="noopener noreferrer">Open on YouTube (new tab)</a></p>}
    </div>
  </section>;
}
