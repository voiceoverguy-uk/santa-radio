import { useState } from 'react';
import './YouTubeSection.css';

export default function YouTubeSection() {
  const [opened, setOpened] = useState(false);
  return <section className="youtube-section section-dark">
    <div className="container">
      <p className="eyebrow" style={{ textAlign: 'center' }}>A window to the North Pole</p>
      <h2 className="section-title youtube-title">Watch Santa Radio Live<br />Christmas Music 24/7</h2>
      <div className="tv-frame"><div className="tv-screen">
        {opened ? <iframe width="100%" height="100%" src="https://www.youtube.com/embed/TwviLAwFpgo?autoplay=0" title="Santa Radio Live Stream" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ border: 0 }} /> :
          <button className="video-preview" onClick={() => setOpened(true)}><span className="video-preview-icon"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 14 8-14 8z" /></svg></span><span>Open the live video</span></button>}
      </div></div>
      <p className="video-disclosure">Opening the player connects to YouTube. Stream not available? <a href="https://www.youtube.com/watch?v=TwviLAwFpgo" target="_blank" rel="noopener noreferrer">Watch directly on YouTube</a>.</p>
    </div>
  </section>;
}
