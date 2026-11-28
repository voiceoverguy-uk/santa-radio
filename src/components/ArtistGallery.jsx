import { useEffect, useRef, useState } from 'react';
import { useRadio } from './radio-context.js';
import { galleryPlayTime } from '../lib/artistGallerySchedule.js';
import { formatPlayTime } from '../lib/radio-schedule.js';
import './ArtistGallery.css';

// Entries are explicitly curated: { src, artist, title?, songId? }.
// Keep generic artist pictures title-free rather than guessing a recording.

export default function ArtistGallery({ images = [] }) {
  const { upcoming = [] } = useRadio();
  const [index, setIndex] = useState(null);
  const [now, setNow] = useState(Date.now);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const touch = useRef(null);
  const lastSwipe = useRef(0);
  const open = index !== null;
  const image = images[index];
  const move = step => setIndex(current => (current + step + images.length) % images.length);
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      modal.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);
  useEffect(() => {
    if (!open || images.length < 2) return;
    // Warm the browser image cache in both directions without downloading
    // the full gallery. Decode as well so the next click can paint promptly.
    const neighbours = new Set([
      images[(index + 1) % images.length].src,
      images[(index - 1 + images.length) % images.length].src,
    ]);
    for (const src of neighbours) {
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = src;
      preload.decode().catch(() => {});
    }
  }, [index, open, images]);
  if (!images.length) return null;
  const playingAt = galleryPlayTime(image, upcoming, now);
  return <>
    <button ref={trigger} type="button" aria-label="Artist image gallery" title="Artist image gallery"
      aria-haspopup="dialog" onClick={() => setIndex(Math.floor(Math.random() * images.length))}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 6-6 4 4 3-3 5 5" />
      </svg>
    </button>
    <dialog ref={dialog} className="artist-gallery" aria-label="Artist image gallery"
      onClose={() => { setIndex(null); trigger.current?.focus({ preventScroll: true }); }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}>
      <div className="artist-gallery__content">
        <button className="artist-gallery__close" type="button" autoFocus aria-label="Close artist gallery" onClick={() => dialog.current.close()}><span aria-hidden="true">×</span></button>
        {image && <figure onTouchStart={event => { touch.current = event.touches[0].clientX; }}
          onTouchEnd={event => {
            if (touch.current === null) return;
            const distance = touch.current - event.changedTouches[0].clientX;
            if (Math.abs(distance) > 50) { lastSwipe.current = Date.now(); move(distance > 0 ? 1 : -1); }
            touch.current = null;
          }}>
          <div className="artist-gallery__picture">
          <img key={image.src} src={image.src} alt={`${image.artist}${image.title ? ` — ${image.title}` : ''}`} />
          <button className="artist-gallery__side artist-gallery__side--previous" type="button" onClick={() => { if (Date.now() - lastSwipe.current > 400) move(-1); }} aria-label="Previous artist image"><svg aria-hidden="true" viewBox="0 0 24 48"><path d="M20 4 4 24l16 20" /></svg></button>
          <button className="artist-gallery__side artist-gallery__side--next" type="button" onClick={() => { if (Date.now() - lastSwipe.current > 400) move(1); }} aria-label="Next artist image"><svg aria-hidden="true" viewBox="0 0 24 48"><path d="m4 4 16 20L4 44" /></svg></button>
          </div>
          <figcaption className="artist-gallery__footer">
            <div className="artist-gallery__caption" aria-live="polite">
              <strong>{image.artist}</strong>{image.title && <span>{image.title}</span>}
              {playingAt !== null && <span className="artist-gallery__time">Playing at {formatPlayTime(playingAt)}</span>}
            </div>
          </figcaption>
        </figure>}
      </div>
    </dialog>
  </>;
}
