import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import findSong from '../data/findSong';
import SongVideo from '../components/SongVideo.jsx';
import './KaraokeLyrics.css';
import PageSeo from '../seo/PageSeo.jsx';
import { pageMetadata, songMetadata } from '../seo/catalogue.js';

export default function KaraokeLyrics() {
  const { slug } = useParams();
  const song = findSong(slug);

  if (!song) {
    return (
      <main>
        <Helmet>
          <title>Karaoke Lyrics Not Found – Santa Radio</title>
          <meta name="robots" content="noindex, follow" />
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

  return (
    <main>
      <PageSeo metadata={pageMetadata({
        path: `/christmas-karaoke-lyrics/${songSlug}`,
        title: `${song.song} — ${song.artist} | Sing-Along Lyrics — Santa Radio`,
        description: `Read the lyrics to “${song.song}” by ${song.artist} and sing along with the linked recording on Santa Radio.`,
        image: songMetadata(song).image, imageAlt: songMetadata(song).imageAlt,
        crumbs: [['Home', '/'], ['Christmas Music', '/christmas-music'], [`${song.song} — ${song.artist}`, `/christmas-artist/${songSlug}`], ['Sing-Along Lyrics', `/christmas-karaoke-lyrics/${songSlug}`]],
      })} />
      <div className="karaoke-page starry-bg">
        <div className="container karaoke-content">
          <nav className="karaoke-breadcrumb">
            <Link to="/">Home</Link> &rsaquo; <Link to="/christmas-music">Christmas Music</Link> &rsaquo; <Link to={`/christmas-artist/${songSlug}`}>{song.artist}</Link> &rsaquo; <span>Karaoke Lyrics</span>
          </nav>

          <h2 className="karaoke-artist">{song.artist}</h2>
          <h1 className="karaoke-title">{song.song} — {song.artist}: Sing-Along Lyrics</h1>
          <p>Sing along using the lyrics below. The linked performance is not necessarily an instrumental karaoke track.</p>

          <SongVideo song={song} className="karaoke-video"
            title={`${song.artist} - ${song.song}: linked video`} />

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
