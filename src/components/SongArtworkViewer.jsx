import { useEffect, useRef, useState } from 'react';
import SongArtwork from './SongArtwork.jsx';

export default function SongArtworkViewer({ song }) {
  const trigger = useRef(null);
  const dialog = useRef(null);
  const backdropPress = useRef(false);
  const [artwork, setArtwork] = useState(null);

  useEffect(() => {
    if (!artwork) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [artwork]);

  return <>
    <button
      ref={trigger}
      type="button"
      className="song-artwork-enlarge"
      aria-label={`Enlarge artwork for ${song.song} by ${song.artist}`}
      aria-haspopup="dialog"
      onClick={() => {
        // Use the displayed image, including any fallback selected after a load error.
        const image = trigger.current.querySelector('img');
        setArtwork({ src: image.currentSrc || image.src, alt: image.alt });
      }}
    >
      <SongArtwork song={song} width="512" height="512" className="song-artwork-img" />
      <span className="song-artwork-hint" aria-hidden="true">Enlarge artwork</span>
    </button>
    <dialog
      ref={dialog}
      className="song-artwork-dialog"
      aria-label={`Artwork for ${song.song} by ${song.artist}`}
      onClose={() => {
        setArtwork(null);
        trigger.current?.focus({ preventScroll: true });
      }}
      onPointerDown={event => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={event => {
        if (backdropPress.current && event.target === event.currentTarget) dialog.current.close();
        backdropPress.current = false;
      }}
    >
      <div className="song-artwork-view">
        <button type="button" autoFocus className="song-artwork-close"
          onClick={() => dialog.current.close()} aria-label="Close enlarged artwork">
          Close <span aria-hidden="true">×</span>
        </button>
        {artwork && <img src={artwork.src} alt={artwork.alt} className="song-artwork-enlarged" />}
      </div>
    </dialog>
  </>;
}
