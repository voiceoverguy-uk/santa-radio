import { Link } from 'react-router-dom';
import { useRadio } from './RadioProvider.jsx';
import { matchLiveSong } from '../data/matchLiveSong.js';
import { songPath } from '../seo/catalogue.js';
import SongArtwork from './SongArtwork.jsx';
import './NowPlayingArtwork.css';

export default function NowPlayingArtwork() {
  const { status, metadata } = useRadio();
  const isMetadataReady = metadata?.currentStatus === 'ready';
  const current = isMetadataReady ? metadata?.current : null;
  const artist = typeof current?.artist === 'string' ? current.artist.trim() : '';
  const title = typeof current?.title === 'string' ? current.title.trim() : '';
  const matchedSong = isMetadataReady && current ? matchLiveSong(current).song : null;
  const hasArtistArtwork = isMetadataReady && artist.length > 0;
  const artworkSong = matchedSong || (hasArtistArtwork ? { artist } : null);

  if (status !== 'playing') return null;

  return (
    <div
      className="now-playing-artwork"
      role="group"
      aria-label={
        matchedSong
          ? `Now playing: ${matchedSong.song} by ${matchedSong.artist}`
          : artist
            ? `Now playing artwork for ${artist}`
            : title
              ? `Now playing: ${title}`
              : 'Santa Radio now-playing artwork'
      }
    >
      <div className="now-playing-artwork__image">
        <SongArtwork
          song={artworkSong}
          width="512"
          height="512"
          decoding="async"
        />
        {matchedSong && (
          <Link
            className="now-playing-artwork__info"
            to={songPath(matchedSong)}
            aria-label={`More about ${matchedSong.song} by ${matchedSong.artist}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5m0-8h.01" />
            </svg>
          </Link>
        )}
      </div>
      <div className="now-playing-artwork__caption">
        {artist || title ? (
          <>
            {artist && <div className="now-playing-artwork__artist">{artist}</div>}
            {title && <div className="now-playing-artwork__title">{title}</div>}
          </>
        ) : (
          <div className="now-playing-artwork__fallback">Santa Radio live</div>
        )}
      </div>
    </div>
  );
}
