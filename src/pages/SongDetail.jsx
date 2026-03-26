import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import songsData from '../data/songs.json';
import './SongDetail.css';

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

export default function SongDetail() {
  const { slug } = useParams();
  const song = findSong(slug);
  const [showLyrics, setShowLyrics] = useState(false);

  if (!song) {
    return (
      <main>
        <Helmet>
          <title>Song Not Found – Santa Radio</title>
        </Helmet>
        <div className="song-detail-page starry-bg">
          <div className="container song-detail-content">
            <h1>Song Not Found</h1>
            <p>Sorry, we couldn't find that song.</p>
            <Link to="/christmas-music" className="back-link">← Back to Christmas Music</Link>
          </div>
        </div>
      </main>
    );
  }

  const pageTitle = `${song.artist} - ${song.song} - Santa Radio`;
  const pageDescription = song.info || `Listen to "${song.song}" by ${song.artist} on Santa Radio, the UK's favourite Christmas radio station. Enjoy this festive classic along with hundreds of other Christmas songs.`;
  const songSlug = slug;
  const karaokeUrl = `/christmas-karaoke-lyrics/${songSlug}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listening to ${song.song} by ${song.artist} on Santa Radio!`)}&url=${encodeURIComponent(`https://www.santaradio.co.uk/christmas-artist/${songSlug}`)}`;

  return (
    <main>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {song.image && <meta property="og:image" content={song.image} />}
        <meta property="og:type" content="music.song" />
        <meta property="og:url" content={`https://www.santaradio.co.uk/christmas-artist/${songSlug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        {song.image && <meta name="twitter:image" content={song.image} />}
        <link rel="canonical" href={`https://www.santaradio.co.uk/christmas-artist/${songSlug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.santaradio.co.uk/" },
            { "@type": "ListItem", "position": 2, "name": "Christmas Music", "item": "https://www.santaradio.co.uk/christmas-music" },
            { "@type": "ListItem", "position": 3, "name": `${song.artist} - ${song.song}`, "item": `https://www.santaradio.co.uk/christmas-artist/${songSlug}` }
          ]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MusicRecording",
          "name": song.song,
          "byArtist": { "@type": "MusicGroup", "name": song.artist },
          "url": `https://www.santaradio.co.uk/christmas-artist/${songSlug}`
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
      <div className="song-detail-page starry-bg">
        <div className="container song-detail-content">
          <nav className="song-breadcrumb">
            <Link to="/">Home</Link> &rsaquo; <Link to="/christmas-music">Christmas Music</Link> &rsaquo; <span>{song.artist}</span>
          </nav>

          <div className="song-detail-layout">
            <div className="song-detail-main">
              <h2 className="song-detail-artist">{song.artist}</h2>
              <h1 className="song-detail-title">{song.song}</h1>

              <div className="song-detail-info">
                <p>{song.info || `Listen to "${song.song}" by ${song.artist} on Santa Radio, the UK's favourite Christmas radio station. Enjoy this festive classic along with hundreds of other Christmas songs, all year round.`}</p>
              </div>

              {song.lyrics && (
                <div className="song-lyrics-section">
                  <button
                    className="lyrics-toggle-btn"
                    onClick={() => setShowLyrics(!showLyrics)}
                  >
                    {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
                  </button>
                  {showLyrics && (
                    <div className="song-lyrics-content">
                      <pre>{song.lyrics}</pre>
                    </div>
                  )}
                </div>
              )}

              {song.youtube && (
                <div className="song-youtube-embed">
                  <iframe
                    width="100%"
                    height="315"
                    src={`https://www.youtube.com/embed/${song.youtube}`}
                    title={`${song.artist} - ${song.song}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="song-detail-actions">
                <Link to={karaokeUrl} className="btn-red karaoke-link">View Karaoke Lyrics</Link>
                <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer" className="twitter-share-link">
                  Share on Twitter
                </a>
              </div>
            </div>

            <div className="song-detail-artwork">
              {song.image ? (
                <img src={song.image} alt={`${song.artist} - ${song.song}`} className="song-artwork-img" />
              ) : (
                <div className="song-artwork-placeholder">
                  <span className="placeholder-note">{String.fromCodePoint(0x1F3B5)}</span>
                  <p>{song.artist}</p>
                </div>
              )}
            </div>
          </div>

          <Link to="/christmas-music" className="back-link">← Back to Christmas Music</Link>
        </div>
      </div>
    </main>
  );
}
