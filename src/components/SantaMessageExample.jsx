import { useCallback, useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import './SantaMessageExample.css';

const ROTATION_KEY = 'santa-radio-example-last';
const EXAMPLES = [
  { key: 'boy', src: '/audio/examples/santa-message-boy.mp3' },
  { key: 'girl', src: '/audio/examples/santa-message-girl.mp3' },
];

let lastSuccessfulExample = null;

function getLastSuccessfulExample() {
  try {
    const stored = window.sessionStorage.getItem(ROTATION_KEY);
    if (stored === 'boy' || stored === 'girl') return stored;
  } catch {
    // Private browsing and locked-down storage use the in-memory rotation.
  }
  return lastSuccessfulExample || 'girl';
}

function rememberSuccessfulExample(key) {
  lastSuccessfulExample = key;
  try {
    window.sessionStorage.setItem(ROTATION_KEY, key);
  } catch {
    // Keep the rotation for this page session even when storage is unavailable.
  }
}

export default function SantaMessageExample() {
  const radio = useRadio();
  const audioRef = useRef(null);
  const sessionRef = useRef(null);
  const stopRef = useRef(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  const stopPlayback = useCallback(({ resumeRadio = true } = {}) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.audio.pause();
    try { session.audio.currentTime = 0; } catch {
      // The media may not have loaded metadata yet.
    }
    session.audio.removeAttribute('src');
    session.audio.load();
    setState('idle');
    if (resumeRadio && session.resumeRadio) {
      const resume = session.resumeRadio;
      session.resumeRadio = null;
      resume();
    } else {
      session.resumeRadio = null;
    }
  }, []);
  stopRef.current = stopPlayback;

  const markStarted = session => {
    if (sessionRef.current !== session || session.started) return;
    session.started = true;
    rememberSuccessfulExample(session.example.key);
    setState('playing');
  };

  const finishPlayback = (session, { failed = false, resumeRadio = true } = {}) => {
    if (sessionRef.current !== session) return;
    sessionRef.current = null;
    session.audio.pause();
    try { session.audio.currentTime = 0; } catch {
      // The media may not have loaded metadata yet.
    }
    session.audio.removeAttribute('src');
    session.audio.load();
    setState('idle');
    if (resumeRadio && session.resumeRadio) {
      const resume = session.resumeRadio;
      session.resumeRadio = null;
      resume();
    } else {
      session.resumeRadio = null;
    }
    if (failed) setError('Santa’s example could not be played. Please try again.');
  };

  useEffect(() => {
    const audio = audioRef.current;
    const onOtherAudioPlay = event => {
      if (event.target !== audio && sessionRef.current) {
        stopRef.current?.({ resumeRadio: false });
      }
    };
    const onSoundboardStart = () => {
      if (sessionRef.current) stopRef.current?.({ resumeRadio: false });
    };
    document.addEventListener('play', onOtherAudioPlay, true);
    document.addEventListener('santa-radio:soundboard-start', onSoundboardStart);
    return () => {
      document.removeEventListener('play', onOtherAudioPlay, true);
      document.removeEventListener('santa-radio:soundboard-start', onSoundboardStart);
      stopRef.current?.({ resumeRadio: true });
    };
  }, []);

  const startOrStop = () => {
    if (sessionRef.current) {
      stopPlayback();
      return;
    }

    setError('');
    const previous = getLastSuccessfulExample();
    const example = EXAMPLES.find(item => item.key !== previous) || EXAMPLES[0];
    const audio = audioRef.current;
    if (!audio) return;

    const resumeRadio = radio?.pauseForMessage?.() || null;

    for (const otherAudio of document.querySelectorAll('audio')) {
      if (otherAudio !== audio) otherAudio.pause();
    }
    document.dispatchEvent(new CustomEvent('santa-radio:example-start'));

    const session = {
      audio,
      example,
      resumeRadio,
      started: false,
    };
    sessionRef.current = session;
    setState('loading');
    audio.src = example.src;
    audio.load();

    try {
      Promise.resolve(audio.play()).then(() => {
        if (sessionRef.current === session) markStarted(session);
      }).catch(() => {
        finishPlayback(session, { failed: true });
      });
    } catch {
      finishPlayback(session, { failed: true });
    }
  };

  return <div className="santa-message-example">
    <button
      className="santa-message-example__button"
      type="button"
      onClick={startOrStop}
      aria-busy={state === 'loading'}
      aria-describedby={error ? 'santa-message-example-error' : undefined}
    >
      <span className="santa-message-example__mark" aria-hidden="true">
        {state === 'idle' ? '▶' : '■'}
      </span>
      {state === 'idle' ? 'Hear an example message' : 'Stop example message'}
    </button>
    {state === 'loading' && <p className="santa-message-example__status" role="status">Loading Santa’s example…</p>}
    {error && <p className="santa-message-example__error" id="santa-message-example-error" role="alert">{error}</p>}
    <audio
      ref={audioRef}
      className="santa-message-example__audio"
      preload="none"
      controls={false}
      controlsList="nodownload noremoteplayback"
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={event => {
        const session = sessionRef.current;
        if (session?.audio === event.currentTarget) markStarted(session);
      }}
      onEnded={() => {
        const session = sessionRef.current;
        if (session) finishPlayback(session);
      }}
      onError={() => {
        const session = sessionRef.current;
        if (session) finishPlayback(session, { failed: true });
      }}
      onContextMenu={event => event.preventDefault()}
    />
  </div>;
}
