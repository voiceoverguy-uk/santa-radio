import './YouTubeSection.css';

export default function YouTubeSection() {
  return (
    <section className="youtube-section section-dark">
      <div className="container">
        <h2 className="section-title youtube-title">
          Watch Santa Radio Live From The North Pole – Streaming Christmas Music 24/7
        </h2>
        <div className="tv-frame">
          <div className="tv-screen">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/live_stream?channel=UCKnhiAWbIBSCuFKCFyVe9rg&autoplay=0"
              title="Santa Radio Live Stream"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="tv-body">
            <div className="tv-controls">
              <div className="tv-knob" />
              <div className="tv-knob" />
            </div>
            <div className="tv-speaker">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="speaker-line" />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
