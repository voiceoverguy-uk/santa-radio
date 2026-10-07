import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Portrait from './Portrait.jsx';
import './MugshotsPreview.css';
import mugshotsData from '../data/mugshots.ts';
import { selectHomepageMugshots } from '../data/homepageMugshots.js';

export default function MugshotsPreview() {
  const celebs = useMemo(() => selectHomepageMugshots(mugshotsData), []);

  return (
    <section className="mugshots-preview starry-bg">
      <div className="container">
        <div className="mugshots-logo">
          <img
            src="https://www.santaradio.co.uk/santa-radio-celebrity-mugshots.png"
            alt="Celebrity Mugshots"
            className="mugshots-header-img"
          />
        </div>
        <h2 className="section-title mug-title">Mug Shots</h2>
        <p className="section-subtitle mug-sub">
          We gave a Santa Radio Mug to our Autograph hunting Elf. You won't believe how many he got...
          <br />
          <Link to="/mugshots/all" className="mug-link">
            <strong>Click here</strong>
          </Link>{' '}
          to see over {mugshotsData.length} Celebs with mugs
        </p>
        <div className="mugshots-grid">
          {celebs.map(celeb => (
            <Link key={celeb.song} to={`/mugshots/${celeb.song}`} className="mug-card">
              <Portrait src={celeb.image} alt={celeb.artist} className="mug-photo" />
              <div className="mug-info">
                <strong>{celeb.artist}</strong>
                <span>{celeb.link}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
