import { Link } from 'react-router-dom';
import Portrait from './Portrait.jsx';
import './MugshotsPreview.css';
import mugshotsData from '../data/mugshots.ts';
import useMugshotRotation from './useMugshotRotation.js';
import { mugshotShutterEvents } from '../audio/mugshotShutter.js';

function PineCorner({ className }) {
  return (
    <svg
      className={`mugshots-pine-corner ${className}`}
      viewBox="0 0 420 300"
      aria-hidden="true"
      focusable="false"
    >
      {[[-15, 6, 0, 1.6], [25, -5, 28, 1.2], [-15, 12, 65, 1.2],
        [110, -14, 18, 1], [205, -18, 8, .8], [-15, 100, 78, .8]].map(([x, y, angle, scale], sprig) => (
        <g key={sprig} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} fill="none" strokeLinecap="round">
          <path d="M0 0Q80 14 185 0" stroke="#665738" strokeWidth="3" />
          {Array.from({ length: 26 }, (_, i) => {
            const start = i * 6.7;
            const length = 26 - i * .55;
            return <path key={i} d={`M${start} 5l${length} -${length * .85}M${start} 5l${length} ${length * .8}`}
              stroke={['#41633a', '#254e31', '#66804a'][i % 3]} strokeWidth="1.7" />;
          })}
        </g>
      ))}
      <path d="M0 68Q80 0 180 42T420 8M0 70Q60 140 14 290" fill="none" stroke="#aa8a43" strokeWidth="1" />
      <g className="mugshots-lights">
        <circle cx="22" cy="54" r="4" /><circle cx="80" cy="32" r="4.5" />
        <circle cx="140" cy="32" r="4" /><circle cx="205" cy="49" r="4.5" />
        <circle cx="290" cy="38" r="4" /><circle cx="365" cy="20" r="4.5" />
        <circle cx="34" cy="140" r="4" /><circle cx="28" cy="230" r="4.5" />
      </g>
      <g fill="#a52b22" stroke="#e5c365" strokeWidth="1.5">
        <circle cx="78" cy="56" r="9" /><circle cx="149" cy="14" r="7" />
        <circle cx="240" cy="25" r="9" /><circle cx="12" cy="185" r="7" />
      </g>
    </svg>
  );
}

export default function MugshotsPreview() {
  const { celebs, userPaused, togglePaused, gridEvents } = useMugshotRotation(mugshotsData);

  return (
    <section id="homepage-mugshots" className="mugshots-preview starry-bg" aria-labelledby="homepage-mugshots-title">
      <PineCorner className="mugshots-pine-left" />
      <PineCorner className="mugshots-pine-right" />
      <div className="container mugshots-preview-inner">
        <header className="mugshots-intro">
          <p className="mugshots-eyebrow">THE SANTA RADIO HALL OF FAME</p>
          <h2 id="homepage-mugshots-title" className="section-title mug-title">Celebrity Mugshots</h2>
          <p className="mugshots-subtitle">Famous faces. One festive mug.</p>
          <p className="mugshots-description">
            Our autograph-hunting elf has been busy. Discover hundreds of familiar faces with the Santa Radio mug.
          </p>
        </header>

        <div className="mugshots-grid" {...gridEvents}>
          {celebs.map((celeb, index) => (
            <Link
              key={index}
              to={`/mugshots/${celeb.song}`}
              className="mug-card"
              {...mugshotShutterEvents}
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
          <p>Hundreds of famous faces. Who will you spot?</p>
          <button type="button" className="mugshots-refresh-control" onClick={togglePaused} aria-pressed={userPaused}>
            {userPaused ? 'Resume photo refresh' : 'Pause photo refresh'}
          </button>
        </div>
      </div>
    </section>
  );
}
