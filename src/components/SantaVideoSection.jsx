import './SantaVideoSection.css';

export default function SantaVideoSection() {
  return (
    <section className="santa-video-section section-dark">
      <div className="container">
        <h2 className="section-title santa-video-title gold-text">Personalised Santa Video</h2>
        <div className="santa-video-content">
          <p>
            Make time for a special Christmas moment. Find out about personalised Santa videos
            on Festive Studio.
          </p>
          <p>
            The link below opens the existing video service in a new tab. Availability and
            details are provided there; no video is created or purchased on this website.
          </p>
          <div className="santa-video-cta">
            <a
              href="https://festivestudio.com/?utm_source=santaradio&utm_medium=website&utm_campaign=2024"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-red santa-video-btn"
            >
              Explore Santa Videos
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
