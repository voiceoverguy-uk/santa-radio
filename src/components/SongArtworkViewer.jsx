import { useEffect, useRef, useState } from 'react';
import SongArtwork from './SongArtwork.jsx';
import SongPlaybackStatus from './SongPlaybackStatus.jsx';

export default function SongArtworkViewer({ song, compact = false }) {
  const trigger = useRef(null);
  const dialog = useRef(null);
  const backdropPress = useRef(false);
  const [open, setOpen] = useState(false);
  const description = song?.song
    ? `${song.song} by ${song.artist}`
    : song?.artist || 'Santa Radio live';

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return <>
    <button
      ref={trigger}
      type="button"
      className={`song-artwork-enlarge${compact ? ' song-artwork-enlarge--compact' : ''}`}
      aria-label={`Enlarge artwork for ${description}`}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <SongArtwork song={song} width="512" height="512" className="song-artwork-img" />
      {!compact && <span className="song-artwork-hint" aria-hidden="true">Enlarge artwork</span>}
    </button>
    <dialog
      ref={dialog}
      className="song-artwork-dialog"
      aria-label={`Artwork for ${description}`}
      onClose={() => {
        setOpen(false);
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
        {open && <figure className="song-artwork-framed">
          <button type="button" autoFocus className="song-artwork-close"
            onClick={() => dialog.current.close()} aria-label="Close enlarged artwork">
            <span aria-hidden="true">×</span>
          </button>
          <button type="button" className="song-artwork-dismiss" aria-label="Close artwork by tapping image"
            onClick={() => dialog.current.close()}>
            <SongArtwork song={song} className="song-artwork-enlarged" />
          </button>
          <figcaption className="song-artwork-caption">
            <strong>{song?.artist || 'Santa Radio'}</strong>
            {song?.song && <span>{song.song}</span>}
            <SongPlaybackStatus song={song} />
          </figcaption>
        </figure>}
      </div>
    </dialog>
  </>;
}
