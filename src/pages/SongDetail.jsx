import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import findSong from '../data/findSong';
import relatedSongs from '../data/relatedSongs.js';
import { artistArtwork, fallbackArtwork } from '../data/artistArtwork.js';
import './SongDetail.css';
import PageSeo from '../seo/PageSeo.jsx';
import Breadcrumbs from '../seo/Breadcrumbs.jsx';
import { songMetadata, songDescription, artworkAlt, performanceKind } from '../seo/catalogue.js';

export default function SongDetail() {
  const { slug } = useParams();
  const song = findSong(slug);
  const moreSongs = relatedSongs(song);

  if (!song) {
    return (
      <main>
        <Helmet>
          <title>Song Not Found – Santa Radio</title>
          <meta name="robots" content="noindex, follow" />
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

  const pageDescription = songDescription(song);
  const songSlug = `${song.id}-${song.link}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listening to ${song.song} by ${song.artist} on Santa Radio!`)}&url=${encodeURIComponent(`https://www.santaradio.co.uk/christmas-artist/${songSlug}`)}`;

  return (
    <main>
      <PageSeo metadata={songMetadata(song)} />
      <Breadcrumbs items={[['Home', '/'], ['Christmas Music', '/christmas-music'], [`${song.song} — ${song.artist}`, `/christmas-artist/${songSlug}`]]} />
      <div className="song-detail-page starry-bg">
        <div className="container song-detail-content">

          <div className="song-detail-layout">
            <div className="song-detail-main">
              <p className="song-detail-artist">{song.artist}</p>
              <h1 className="song-detail-title">{song.song} — {song.artist}</h1>
              <p className="song-recording-summary">{pageDescription}</p>
              <p>{performanceKind(song)}: {song.artist}</p>
              <Link to={`/christmas-karaoke-lyrics/${songSlug}`}>Open the full sing-along lyrics page</Link>

              <div className="song-detail-info">
                <h2>Artist background</h2>
                <p>{song.info || 'Artist information for this song is not yet available.'}</p>
              </div>

              {!song.lyrics && <p>Lyrics for this song are not yet available.</p>}
              {song.lyrics && (
                <details className="song-lyrics-section" key={songSlug}>
                  <summary>Show Lyrics — {song.song}</summary>
                    <div id="song-lyrics" className="song-lyrics-content">
                      <pre>{song.lyrics}</pre>
                    </div>
                </details>
              )}

              {song.youtube && (
                <div className="song-youtube-embed">
                  <iframe
                    width="100%"
                    height="315"
                    loading="lazy"
                    src={`https://www.youtube.com/embed/${song.youtube}`}
                    title={`${song.artist} - ${song.song}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="song-detail-actions">
                <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer" className="twitter-share-link">
                  Share on Twitter
                </a>
              </div>
            </div>

            <div className="song-detail-artwork">
              <img key={song.artist} src={artistArtwork(song.artist)} alt={artworkAlt(song)} width="512" height="512" className="song-artwork-img"
                onError={event => {
                  if (event.currentTarget.getAttribute('src') !== fallbackArtwork) {
                    event.currentTarget.src = fallbackArtwork;
                    event.currentTarget.alt = 'Santa with music notes';
                  }
                }} />
            </div>
          </div>

          {moreSongs.length > 0 && <section className="more-artist-songs" aria-labelledby="more-artist-heading">
            <h2 id="more-artist-heading">More from {song.artist}</h2>
            <ul>{moreSongs.map(other => <li key={other.id}>
              <Link to={`/christmas-artist/${other.id}-${other.link}`}>{other.song}<span aria-hidden="true">→</span></Link>
            </li>)}</ul>
          </section>}
          <Link to="/christmas-music" className="back-link">← Back to Christmas Music</Link>
        </div>
      </div>
    </main>
  );
}
