import { useRef, useState } from 'react';
import './SantaVideoPlayer.css';

export default function SantaVideoPlayer({ label, onPlay, onPause, onEnded, onPlaying, onError, glow = false, ...media }) {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    if (!video.current) return;
    setError('');
    if (!video.current.paused) video.current.pause();
    else try { await video.current.play(); } catch { setError('Please try playing your message again.'); }
  };
  return <div className={`santa-video-player${glow ? ' santa-video-player--glow' : ''}`}>
    <video {...media} ref={video} playsInline aria-label={label} onClick={toggle}
      onPlay={event => { setPlaying(true); onPlay?.(event); }}
      onPause={event => { setPlaying(false); onPause?.(event); }}
      onEnded={event => { setPlaying(false); onEnded?.(event); }} onPlaying={onPlaying}
      onError={event => { setPlaying(false); setError('This video could not play. Please try again.'); onError?.(event); }} />
    <button className="santa-video-player__toggle" data-playing={playing} type="button" onClick={toggle}
      aria-label={`${playing ? 'Pause' : 'Play'} ${label.replace(/^Play /, '')}`}>
      {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8z" /></svg>}
    </button>
    {error && <p className="santa-video-player__error" role="alert">{error}</p>}
  </div>;
}
