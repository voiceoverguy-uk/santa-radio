import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import findSong from '../data/findSong';
import { songNeighbours } from '../seo/catalogue.js';
import relatedSongs from '../data/relatedSongs.js';
import './SongDetail.css';
import PageSeo from '../seo/PageSeo.jsx';
import SongVideo from '../components/SongVideo.jsx';
import SongArtwork from '../components/SongArtwork.jsx';
import LyricsMessageLink from '../components/LyricsMessageLink.jsx';
import { songMetadata, performanceKind } from '../seo/catalogue.js';

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

  const songSlug = `${song.id}-${song.link}`;
  const { previous, next } = songNeighbours(song);
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listening to ${song.song} by ${song.artist} on Santa Radio!`)}&url=${encodeURIComponent(`https://www.santaradio.co.uk/christmas-artist/${songSlug}`)}`;

  return (
    <main>
      <PageSeo metadata={songMetadata(song)} />
      <div className="song-detail-page starry-bg">
        <div className="container song-detail-content">

          <nav className="song-navigation" aria-label="Browse Christmas songs">
            {previous ? (
              <Link className="song-navigation-link song-navigation-previous"
                to={`/christmas-artist/${previous.id}-${previous.link}`}
                aria-label={`Previous song: ${previous.song} by ${previous.artist}`}>
                <span className="song-navigation-direction">← Previous</span>
                <span className="song-navigation-title">{previous.song} — {previous.artist}</span>
              </Link>
            ) : (
              <span className="song-navigation-link song-navigation-previous is-unavailable" aria-disabled="true">
                <span className="song-navigation-direction">← Previous</span>
                <span className="song-navigation-title">First song in the catalogue</span>
              </span>
            )}
            {next ? (
              <Link className="song-navigation-link song-navigation-next"
                to={`/christmas-artist/${next.id}-${next.link}`}
                aria-label={`Next song: ${next.song} by ${next.artist}`}>
                <span className="song-navigation-direction">Next →</span>
                <span className="song-navigation-title">{next.song} — {next.artist}</span>
              </Link>
            ) : (
              <span className="song-navigation-link song-navigation-next is-unavailable" aria-disabled="true">
                <span className="song-navigation-direction">Next →</span>
                <span className="song-navigation-title">Last song in the catalogue</span>
              </span>
            )}
          </nav>

          <div className="song-detail-layout">
            <div className="song-detail-main">
              <p className="song-detail-artist">{song.artist}</p>
              <h1 className="song-detail-title">{song.song} — {song.artist}</h1>
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
                    <LyricsMessageLink />
                </details>
              )}

              <SongVideo song={song} className="song-youtube-embed" />

              <div className="song-detail-actions">
                <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer" className="twitter-share-link">
                  Share on Twitter
                </a>
              </div>
            </div>

            <div className="song-detail-artwork">
              <SongArtwork song={song} width="512" height="512" className="song-artwork-img" />
            </div>
          </div>

          {moreSongs.length > 0 && <section className="more-artist-songs" aria-labelledby="more-artist-heading">
            <h2 id="more-artist-heading">More Christmas songs from {song.artist}</h2>
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
