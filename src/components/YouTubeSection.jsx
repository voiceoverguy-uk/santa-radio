import { useState } from 'react';
import './YouTubeSection.css';

export default function YouTubeSection() {
  const [paused, setPaused] = useState(false);
  return <section className="youtube-section section-dark">
    <div className="container">
      <p className="eyebrow" style={{ textAlign: 'center' }}>A window to the North Pole</p>
      <h2 className="section-title youtube-title">Watch Santa Radio Live<br />Christmas Music 24/7</h2>
      <div className="tv-frame"><div className="tv-screen">
        {!paused ? <iframe width="100%" height="100%" src="https://www.youtube.com/embed/TwviLAwFpgo?autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1" title="Santa Radio Live Stream — always muted" allow="autoplay; encrypted-media" tabIndex={-1} inert="" style={{ border: 0, pointerEvents: 'none' }} /> :
          <div className="video-preview"><span>Live video paused</span></div>}
      </div></div>
      <p className="video-disclosure">
        <button className="video-motion-toggle" onClick={() => setPaused(value => !value)}>{paused ? 'Resume muted video' : 'Pause video'}</button>
        <br />Video loads automatically from YouTube, always muted here. Use Listen Live for sound. Autoplay or stream unavailable? <a href="https://www.youtube.com/watch?v=TwviLAwFpgo" target="_blank" rel="noopener noreferrer">Watch directly on YouTube</a>.
      </p>
    </div>
  </section>;
}
