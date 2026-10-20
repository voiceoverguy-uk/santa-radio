import { useState } from 'react';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import ExternalMediaConsent from './ExternalMediaConsent.jsx';
import './YouTubeSection.css';

export default function YouTubeSection() {
  const [paused, setPaused] = useState(false);
  const { mediaAllowed } = useCookieConsent();
  return <section className="youtube-section section-dark">
    <div className="container">
      <p className="eyebrow" style={{ textAlign: 'center' }}>A window to the North Pole</p>
      <h2 className="section-title youtube-title">Watch Santa Radio Live<br />Christmas Music 24/7</h2>
      <div className="tv-frame"><div className={`tv-screen${mediaAllowed ? '' : ' needs-media-permission'}`}>
        <ExternalMediaConsent provider="YouTube" href="https://www.youtube.com/watch?v=TwviLAwFpgo">
        {!paused ? <iframe width="100%" height="100%" src="https://www.youtube.com/embed/TwviLAwFpgo?autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1" title="Santa Radio Live Stream — always muted" allow="autoplay; encrypted-media" tabIndex={-1} inert="" style={{ border: 0, pointerEvents: 'none' }} /> :
          <div className="video-preview"><span>Live video paused</span></div>}
        </ExternalMediaConsent>
      </div></div>
      <p className="video-disclosure">
        {mediaAllowed && <><button className="video-motion-toggle" onClick={() => setPaused(value => !value)}>{paused ? 'Resume muted video' : 'Pause video'}</button><br /></>}
        YouTube loads only after you enable external media, always muted here. Use Listen Live for sound.
        {' '}<a href="https://www.youtube.com/watch?v=TwviLAwFpgo" target="_blank" rel="noopener noreferrer">Watch directly on YouTube</a>.
      </p>
    </div>
  </section>;
}
