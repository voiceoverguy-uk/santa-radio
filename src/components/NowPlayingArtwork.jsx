import { useEffect, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import { artistArtwork, fallbackArtwork } from '../data/artistArtwork.js';
import './NowPlayingArtwork.css';

export default function NowPlayingArtwork() {
  const { status, metadata } = useRadio();
  const current = metadata?.current;
  const artist = current?.artist?.trim() || '';
  const hasArtistArtwork = metadata?.currentStatus === 'ready' && artist.length > 0;
  const artwork = hasArtistArtwork ? artistArtwork(artist) : fallbackArtwork;
  const [imageSrc, setImageSrc] = useState(artwork);

  useEffect(() => {
    setImageSrc(artwork);
  }, [artwork]);

  if (status !== 'playing') return null;

  return (
    <div className="now-playing-artwork" role="img" aria-label={imageSrc !== fallbackArtwork ? `Artwork for ${artist}` : 'Santa Radio artwork'}>
      <img
        key={artwork}
        src={imageSrc}
        alt=""
        width="512"
        height="512"
        decoding="async"
        onError={() => {
          if (imageSrc !== fallbackArtwork) setImageSrc(fallbackArtwork);
        }}
      />
    </div>
  );
}
