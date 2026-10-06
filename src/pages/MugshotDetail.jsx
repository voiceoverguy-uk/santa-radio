import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Portrait from '../components/Portrait.jsx';
import mugshotsData from '../data/mugshots.json';
import './MugshotDetail.css';
import './MugshotPhoto.css';

export default function MugshotDetail() {
  const { slug } = useParams();
  const celeb = mugshotsData.find(m => m.song === slug);

  if (!celeb) {
    return (
      <main>
        <Helmet>
          <title>Celebrity Not Found – Santa Radio</title>
        </Helmet>
        <div className="mugshot-detail-page starry-bg">
          <div className="container mugshot-detail-content">
            <h1>Celebrity Not Found</h1>
            <p>Sorry, we couldn't find that celebrity mugshot.</p>
            <Link to="/mugshots/all" className="back-link">← Back to all Mug Shots</Link>
          </div>
        </div>
      </main>
    );
  }

  const pageTitle = celeb.artist;
  const pageDescription = `${celeb.artist}${celeb.link ? ' (' + celeb.link + ')' : ''} posing with the iconic Santa Radio mug. See all celebrity mug shots at Santa Radio.`;
  const imageUrl = `https://www.santaradio.co.uk${celeb.image}`;
  const biography = typeof celeb.info === 'string' ? celeb.info.trim() : '';
  const credit = typeof celeb.credit === 'string' ? celeb.credit.trim() : '';
  const socialUrl = typeof celeb.socialUrl === 'string' &&
    /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}$/.test(celeb.socialUrl)
    ? celeb.socialUrl : '';

  return (
    <main>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={`https://www.santaradio.co.uk/mugshots/${celeb.song}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={imageUrl} />
        <link rel="canonical" href={`https://www.santaradio.co.uk/mugshots/${celeb.song}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.santaradio.co.uk/" },
            { "@type": "ListItem", "position": 2, "name": "Mug Shots", "item": "https://www.santaradio.co.uk/mugshots/all" },
            { "@type": "ListItem", "position": 3, "name": celeb.artist, "item": `https://www.santaradio.co.uk/mugshots/${celeb.song}` }
          ]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Santa Radio",
          "url": "https://www.santaradio.co.uk",
          "logo": "https://www.santaradio.co.uk/santa-radio-logo.png",
          "sameAs": [
            "https://twitter.com/WeAreSantaRadio",
            "https://facebook.com/santaradio"
          ]
        })}</script>
      </Helmet>
      <div className="mugshot-detail-page starry-bg">
        <div className="container mugshot-detail-content">
          <nav className="mugshot-breadcrumb">
            <Link to="/">Home</Link> &rsaquo; <Link to="/mugshots/all">Mug Shots</Link> &rsaquo; <span>{celeb.artist}</span>
          </nav>
          <div className="mugshot-detail-card">
            <figure className="mugshot-detail-figure">
              <div className="mugshot-photo-frame">
                <Portrait
                  key={celeb.image}
                  src={celeb.image}
                  alt={`${celeb.artist} with Santa Radio mug`}
                  className="mugshot-detail-photo"
                />
              </div>
              {credit && <figcaption className="mugshot-photo-credit">Photo credit: {credit}</figcaption>}
            </figure>
            <div className="mugshot-detail-info">
              <h1 className="mugshot-detail-name">{celeb.artist}</h1>
              {celeb.link && <p className="mugshot-detail-role">{celeb.link}</p>}
              <p className="mugshot-detail-desc">
                {biography || `${celeb.artist} posing with the iconic Santa Radio mug as part of our Celebrity Mug Shots Hall of Fame!`}
              </p>
              {socialUrl && (
                <p className="mugshot-social">
                  <a href={socialUrl} target="_blank" rel="noopener noreferrer">
                    Follow {celeb.artist} on X
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
