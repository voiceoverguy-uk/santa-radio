import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import songsData from '../data/songs.json';
import './KaraokeLyrics.css';

function findSong(rawSlug) {
  const slug = rawSlug.replace(/[?&#]/g, '');
  const exactMatch = songsData.find(s => `${s.id}-${s.link}` === slug);
  if (exactMatch) return exactMatch;
  if (/^\d+$/.test(slug)) {
    return songsData.find(s => s.id === parseInt(slug, 10));
  }
  const slugPart = slug.replace(/^\d+-/, '');
  return songsData.find(s => s.link === slugPart);
}

export default function KaraokeLyrics() {
  const { slug } = useParams();
  const song = findSong(slug);

  if (!song) {
    return (
      <main>
        <Helmet>
          <title>Karaoke Lyrics Not Found – Santa Radio</title>
        </Helmet>
        <div className="karaoke-page starry-bg">
          <div className="container karaoke-content">
            <h1>Karaoke Lyrics Not Found</h1>
            <p>Sorry, we couldn't find karaoke lyrics for that song.</p>
            <Link to="/christmas-music" className="back-link">← Back to Christmas Music</Link>
          </div>
        </div>
      </main>
    );
  }

  const songSlug = slug;
  const pageTitle = `${song.artist} - ${song.song} Karaoke Lyrics - Santa Radio`;
  const pageDescription = `Sing along to "${song.song}" by ${song.artist} with karaoke lyrics from Santa Radio, the UK's favourite Christmas radio station.`;

  return (
    <main>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={`https://www.santaradio.co.uk/christmas-karaoke-lyrics/${songSlug}`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <link rel="canonical" href={`https://www.santaradio.co.uk/christmas-karaoke-lyrics/${songSlug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.santaradio.co.uk/" },
            { "@type": "ListItem", "position": 2, "name": "Christmas Music", "item": "https://www.santaradio.co.uk/christmas-music" },
            { "@type": "ListItem", "position": 3, "name": `${song.artist} - ${song.song}`, "item": `https://www.santaradio.co.uk/christmas-artist/${songSlug}` },
            { "@type": "ListItem", "position": 4, "name": "Karaoke Lyrics", "item": `https://www.santaradio.co.uk/christmas-karaoke-lyrics/${songSlug}` }
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
      <div className="karaoke-page starry-bg">
        <div className="container karaoke-content">
          <nav className="karaoke-breadcrumb">
            <Link to="/">Home</Link> &rsaquo; <Link to="/christmas-music">Christmas Music</Link> &rsaquo; <Link to={`/christmas-artist/${songSlug}`}>{song.artist}</Link> &rsaquo; <span>Karaoke Lyrics</span>
          </nav>

          <h2 className="karaoke-artist">{song.artist}</h2>
          <h1 className="karaoke-title">{song.song} – Karaoke Lyrics</h1>

          {song.youtube && (
            <div className="karaoke-video">
              <iframe
                width="100%"
                height="315"
                src={`https://www.youtube.com/embed/${song.youtube}`}
                title={`${song.artist} - ${song.song} Karaoke`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div className="karaoke-lyrics-display">
            {song.lyrics ? (
              <pre className="karaoke-lyrics-text">{song.lyrics}</pre>
            ) : (
              <p className="karaoke-no-lyrics">Lyrics for this song are not yet available. Check back soon!</p>
            )}
          </div>

          <div className="karaoke-actions">
            <Link to={`/christmas-artist/${songSlug}`} className="btn-red">View Artist Page</Link>
            <Link to="/christmas-music" className="back-link">← Back to Christmas Music</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
