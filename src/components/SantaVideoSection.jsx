import './SantaVideoSection.css';

export default function SantaVideoSection() {
  return (
    <section className="santa-video-section section-dark">
      <div className="container">
        <h2 className="section-title santa-video-title gold-text">Personalised Santa Video</h2>
        <div className="santa-video-content">
          <p>
            Take a magical tour of the North Pole with Santa himself! Our personalised Santa video experience
            lets your child receive a unique video message from Santa, featuring their name and a magical journey
            through Santa{'\u2019'}s workshop, the reindeer stables, and the elves{'\u2019'} toy factory.
          </p>
          <p>
            Watch as Santa reads your child{'\u2019'}s name from his Nice List and delivers a heartfelt Christmas
            message just for them. It{'\u2019'}s the perfect way to bring the magic of Christmas to life!
          </p>
          <div className="santa-video-cta">
            <a
              href="https://www.santaradio.co.uk/personalised-santa-video.php"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-red santa-video-btn"
            >
              Get Your Personalised Santa Video
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
