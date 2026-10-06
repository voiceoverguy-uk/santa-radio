import './SantaVideoSection.css';

export default function SantaVideoSection() {
  return (
    <section className="santa-video-section section-dark">
      <div className="container">
        <h2 className="section-title santa-video-title gold-text">Personalised Santa Video</h2>
        <div className="santa-video-content">
          <p>
            Make time for a special Christmas moment. Find out about personalised Santa videos
            on the original Santa Radio website.
          </p>
          <p>
            The link below opens the existing video service in a new tab. Availability and
            details are provided there; no video is created or purchased on this website.
          </p>
          <div className="santa-video-cta">
            <a
              href="https://www.santaradio.co.uk/personalised-santa-video.php"
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
