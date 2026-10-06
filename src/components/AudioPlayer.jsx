import { useRadio } from './RadioProvider.jsx';
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
  const { status, volume, setVolume, error } = useRadio();
  return (
    <aside className={`radio-dock ${status === 'loading' ? 'is-loading' : ''}`} aria-label="Santa Radio player">
      <div className="radio-station">
        <span className="radio-eyebrow"><span className={status === 'playing' ? 'live-dot active' : 'live-dot'} /> SANTA RADIO LIVE</span>
        <span className="radio-caption" role="status">{error || (status === 'loading' ? 'Connecting to the North Pole…' : status === 'playing' ? 'Christmas music, all day & night' : 'A little Christmas, whenever you need it')}</span>
      </div>
      <RadioButton className="radio-play" />
      <label className="radio-volume">Volume
        <input aria-label="Radio volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event => setVolume(Number(event.target.value))} />
      </label>
    </aside>
  );
}
