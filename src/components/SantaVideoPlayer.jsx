import { useEffect, useRef, useState } from 'react';
import './SantaVideoPlayer.css';

const clockTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function SantaVideoPlayer({ label, onPlay, onPause, onEnded, onPlaying, onError, glow = false, festiveControls = false, onTimeUpdate, onDurationChange, ...media }) {
  const skin = festiveControls === 'kids' ? 'kids' : 'dad';
  const video = useRef(null);
  const player = useRef(null);
  const expandButton = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedWidth, setExpandedWidth] = useState(720);
  useEffect(() => {
    if (!expanded) return;
    const escape = event => { if (event.key === 'Escape') { setExpanded(false); expandButton.current?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [expanded]);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    if (!video.current) return;
    setError('');
    if (!video.current.paused) video.current.pause();
    else try { await video.current.play(); } catch { setError('Please try playing your message again.'); }
  };
  return <div ref={player} style={{'--expanded-video-width': `${expandedWidth}px`}} className={`santa-video-player${expanded ? ' santa-video-player--expanded' : ''}${glow ? ' santa-video-player--glow' : ''}${festiveControls ? ' santa-video-player--bar' : ''}`}>
    <div className="santa-video-player__screen">
    <button ref={expandButton} type="button" className="santa-video-player__expand" aria-label={expanded ? 'Reduce video size' : 'Expand video'} aria-expanded={expanded} onClick={() => {
      if (!expanded) setExpandedWidth(player.current.getBoundingClientRect().width * 2);
      setExpanded(value => !value);
    }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={expanded ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5'} /></svg></button>
    <video {...media} ref={video} muted={festiveControls ? muted : media.muted} playsInline
      onTimeUpdate={event => {
        if (festiveControls) setPosition(event.currentTarget.currentTime);
        onTimeUpdate?.(event);
      }}
      onDurationChange={event => {
        const duration = event.currentTarget.duration;
        if (festiveControls) setDuration(Number.isFinite(duration) ? duration : 0);
        onDurationChange?.(event);
      }} aria-label={label} onClick={toggle}
      onPlay={event => { setPlaying(true); onPlay?.(event); }}
      onPause={event => { setPlaying(false); onPause?.(event); }}
      onEnded={event => { setPlaying(false); onEnded?.(event); }} onPlaying={onPlaying}
      onError={event => { setPlaying(false); setError('This video could not play. Please try again.'); onError?.(event); }} />
    {!festiveControls && <button className="santa-video-player__toggle" data-playing={playing} type="button" onClick={toggle}
      aria-label={`${playing ? 'Pause' : 'Play'} ${label.replace(/^Play /, '')}`}>
      {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8z" /></svg>}
    </button>}
    </div>
    {festiveControls && <div className="santa-video-player__bar-wrap" role="group" aria-label="Video playback controls">
      <div className={`santa-video-player__dad-skin santa-video-player__skin--${skin}`}>
        <img src={`/images/${skin}-player-${playing ? 'pause' : 'play'}-v2.png`} alt="" />
        <button type="button" className="santa-video-player__bar-play" onClick={toggle}
          aria-label={`${playing ? 'Pause' : 'Play'} ${label}`} />
        <div className="santa-video-player__seek">
          <img src={`/images/${skin}-player-knob-v1.png`} alt="" style={{ left: `${duration ? Math.min(100, position / duration * 100) : 0}%` }} />
          <input type="range" aria-label="Seek video" aria-valuetext={clockTime(position)}
            min="0" max={duration || 1} step="0.1" value={Math.min(duration, position)} disabled={!duration}
            onChange={event => {
              const seconds = Number(event.target.value);
              video.current.currentTime = seconds;
              setPosition(seconds);
            }} />
        </div>
        <button type="button" className="santa-video-player__bar-mute" aria-label={muted ? 'Unmute video' : 'Mute video'}
          onClick={() => setMuted(value => !value)}>{muted ? '×' : null}</button>
      </div>
      <div className="santa-video-player__time">{clockTime(position)} / {clockTime(duration)}</div>
    </div>}
    {error && <p className="santa-video-player__error" role="alert">{error}</p>}
  </div>;
}
