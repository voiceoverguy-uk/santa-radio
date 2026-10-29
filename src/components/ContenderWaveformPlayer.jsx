import { useCallback, useEffect, useRef, useState } from 'react';
import './ContenderWaveformPlayer.css';

const waveformCache = new Map();

function getWaveform(url) {
  if (!url) return Promise.reject(new Error('Waveform unavailable'));
  if (!waveformCache.has(url)) {
    const request = fetch(url, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Waveform unavailable');
        return response.json();
      })
      .then(payload => {
        if (!Array.isArray(payload?.peaks) || !payload.peaks.length) {
          throw new Error('Waveform unavailable');
        }
        return {
          duration: Number.isFinite(Number(payload.duration)) && Number(payload.duration) > 0
            ? Number(payload.duration) : 0,
          peaks: payload.peaks.map(value => Math.max(0, Math.min(1, Number(value) || 0))),
        };
      });
    waveformCache.set(url, request);
    request.catch(() => waveformCache.delete(url));
  }
  return waveformCache.get(url);
}

function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function ContenderWaveformPlayer({
  audioRef,
  onClaim,
  onRelease,
  src,
  waveform,
  title,
  artist,
}) {
  const elementRef = useRef(null);
  const playIntent = useRef(false);
  const playAttempt = useRef(0);
  const pendingSeek = useRef(null);
  const [peaks, setPeaks] = useState(null);
  const [waveformFailed, setWaveformFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState('');

  const setAudioElement = useCallback(element => {
    elementRef.current = element;
    audioRef?.(element);
  }, [audioRef]);

  useEffect(() => {
    let mounted = true;
    setPeaks(null);
    setWaveformFailed(false);
    if (!waveform?.url) {
      setWaveformFailed(true);
      return () => { mounted = false; };
    }
    getWaveform(waveform.url).then(result => {
      if (mounted) setPeaks(result.peaks);
    }).catch(() => {
      if (mounted) setWaveformFailed(true);
    });
    return () => { mounted = false; };
  }, [waveform?.url]);

  useEffect(() => {
    const audio = elementRef.current;
    setCurrentTime(0);
    setMediaDuration(0);
    setPlaying(false);
    setPlaybackError('');
    if (audio && src) audio.src = src;
    return () => {
      playAttempt.current += 1;
      playIntent.current = false;
      pendingSeek.current = null;
      if (audio) {
        audio.pause();
        onRelease?.(audio);
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, [onRelease, src]);

  const duration = mediaDuration || (Number.isFinite(Number(waveform?.duration))
    ? Number(waveform.duration) : 0);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const claim = audio => {
    if (!audio) return;
    onClaim?.(audio);
  };

  const togglePlayback = () => {
    const audio = elementRef.current;
    if (!audio || !src) return;
    setPlaybackError('');
    if (playIntent.current || !audio.paused) {
      playAttempt.current += 1;
      playIntent.current = false;
      pendingSeek.current = null;
      audio.pause();
      onRelease?.(audio);
      return;
    }

    playIntent.current = true;
    const attempt = ++playAttempt.current;
    claim(audio);
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(error => {
        if (error?.name === 'AbortError') return; // Switching audio owners intentionally cancels pending playback.
        if (playAttempt.current === attempt && playIntent.current) {
          playIntent.current = false;
          setPlaybackError('Playback could not start. Please try again.');
          onRelease?.(audio);
        }
      });
    }
  };

  const seekTo = value => {
    const audio = elementRef.current;
    if (!audio || !duration) return;
    const nextTime = Math.max(0, Math.min(duration, Number(value) || 0));
    setCurrentTime(nextTime);
    if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(nextTime, audio.duration);
      pendingSeek.current = null;
    } else {
      pendingSeek.current = nextTime;
      if (audio.paused && audio.networkState !== 2) {
        audio.preload = 'metadata';
        audio.load();
      }
    }
  };

  const onMetadata = event => {
    const audio = event.currentTarget;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setMediaDuration(audio.duration);
    }
    if (pendingSeek.current !== null) {
      const target = pendingSeek.current;
      pendingSeek.current = null;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(target, audio.duration);
        setCurrentTime(audio.currentTime);
      }
    }
  };

  return (
    <div className="contender-wave-player">
      <audio
        ref={setAudioElement}
        src={src || undefined}
        preload="none"
        aria-hidden="true"
        onLoadedMetadata={onMetadata}
        onDurationChange={onMetadata}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={event => {
          const audio = event.currentTarget;
          if (audio.paused) return;
          if (!playIntent.current) {
            playIntent.current = true;
            claim(audio);
          }
          setPlaying(true);
        }}
        onPlaying={event => {
          const audio = event.currentTarget;
          if (!audio.paused && playIntent.current) {
            setPlaying(true);
          }
        }}
        onPause={() => {
          setPlaying(false);
          playIntent.current = false;
          playAttempt.current += 1;
          onRelease?.(elementRef.current);
        }}
        onEnded={() => {
          setPlaying(false);
          playIntent.current = false;
          setCurrentTime(elementRef.current?.currentTime || 0);
          onRelease?.(elementRef.current);
        }}
        onError={() => {
          if (playIntent.current) {
            setPlaybackError('This recording could not be played.');
            playIntent.current = false;
            setPlaying(false);
            onRelease?.(elementRef.current);
          }
        }}
      />
      <button
        className={`contender-wave-player__toggle${playing ? ' is-playing' : ''}`}
        type="button"
        onClick={togglePlayback}
        disabled={!src}
        aria-label={`${playing ? 'Pause' : 'Play'} ${title} by ${artist}`}
      >
        <span className="contender-wave-player__icon" aria-hidden="true" />
      </button>
      <div className="contender-wave-player__track">
        <div className="contender-wave-player__times" aria-label="Elapsed time and duration" aria-live="off">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className={`contender-wave-player__wave${peaks ? '' : ' is-unavailable'}`}>
          {peaks && <div
            className="contender-wave-player__bars"
            aria-hidden="true"
            style={{ '--wave-bin-count': peaks.length }}
          >
            {peaks.map((height, index) => (
              <i
                key={index}
                className={index / peaks.length <= progress ? 'is-played' : ''}
                style={{ '--peak-height': `${Math.max(8, height * 100)}%` }}
              />
            ))}
          </div>}
          <input
            className="contender-wave-player__seek"
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={event => seekTo(event.target.value)}
            disabled={!duration || !src}
            aria-label={`${artist} — ${title} playback position`}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
        </div>
        {waveformFailed && <span className="contender-wave-player__notice" role="status">
          Waveform unavailable; playback is still available.
        </span>}
        {playbackError && <span className="contender-wave-player__notice" role="status">{playbackError}</span>}
      </div>
    </div>
  );
}
