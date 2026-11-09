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
  const startingRef = useRef(false);
  const selectedExampleRef = useRef(null);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(null);
  const example = selectedExampleIndex === null ? null : EXAMPLES[selectedExampleIndex];
  const [playbackState, setPlaybackState] = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeCue, setActiveCue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    onActiveExampleNameChange?.(
      (playbackState === 'playing' || playbackState === 'paused') ? example?.name ?? null : null,
    );
  }, [example?.name, onActiveExampleNameChange, playbackState]);

  const syncFromAudio = useCallback(audio => {
    const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    setCurrentTime(time);
    setActiveCue(getActiveCue(time, selectedExampleRef.current?.cues ?? []));
  }, []);

  // Read the media clock rather than scheduling cue-length timers. This also
  // catches cue boundaries between the browser's less frequent timeupdate events.
  useEffect(() => {
    if (playbackState !== 'playing') return undefined;
    let frame;
    const sync = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && !audio.ended) syncFromAudio(audio);
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, [playbackState, syncFromAudio]);

  const playOrPause = async () => {
    const audio = audioRef.current;
    if (!audio || playbackState === 'loading') return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    const resume = startedRef.current && playbackState === 'paused';
    if (!resume) {
      const index = Math.min(EXAMPLES.length - 1, Math.floor(Math.random() * EXAMPLES.length));
      const selectedExample = EXAMPLES[index];
      selectedExampleRef.current = selectedExample;
      setSelectedExampleIndex(index);
      startingRef.current = true;
      audio.src = selectedExample.src;
      try {
        audio.currentTime = 0;
      } catch {
        // The new recording may not expose a seek position until metadata loads.
      }
      setCurrentTime(0);
      setDuration(0);
      setActiveCue(null);
      startedRef.current = false;
    } else if (audio.ended) {
      audio.currentTime = 0;
    }

    setError('');
    const request = ++playRequestRef.current;
    setPlaybackState('loading');
    try {
      await audio.play();
      if (request !== playRequestRef.current) return;
      if (audio.paused || audio.ended) return;
      startedRef.current = true;
      startingRef.current = false;
      setPlaybackState('playing');
    } catch {
      if (request !== playRequestRef.current) return;
      startingRef.current = false;
      startedRef.current = false;
      setPlaybackState('idle');
      setActiveCue(null);
      setError('The paid Studio example could not be played. Please try again.');
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playRequestRef.current++;
    startingRef.current = false;
    startedRef.current = false;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers do not allow seeking until the audio metadata is ready.
    }
    setCurrentTime(0);
    setActiveCue(null);
    setPlaybackState('idle');
    setError('');
  };

  const seek = event => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Number(event.currentTarget.value);
    syncFromAudio(audio);
  };

  const activeName = playbackState === 'playing' || playbackState === 'paused'
    ? example?.name
    : null;
  const playLabel = playbackState === 'playing'
    ? `Pause Bespoke message example — ${activeName}`
    : playbackState === 'paused'
      ? `Resume Bespoke message example — ${activeName}`
      : playbackState === 'loading'
        ? 'Loading Bespoke message example'
        : 'Play Bespoke message example';
  const personalisedPlaying = playbackState === 'playing' && activeCue !== null;

  return (
    <section className="santa-studio-audio-example" aria-labelledby="santa-studio-audio-title">
      <h4 id="santa-studio-audio-title">
        Paid Studio message example{activeName ? ` — ${activeName}` : ''}
      </h4>
      <div className="santa-studio-audio-example__controls">
        <button
          className={`santa-studio-audio-example__play${personalisedPlaying ? ' santa-studio-audio-example__play--personalised' : ''}`}
          type="button"
          onClick={playOrPause}
          aria-busy={playbackState === 'loading'}
          aria-label={playLabel}
        >
          <span aria-hidden="true">{playbackState === 'playing' ? 'Ⅱ' : '▶'}</span>
          <span className="santa-studio-audio-example__label">Bespoke message example</span>
          <span className="santa-studio-audio-example__sparkles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
        </button>
        <button
          className="santa-studio-audio-example__stop"
          type="button"
          onClick={stop}
          disabled={playbackState === 'idle' && currentTime === 0 && !startedRef.current}
          aria-label="Stop and rewind paid Studio example"
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
          aria-label="Paid Studio message position"
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
        <p className="santa-studio-audio-example__status" role="status">Loading paid Studio example…</p>
      )}
      {error && <p className="santa-studio-audio-example__error" role="alert">{error}</p>}
      <audio
        ref={audioRef}
        className="santa-studio-audio-example__audio"
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
            syncFromAudio(event.currentTarget);
            startingRef.current = false;
            startedRef.current = true;
            setPlaybackState('playing');
          }
        }}
        onPause={event => {
          syncFromAudio(event.currentTarget);
          if (startedRef.current) setPlaybackState('paused');
          else if (!startingRef.current) setPlaybackState('idle');
        }}
        onEnded={() => {
          playRequestRef.current++;
          startingRef.current = false;
          setPlaybackState('idle');
          setActiveCue(null);
          startedRef.current = false;
        }}
        onError={() => {
          playRequestRef.current++;
          startingRef.current = false;
          setPlaybackState('idle');
          setActiveCue(null);
          startedRef.current = false;
          setError('The paid Studio example could not be loaded. Please try again.');
        }}
        onContextMenu={event => event.preventDefault()}
      />
    </section>
  );
}
