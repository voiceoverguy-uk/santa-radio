import { Link } from 'react-router-dom';
import Portrait from './Portrait.jsx';
import './MugshotsPreview.css';
import mugshotsData from '../data/mugshots.ts';
import useMugshotRotation from './useMugshotRotation.js';
import HomepageSectionHeading from './HomepageSectionHeading.jsx';

export default function MugshotsPreview() {
  const { celebs, gridEvents } = useMugshotRotation(mugshotsData);

  return (
    <section id="homepage-mugshots" className="mugshots-preview starry-bg" aria-labelledby="homepage-mugshots-title">
      <div className="container mugshots-preview-inner">
        <header className="mugshots-intro">
          <HomepageSectionHeading
            eyebrow="THE SANTA RADIO HALL OF FAME"
            title="Celebrity Mugshots"
            titleId="homepage-mugshots-title"
          />
          <p className="mugshots-description">
            Our autograph-hunting elf has been busy with our Santa Radio mug. No A.I.
          </p>
        </header>

        <div className="mugshots-grid" {...gridEvents}>
          {celebs.map((celeb, index) => (
            <Link
              key={index}
              to={`/mugshots/${celeb.song}`}
              className="mug-card"
            >
              <span key={celeb.song} className="mugshots-card-content">
                <span className="mugshots-photo-frame">
                <Portrait
                  src={celeb.image}
                  alt={`${celeb.artist} holding a Santa Radio mug`}
                  className="mug-photo"
                  sizes="(max-width: 760px) 44vw, (max-width: 1140px) 23vw, 260px"
                />
                </span>
                <span className="mug-info">
                <strong>{celeb.artist}</strong>
                <span>{celeb.link}</span>
                <span className="mugshots-card-arrow" aria-hidden="true">›</span>
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mugshots-gallery-cta">
          <Link to="/mugshots/all" className="mugshots-gallery-button">
            Explore the Celebrity Mugshots
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
