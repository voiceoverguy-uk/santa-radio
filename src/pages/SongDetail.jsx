import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import findSong from '../data/findSong';
import { songNeighbours } from '../seo/catalogue.js';
import relatedSongs from '../data/relatedSongs.js';
import './SongDetail.css';
import PageSeo from '../seo/PageSeo.jsx';
import SongVideo from '../components/SongVideo.jsx';
import SongArtworkViewer from '../components/SongArtworkViewer.jsx';
import SongArtwork from '../components/SongArtwork.jsx';
import LyricsMessageLink from '../components/LyricsMessageLink.jsx';
import { songMetadata } from '../seo/catalogue.js';

function SongNavigation({ previous, next, bottom = false }) {
  return (
          <nav className={`song-navigation${bottom ? " song-navigation-bottom" : ""}`} aria-label="Browse Christmas songs">
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
  );
}

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

  return (
    <main>
      <PageSeo metadata={songMetadata(song)} />
      <div className="song-detail-page starry-bg">
        <div className="container song-detail-content">


          <div className="song-detail-layout">
            <div className="song-detail-main">
              <p className="song-detail-artist">{song.artist}</p>
              <h1 className="song-detail-title">{song.song}</h1>

              <div className="song-detail-info">
                <h2>Artist background</h2>
                <p>{song.info || 'Artist information for this song is not yet available.'}</p>
              </div>

              <SongVideo song={song} className="song-youtube-embed" />


            </div>

            <div className="song-detail-artwork">
              <SongArtworkViewer key={`artwork-${songSlug}`} song={song} />
              {!song.lyrics && <p>Lyrics for this song are not yet available.</p>}
              {song.lyrics && (
                <details className="song-lyrics-section" key={`lyrics-${songSlug}`}>
                  <summary>Show Lyrics — {song.song}</summary>
                    <div id="song-lyrics" className="song-lyrics-content">
                      <pre>{song.lyrics}</pre>
                    </div>
                    <LyricsMessageLink />
                </details>
              )}
            </div>
          </div>

          <SongNavigation previous={previous} next={next} bottom />

          {moreSongs.length > 0 && <section className="more-artist-songs" aria-labelledby="more-artist-heading">
            <h2 id="more-artist-heading">More Christmas songs from {song.artist}</h2>
            <ul>{moreSongs.map(other => <li key={other.id}>
              <Link to={`/christmas-artist/${other.id}-${other.link}`}>
                <SongArtwork song={other} width="120" height="120" loading="lazy" />
                <strong>{other.artist}</strong>
                <span>{other.song}</span>
              </Link>
            </li>)}</ul>
          </section>}
          <Link to="/christmas-music" className="back-link">← Back to Christmas Music</Link>
        </div>
      </div>
    </main>
  );
}
