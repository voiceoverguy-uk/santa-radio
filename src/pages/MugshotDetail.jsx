import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useEffect, useRef } from 'react';
import Portrait from '../components/Portrait.jsx';
import mugshotsData, { mugshotAliases } from '../data/mugshots.ts';
import './MugshotDetail.css';
import './MugshotPhoto.css';
import PageSeo from '../seo/PageSeo.jsx';
import Breadcrumbs from '../seo/Breadcrumbs.jsx';
import { mugImageAlt, mugMetadata, mugPhotoTermsPath } from '../seo/catalogue.js';

export default function MugshotDetail() {
  const { slug } = useParams();
  const celeb = mugshotsData.find(m => m.song === mugshotAliases[slug]);
  const index = mugshotsData.indexOf(celeb);
  const previous = index > 0 ? mugshotsData[index - 1] : null;
  const next = index >= 0 ? mugshotsData[index + 1] : null;
  const heading = useRef(null);
  const lastSlug = useRef(slug);

  useEffect(() => {
    if (lastSlug.current !== slug) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      heading.current?.focus({ preventScroll: true });
      lastSlug.current = slug;
    }
  }, [slug]);

  if (!celeb) {
    return (
      <main>
        <Helmet>
          <title>Celebrity Not Found – Santa Radio</title>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <div className="mugshot-detail-page starry-bg">
          <div className="container mugshot-detail-content">
            <h1 ref={heading} tabIndex={-1}>Celebrity Not Found</h1>
            <p>Sorry, we couldn't find that celebrity mugshot.</p>
            <Link to="/mugshots/all" className="back-link">← Back to all Mug Shots</Link>
          </div>
        </div>
      </main>
    );
  }

  const biography = typeof celeb.info === 'string' ? celeb.info.trim() : '';
  const credit = typeof celeb.credit === 'string' ? celeb.credit.trim() : '';
  const socialUrl = typeof celeb.socialUrl === 'string' &&
    !['Maxwell Thorpe', 'Patricia Hodge', 'Jacqui Abbot'].includes(celeb.artist) &&
    /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}$/.test(celeb.socialUrl)
    ? celeb.socialUrl : '';

  return (
    <main>
      <PageSeo metadata={mugMetadata(celeb)} />
      <Breadcrumbs items={[['Home', '/'], ['Mug Shots', '/mugshots/all'], [celeb.artist, `/mugshots/${celeb.song}`]]} />
      <div className="mugshot-detail-page starry-bg">
        <div className="container mugshot-detail-content">
          <div className="mugshot-detail-card">
          <nav className="mugshot-profile-nav" aria-label="Browse Mugshots">
            {[
              { profile: previous, label: 'Previous', direction: 'previous', arrow: '←' },
              { profile: next, label: 'Next', direction: 'next', arrow: '→' },
            ].map(({ profile, label, direction, arrow }) => {
              const content = <>
                <span className="mugshot-nav-label">
                  {direction === 'previous' && <span aria-hidden="true">{arrow} </span>}
                  {label}
                  {direction === 'next' && <span aria-hidden="true"> {arrow}</span>}
                </span>
              </>;
              return profile ? (
                <Link key={direction} className={`mugshot-neighbour mugshot-neighbour-${direction}`}
                  to={`/mugshots/${profile.song}`} rel={direction === 'previous' ? 'prev' : 'next'}
                  title={profile.artist} aria-label={`${label} Mugshot: ${profile.artist}`}>{content}</Link>
              ) : (
                <span key={direction} className={`mugshot-neighbour mugshot-neighbour-${direction}`}
                  aria-disabled="true">{content}</span>
              );
            })}
          </nav>
            <figure className="mugshot-detail-figure">
              <div className="mugshot-photo-frame">
                <Portrait
                  key={celeb.image}
                  src={celeb.image}
                  alt={mugImageAlt(celeb)}
                  className="mugshot-detail-photo"
                />
              </div>
              <figcaption className="mugshot-photo-credit">
                {credit && <span>Photo credit: {credit}<br /></span>}
                <Link to={mugPhotoTermsPath}>Photo usage and licensing</Link>
              </figcaption>
            </figure>
            <div className="mugshot-detail-info">
              <h1 ref={heading} tabIndex={-1} className="mugshot-detail-name">{celeb.artist}</h1>
              {celeb.link && <p className="mugshot-detail-role">{celeb.link}</p>}
              <p className="mugshot-detail-desc">
                {biography || `${celeb.artist} posing with the iconic Santa Radio mug as part of our Celebrity Mug Shots Hall of Fame!`}
              </p>
              {socialUrl && (
                <p className="mugshot-social">
                  <a href={socialUrl} target="_blank" rel="noopener noreferrer">
                    Legacy social link (identity unverified)
                  </a>
                </p>
              )}
              <Link to="/mugshots/all" className="back-link">← Back to all Mug Shots</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
