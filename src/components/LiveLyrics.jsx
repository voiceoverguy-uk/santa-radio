import { useEffect, useId, useRef, useState } from 'react';
import { matchLiveSong } from '../data/matchLiveSong.js';
import './LiveLyrics.css';

export default function LiveLyrics({ metadata }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const reader = useRef(null);
  const titleId = useId();
  const track = metadata.currentStatus === 'ready' ? metadata.current : null;
  const result = matchLiveSong(track);
  const title = result.song?.song || track?.title;
  const artist = result.song?.artist || track?.artist;
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  useEffect(() => {
    if (reader.current) reader.current.scrollTop = 0;
  }, [track?.artist, track?.title, metadata.currentStatus]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return <>
    <button ref={trigger} className="radio-lyrics-button" onClick={() => setOpen(true)}
      aria-haspopup="dialog">Lyrics</button>
    <dialog ref={dialog} className="live-lyrics-dialog" aria-labelledby={titleId}
      onClose={close}>
      <header className="live-lyrics-header">
        <div><h2 id={titleId}>Live lyrics</h2><p>Lyrics follow the reported track, not word-by-word timing.</p></div>
        <button autoFocus className="live-lyrics-close" onClick={() => dialog.current.close()} aria-label="Close lyrics">Close <span aria-hidden="true">×</span></button>
      </header>
      <div className="live-lyrics-reader" ref={reader} tabIndex={0} role="region" aria-label="Song lyrics">
        <div aria-live="polite" aria-atomic="true" className="live-lyrics-track">
          {title && <h3>{title}</h3>}
          {artist && <p>{artist}</p>}
          {result.status !== 'ready' && <p>{
            metadata.currentStatus === 'loading' ? 'Waiting for the current track…' :
            !track ? 'Current track unavailable. Lyrics will return when track information is available.' :
            result.status === 'ambiguous' ? 'Lyrics unavailable: this track has more than one possible match.' :
            'Lyrics unavailable for this track.'
          }</p>}
        </div>
        {result.status === 'ready' && <pre>{result.song.lyrics}</pre>}
      </div>
    </dialog>
  </>;
}
