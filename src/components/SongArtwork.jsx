import { useEffect, useState } from 'react';
import { fallbackArtwork } from '../data/artistArtwork.js';
import { songArtworkCandidates } from '../data/songArtwork.js';
import { artworkAlt } from '../seo/catalogue.js';

const fallbackAlt = 'Santa Radio branded artwork: Santa with music notes';

export default function SongArtwork({ song, alt, onError, ...imageProps }) {
  const artworkSong = song || { artist: '' };
  const candidates = songArtworkCandidates(artworkSong);
  const signature = [
    artworkSong.id ?? '',
    artworkSong.song ?? '',
    artworkSong.artist ?? '',
    candidates.join('\u0000'),
  ].join('\u0001');
  const [position, setPosition] = useState({ signature, index: 0 });
  const index = position.signature === signature ? position.index : 0;
  const src = candidates[index] || fallbackArtwork;
  const defaultAlt = artworkAlt(artworkSong);

  useEffect(() => {
    setPosition({ signature, index: 0 });
  }, [signature]);

  return (
    <img
      {...imageProps}
      src={src}
      alt={src === fallbackArtwork ? fallbackAlt : index === 0
        ? (alt || defaultAlt) : artworkAlt({ artist: artworkSong.artist })}
      onError={event => {
        onError?.(event);
        setPosition(current => {
          if (current.signature !== signature || index >= candidates.length - 1) return current;
          return { signature, index: index + 1 };
        });
      }}
    />
  );
}
