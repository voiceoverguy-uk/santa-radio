import { useId, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import RadioTracks from './RadioTracks.jsx';
import LiveLyrics from './LiveLyrics.jsx';
import './AudioPlayer.css';

export function RadioButton({ className = 'btn-gold' }) {
  const { status, togglePlay } = useRadio();
  return <button className={className} onClick={togglePlay} aria-label={status === 'loading' ? 'Cancel loading radio' : undefined}>
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      {status === 'playing' || status === 'loading' ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 4 14 8-14 8z" />}
    </svg>
    {status === 'playing' ? 'Pause Radio' : status === 'loading' ? 'Connecting…' : status === 'error' ? 'Try Again' : 'Listen Live'}
  </button>;
}
export default function AudioPlayer() {
  const { status, volume, setVolume, error, metadata } = useRadio();
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [minimized, setMinimized] = useState(() => {
    try { return sessionStorage.getItem('radio-minimized') === 'true'; }
    catch { return false; }
  });
  const toggleSize = () => {
    setMinimized(value => {
      try { sessionStorage.setItem('radio-minimized', String(!value)); } catch { /* Optional preference storage. */ }
      return !value;
    });
  };
  const upcomingId = useId();
  return (
    <aside className={`radio-dock ${minimized ? 'is-minimized' : ''} ${status === 'loading' ? 'is-loading' : ''}`} aria-label="Santa Radio player">
      <button type="button" className="radio-size-toggle" onClick={toggleSize}
        aria-label={minimized ? 'Expand radio player' : 'Minimise radio player'} aria-expanded={!minimized}
        title={minimized ? 'Expand player' : 'Minimise player'}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={minimized ? 'm6 15 6-6 6 6' : 'M5 12h14'} />
        </svg>
      </button>
      {minimized && <div className="radio-mini-summary">
        <span className="radio-eyebrow">SANTA RADIO</span>
        <span className="radio-mini-track" title={metadata.currentStatus === 'ready' ? `${metadata.current.title} — ${metadata.current.artist}` : undefined}>
          {metadata.currentStatus === 'ready' ? `${metadata.current.title} — ${metadata.current.artist}` : 'Christmas music, all year'}
        </span>
        {error && <span className="radio-mini-error" role="status">{error}</span>}
      </div>}
      <div className="radio-station">
        <span className="radio-eyebrow"><span className={status === 'playing' ? 'live-dot active' : 'live-dot'} /> SANTA RADIO LIVE</span>
        <span className="radio-caption" role="status">{error || (status === 'loading' ? 'Connecting to the North Pole…' : status === 'playing' ? 'Christmas music, all day & night' : 'A little Christmas, whenever you need it')}</span>
      </div>
      <div className="radio-dock-track"><RadioTracks metadata={metadata} /><LiveLyrics metadata={metadata} /></div>
      <RadioButton className="radio-play" />
      <label className="radio-volume">Volume
        <input aria-label="Radio volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event => setVolume(Number(event.target.value))} />
      </label>
      <div className="radio-upcoming">
        <button type="button" className="radio-upcoming-toggle" aria-expanded={upcomingOpen} aria-controls={upcomingId} onClick={() => setUpcomingOpen(open => !open)}>
          <span>Coming up</span>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div id={upcomingId} className="radio-upcoming-panel" hidden={!upcomingOpen || minimized} tabIndex={upcomingOpen && !minimized ? 0 : -1} role="region" aria-label="Coming up on Santa Radio">
          <RadioTracks metadata={metadata} kind="upcoming" showLabel={false} />
        </div>
      </div>
    </aside>
  );
}
