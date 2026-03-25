import { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

const STREAM_URL = 'https://streaming.zeno.fm/yn65fsaurfhvv';

export default function AudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('Carly Rae Jepsen - It\'s Not Christmas Till Somebody Cries');
  const audioRef = useRef(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setLoading(true);
      audio.load();
      audio.play()
        .then(() => {
          setPlaying(true);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setPlaying(false);
    const handleError = () => { setPlaying(false); setLoading(false); };
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className="audio-player">
      <audio ref={audioRef} preload="none">
        <source src={STREAM_URL} type="audio/mpeg" />
      </audio>

      <button
        className={`play-button ${playing ? 'playing' : ''} ${loading ? 'loading' : ''}`}
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading ? (
          <span className="spinner" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" fill="white" width="40" height="40">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="white" width="40" height="40">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
        {!loading && !playing && <div className="play-label">PLAY NOW</div>}
      </button>

      <div className="now-playing">
        <span className="now-playing-track">{nowPlaying}</span>
      </div>
    </div>
  );
}
