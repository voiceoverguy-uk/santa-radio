import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRadio } from './RadioProvider.jsx';
import { artistArtwork, fallbackArtwork } from '../data/artistArtwork.js';
import { matchLiveSong } from '../data/matchLiveSong.js';
import { songPath } from '../seo/catalogue.js';
import './NowPlayingArtwork.css';

export default function NowPlayingArtwork() {
  const { status, metadata } = useRadio();
  const current = metadata?.current;
  const artist = current?.artist?.trim() || '';
  const matchedSong = metadata?.currentStatus === 'ready' ? matchLiveSong(current).song : null;
  const hasArtistArtwork = metadata?.currentStatus === 'ready' && artist.length > 0;
  const artwork = hasArtistArtwork ? artistArtwork(artist) : fallbackArtwork;
  const [imageSrc, setImageSrc] = useState(artwork);

  useEffect(() => {
    setImageSrc(artwork);
  }, [artwork]);

  if (status !== 'playing') return null;

  return (
    <div
      className="now-playing-artwork"
      role="group"
      aria-label={matchedSong ? `Now playing: ${matchedSong.song} by ${matchedSong.artist}` : artist ? `Now playing artwork for ${artist}` : 'Santa Radio now-playing artwork'}
    >
      <img
        key={artwork}
        src={imageSrc}
        alt={imageSrc !== fallbackArtwork ? `Illustrated artwork for ${artist}` : 'Santa Radio branded Christmas artwork'}
        width="512"
        height="512"
        decoding="async"
        onError={() => {
          if (imageSrc !== fallbackArtwork) setImageSrc(fallbackArtwork);
        }}
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
  );
}
