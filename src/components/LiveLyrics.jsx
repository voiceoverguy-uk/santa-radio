import { useEffect, useId, useRef, useState } from 'react';
import { matchLiveSong } from '../data/matchLiveSong.js';
import './LiveLyrics.css';

export const lyricsWaitingMessages = [
  'Hang on, Santa is getting the next track ready. Lyrics on the way!',
  'One moment! An elf has hidden the lyric sheet under the mince pies.',
  'Hold your reindeer! Santa is finding the words for your next singalong.',
  'Just a tick! Rudolph is shining a light on the next lyric sheet.',
  'Bear with us! The elves are untangling the lyrics from the fairy lights.',
  'Nearly there! Santa is brushing the biscuit crumbs off the songbook.',
];

export default function LiveLyrics({ metadata }) {
  const [open, setOpen] = useState(false);
  const [waitingIndex, setWaitingIndex] = useState(0);
  const dialog = useRef(null);
  const backdropPress = useRef(false);
  const outsideDialog = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  const trigger = useRef(null);
  const reader = useRef(null);
  const titleId = useId();
  const track = metadata.currentStatus === 'ready' ? metadata.current : null;
  const result = matchLiveSong(track);
  const title = result.song?.song || track?.title;
  const artist = result.song?.artist || track?.artist;
  const waiting = !track;
  useEffect(() => {
    setWaitingIndex(0);
    if (!open || !waiting) return;
    const timer = setInterval(() => {
      setWaitingIndex(index => (index + 1) % lyricsWaitingMessages.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [open, waiting]);
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
      onClose={close}
      onPointerDown={event => { backdropPress.current = outsideDialog(event); }}
      onClick={event => {
        if (backdropPress.current && outsideDialog(event)) dialog.current.close();
        backdropPress.current = false;
      }}>
      <header className="live-lyrics-header">
        <div><h2 id={titleId}>Live lyrics</h2></div>
        <button autoFocus className="live-lyrics-close" onClick={() => dialog.current.close()} aria-label="Close lyrics">Close <span aria-hidden="true">×</span></button>
      </header>
      <div className="live-lyrics-reader" ref={reader} tabIndex={0} role="region" aria-label="Song lyrics">
        <div aria-live="polite" aria-atomic="true" className="live-lyrics-track">
          {title && <h3>{title}</h3>}
          {artist && <p>{artist}</p>}
          {result.status !== 'ready' && <p>{
            !track ? lyricsWaitingMessages[waitingIndex] :
            result.status === 'ambiguous' ? 'Lyrics unavailable: this track has more than one possible match.' :
            'Lyrics unavailable for this track.'
          }</p>}
        </div>
        {result.status === 'ready' && <pre>{result.song.lyrics}</pre>}
      </div>
    </dialog>
  </>;
}
