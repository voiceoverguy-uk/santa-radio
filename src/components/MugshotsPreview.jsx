import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import './MugshotsPreview.css';
import mugshotsData from '../data/mugshots.json';

const FEATURED_SLUGS = [
  'lisa-maxwell-actress',
  'jason-manford-comedian',
  'jordan-banjo-dancer',
  'tom-milner-actor',
];

export default function MugshotsPreview() {
  const celebs = useMemo(() => {
    const featured = FEATURED_SLUGS
      .map(slug => mugshotsData.find(m => m.song === slug))
      .filter(Boolean);
    if (featured.length >= 4) return featured;
    return mugshotsData.slice(0, 4);
  }, []);

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
              <img src={celeb.image} alt={celeb.artist} className="mug-photo" loading="lazy" />
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
