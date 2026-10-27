import { useState } from 'react';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import ExternalMediaConsent from './ExternalMediaConsent.jsx';
import './YouTubeSection.css';

export default function YouTubeSection() {
  const [paused, setPaused] = useState(false);
  const { ready, homepageTVAllowed } = useCookieConsent();
  return <section className="youtube-section section-dark">
    <div className="container">
      <p className="eyebrow" style={{ textAlign: 'center' }}>A window to the North Pole</p>
      <h2 className="section-title youtube-title">Watch Santa Radio Live<br />Christmas Music 24/7</h2>
      {ready && homepageTVAllowed && <button className="video-motion-toggle" onClick={() => setPaused(value => !value)}>
        {paused ? 'Resume muted video' : 'Pause video'}
      </button>}
      <div className="tv-frame"><div aria-busy={!ready} className={`tv-screen${ready && !homepageTVAllowed ? ' needs-media-permission' : ''}`}>
        {ready && (homepageTVAllowed
          ? (!paused ? <iframe width="100%" height="100%" src="https://www.youtube.com/embed/mMrHniQJNCM?si=O7nNcINykyWwgyXC&autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1&fs=0" title="Santa Radio Live Stream — always muted" allow="autoplay; encrypted-media" tabIndex={-1} inert="" style={{ border: 0, pointerEvents: 'none' }} /> :
            <div className="video-preview"><span>Live video paused</span></div>)
          : <ExternalMediaConsent provider="YouTube" href="https://www.youtube.com/watch?v=mMrHniQJNCM" />)}
      </div></div>
    </div>
  </section>;
}
