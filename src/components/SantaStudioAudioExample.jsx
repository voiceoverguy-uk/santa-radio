import { useCallback, useEffect, useRef, useState } from 'react';
import './SantaStudioAudioExample.css';

const EXAMPLES = [
  {
    name: 'Charlotte',
    src: '/audio/examples/santa-studio-charlotte.mp3',
    cues: [9, 18, 29, 38, 44, 54, 64, 80],
  },
  {
    name: 'Harry',
    src: '/audio/examples/santa-studio-harry.mp3',
    cues: [9, 18, 29, 38, 45, 54, 64, 79],
  },
  {
    name: 'Edward',
    src: '/audio/examples/santa-studio-edward.mp3',
    cues: [9, 18, 29, 38, 45, 54, 64, 79],
  },
  {
    name: 'Arabella',
    src: '/audio/examples/santa-studio-arabella.mp3',
    cues: [9, 18, 29, 38, 45, 54, 64, 79],
  },
];

function getActiveCue(time, cues) {
  return cues.find(start => time >= start && time < start + 2) ?? null;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export default function SantaStudioAudioExample({ onActiveExampleNameChange }) {
  const audioRef = useRef(null);
  const playRequestRef = useRef(0);
  const startedRef = useRef(false);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const example = EXAMPLES[selectedExampleIndex];
  const [playbackState, setPlaybackState] = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeCue, setActiveCue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    onActiveExampleNameChange?.(
      playbackState === 'playing' || playbackState === 'paused' ? example.name : null,
    );
  }, [example.name, onActiveExampleNameChange, playbackState]);

  const syncFromAudio = useCallback(audio => {
    const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    setCurrentTime(time);
    setActiveCue(getActiveCue(time, example.cues));
  }, [example]);

  const advanceExample = () => {
    setSelectedExampleIndex(index => (index + 1) % EXAMPLES.length);
    setCurrentTime(0);
    setDuration(0);
    setActiveCue(null);
  };

  const playOrPause = async () => {
    const audio = audioRef.current;
    if (!audio || playbackState === 'loading') return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    setError('');
    if (audio.ended) audio.currentTime = 0;
    syncFromAudio(audio);
    const request = ++playRequestRef.current;
    setPlaybackState('loading');
    try {
      await audio.play();
      if (request !== playRequestRef.current) return;
      startedRef.current = true;
      setPlaybackState('playing');
    } catch {
      if (request !== playRequestRef.current) return;
      setPlaybackState(audio.currentTime > 0 ? 'paused' : 'idle');
      setActiveCue(null);
      setError(`${example.name}’s Studio example could not be played. Please try again.`);
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playRequestRef.current++;
    const shouldAdvance = startedRef.current;
    startedRef.current = false;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers do not allow seeking until the audio metadata is ready.
    }
    syncFromAudio(audio);
    setPlaybackState('idle');
    setError('');
    if (shouldAdvance) advanceExample();
  };

  const seek = event => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Number(event.currentTarget.value);
    syncFromAudio(audio);
  };

  const playLabel = playbackState === 'playing'
    ? `Pause ${example.name}’s paid Studio example`
    : playbackState === 'paused'
      ? `Resume ${example.name}’s paid Studio example`
      : playbackState === 'loading'
        ? `Loading ${example.name}’s paid Studio example`
        : `Play ${example.name}’s paid Studio example`;

  return (
    <section className="santa-studio-audio-example" aria-labelledby="santa-studio-audio-title">
      <h4 id="santa-studio-audio-title">Paid Studio message example — {example.name}</h4>
      <div className="santa-studio-audio-example__controls">
        <button
          className={`santa-studio-audio-example__play${activeCue !== null ? ' santa-studio-audio-example__play--personalised' : ''}`}
          type="button"
          onClick={playOrPause}
          aria-busy={playbackState === 'loading'}
        >
          <span aria-hidden="true">{playbackState === 'playing' ? 'Ⅱ' : '▶'}</span>
          {playLabel}
        </button>
        <button
          className="santa-studio-audio-example__stop"
          type="button"
          onClick={stop}
          disabled={playbackState === 'idle' && currentTime === 0 && !startedRef.current}
          aria-label={`Stop and rewind ${example.name}’s paid Studio example`}
        >
          Stop
        </button>
      </div>
      <div className="santa-studio-audio-example__timeline">
        <input
          id="santa-studio-audio-seek"
          className="santa-studio-audio-example__seek"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          disabled={!duration}
          aria-label={`${example.name}’s paid Studio message position`}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
        <span className="santa-studio-audio-example__time" aria-hidden="true">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <p className="santa-studio-audio-example__cue" role="status" aria-live="polite" aria-atomic="true">
        {activeCue !== null ? 'Personalised moment' : ''}
      </p>
      {playbackState === 'loading' && (
        <p className="santa-studio-audio-example__status" role="status">Loading {example.name}’s example…</p>
      )}
      {error && <p className="santa-studio-audio-example__error" role="alert">{error}</p>}
      <audio
        ref={audioRef}
        className="santa-studio-audio-example__audio"
        src={example.src}
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        onLoadedMetadata={event => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          syncFromAudio(audio);
        }}
        onDurationChange={event => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          syncFromAudio(audio);
        }}
        onTimeUpdate={event => syncFromAudio(event.currentTarget)}
        onSeeking={event => syncFromAudio(event.currentTarget)}
        onSeeked={event => syncFromAudio(event.currentTarget)}
        onPlaying={event => {
          if (!event.currentTarget.paused) {
            startedRef.current = true;
            setPlaybackState('playing');
          }
        }}
        onPause={event => {
          syncFromAudio(event.currentTarget);
          setPlaybackState(event.currentTarget.currentTime > 0 ? 'paused' : 'idle');
        }}
        onEnded={() => {
          setPlaybackState('idle');
          setActiveCue(null);
          if (startedRef.current) {
            startedRef.current = false;
            advanceExample();
          }
        }}
        onError={() => {
          setPlaybackState('idle');
          setActiveCue(null);
          startedRef.current = false;
          setError(`${example.name}’s Studio example could not be loaded. Please try again.`);
        }}
        onContextMenu={event => event.preventDefault()}
      />
    </section>
  );
}
