import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import songs from '../data/songs.ts';
import './ArtistDetail.css';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ArtistDetail() {
  const [searchParams] = useSearchParams();
  const songId = parseInt(searchParams.get('s') || '0', 10);

  const song = songs.find(s => s.id === songId);

  if (!song) {
    return (
      <main>
        <Helmet>
          <title>Song Not Found – Santa Radio</title>
        </Helmet>
        <div className="artist-detail-page starry-bg">
          <div className="container artist-detail-content">
            <h1>Song Not Found</h1>
            <p>The song you are looking for could not be found.</p>
            <Link to="/music" className="btn-red back-btn">Back to Music</Link>
          </div>
        </div>
      </main>
    );
  }

  const colors = ['#1B4332','#254c3a','#365642','#7c242b'];
  const color = colors[song.artist.charCodeAt(0) % colors.length];
  const metaDescription = song.info || `${song.artist} - ${song.song}. Listen to this Christmas classic on Santa Radio.`;
  const pageTitle = `${song.artist} - ${song.song} - Santa Radio`;
  const pageUrl = `https://www.santaradio.co.uk/artist?s=${song.id}`;
  const artistImage = song.image ? `/assets/img/artists/${song.image}` : '';

  const schemaOrg = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Santa Radio",
        "url": "https://www.santaradio.co.uk",
        "logo": "https://www.santaradio.co.uk/santa-radio-logo.png"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.santaradio.co.uk/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Christmas Music",
            "item": "https://www.santaradio.co.uk/music"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": `${song.artist} - ${song.song}`,
            "item": pageUrl
          }
        ]
      }
    ]
  };

  return (
    <main>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={pageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        {artistImage && <meta name="twitter:image" content={`https://www.santaradio.co.uk${artistImage}`} />}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        {artistImage && <meta property="og:image" content={`https://www.santaradio.co.uk${artistImage}`} />}
        <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
      </Helmet>

      <div className="artist-detail-page starry-bg">
        <div className="container artist-detail-content">
          <nav className="breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <Link to="/music">Christmas Music</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span>{song.artist} – {song.song}</span>
          </nav>

          <div className="artist-detail-header">
            <div className="artist-detail-image-wrap">
              {artistImage ? (
                <img
                  src={artistImage}
                  alt={song.artist}
                  className="artist-detail-image"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="artist-detail-avatar"
                style={{
                  background: color,
                  display: artistImage ? 'none' : 'flex'
                }}
              >
                <span>{getInitials(song.artist)}</span>
              </div>
            </div>
            <div className="artist-detail-meta">
              <h1 className="artist-detail-name gold-text">{song.artist}</h1>
              <h2 className="artist-detail-song">{song.song}</h2>
              {song.info && (
                <div className="artist-detail-info">
                  <p>{song.info}</p>
                </div>
              )}
            </div>
          </div>

          {song.lyrics && (
            <div className="artist-detail-lyrics">
              <h3>Lyrics</h3>
              <div className="lyrics-text">
                {song.lyrics.split('\n').map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))}
              </div>
            </div>
          )}

          <div className="artist-detail-actions">
            <Link to="/music" className="btn-red back-btn">
              &larr; Back to All Songs
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
