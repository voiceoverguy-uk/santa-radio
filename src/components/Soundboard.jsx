import { PHRASES } from '../lib/soundboardPhrases.js';
import useSoundboard from './useSoundboard.js';
import './Soundboard.css';

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 6.8v10.4L17 12 9 6.8Z" fill="currentColor" />
  </svg>;
}

function WaveformIcon() {
  return <svg className="soundboard-wave-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 6v12M23 10v4" />
  </svg>;
}

function Waveform() {
  return <span className="soundboard-waveform" aria-hidden="true">
    {[9, 16, 24, 13, 30, 20, 37, 17, 28, 12, 23, 34, 15, 27, 10, 19, 32, 13, 25, 16, 29, 11, 21, 34, 14, 26, 18, 9, 23, 13, 31, 17].map((height, index) =>
      <i key={index} style={{ '--wave-height': `${height}px`, '--wave-delay': `${(index % 8) * -0.11}s` }} />
    )}
  </span>;
}

export default function Soundboard() {
  const { active, status, error, play, stop } = useSoundboard();
  const selectedPhrase = active ? PHRASES.find(phrase => phrase.file === active) : null;
  const isPlaying = status === 'playing' && Boolean(selectedPhrase);
  const isLoading = status === 'loading' && Boolean(selectedPhrase);

  return <section className="soundboard" aria-labelledby="soundboard-title">
    <div className="soundboard-container">
      <header className="soundboard-intro">
        <p className="soundboard-eyebrow">FROM SANTA’S WORKSHOP</p>
        <h2 className="soundboard-title" id="soundboard-title">Santa’s Soundboard</h2>
        <p className="soundboard-subtitle">A little Christmas magic. In Santa’s own voice.</p>
        <p className="soundboard-instruction">Choose a phrase and let Santa do the talking.</p>
      </header>

      <div className="soundboard-panel">
        <div className="soundboard-grid" aria-label="Santa recordings">
          {PHRASES.map(phrase => {
            const isSelected = active === phrase.file;
            const isPhraseLoading = isSelected && status === 'loading';
            const isPhrasePlaying = isSelected && status === 'playing';
            return <button
              key={phrase.file}
              type="button"
              className={`soundboard-btn${isSelected ? ' active is-active' : ''}${isPhrasePlaying ? ' is-playing' : ''}`}
              aria-pressed={isSelected}
              aria-busy={isPhraseLoading}
              onClick={() => play(phrase)}
            >
              <span className="soundboard-btn-icon">
                {isPhrasePlaying ? <WaveformIcon /> : <PlayIcon />}
              </span>
              <span className="soundboard-btn-label">{phrase.label}</span>
              {isPhraseLoading && <span className="soundboard-loading-label">Loading</span>}
            </button>;
          })}
        </div>

        <div className={`soundboard-now-playing${isPlaying ? ' is-playing' : ''}${isLoading ? ' is-loading' : ''}`} aria-live="polite" aria-atomic="true" role="status">
          <div className="soundboard-now-wave">
            {isPlaying ? <Waveform /> : <span className="soundboard-wave-idle" aria-hidden="true" />}
          </div>
          <div className="soundboard-now-copy">
            <span className="soundboard-now-kicker">{isPlaying ? 'Santa says…' : isLoading ? 'Santa is getting ready…' : 'Ready when you are'}</span>
            <span className="soundboard-now-title">{isPlaying ? selectedPhrase.label : isLoading ? 'Loading recording…' : 'Choose a phrase'}</span>
          </div>
          <button
            className="soundboard-stop"
            type="button"
            aria-label="Stop recording"
            onClick={stop}
            disabled={status === 'idle'}
          >
            <span className="soundboard-stop-square" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="soundboard-hint">Tap a phrase to play. Tap again to stop.</p>
      {error && <p className="soundboard-error" role="status">{error}</p>}
      <p className="soundboard-app-prompt">
        <a className="soundboard-link" href="https://apps.apple.com/gb/app/santa-radio/id1021183593" target="_blank" rel="noopener noreferrer">
          More Christmas magic in the Santa Radio app <span aria-hidden="true">→</span>
        </a>
      </p>
    </div>
  </section>;
}
