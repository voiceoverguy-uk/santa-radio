import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import { refreshWorkshopNamePreview } from '../lib/workshopNamePreview.js';

export default function WorkshopNamePreview({ record }) {
  const radio = useRadio();
  const sessionRef = useRef(null);
  const errorId = useId();
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const finish = useCallback(({ session = sessionRef.current, failed = false, message = '', resume = true, notify = true } = {}) => {
    if (!session || sessionRef.current !== session) return;
    sessionRef.current = null;
    clearTimeout(session.timeout);
    session.controller.abort();
    session.audio.onplaying = session.audio.onended = session.audio.onerror = null;
    session.audio.pause();
    session.audio.removeAttribute('src');
    session.audio.load();
    if (resume) session.resumeRadio?.();
    if (notify) {
      setPhase('idle');
      setError(failed ? message || 'Santa’s recorded name could not be played. Please try again.' : '');
    }
  }, []);

  useEffect(() => {
    const onOtherPlayback = event => {
      if (sessionRef.current && event.target !== sessionRef.current.audio) finish({ resume: false });
    };
    document.addEventListener('play', onOtherPlayback, true);
    return () => {
      document.removeEventListener('play', onOtherPlayback, true);
      finish({ notify: false });
    };
  }, [finish]);

  const toggle = () => {
    if (sessionRef.current) { finish(); return; }
    setError('');
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.5;
    const session = { audio, controller: new AbortController(), resumeRadio: radio?.pauseForMessage?.() || null };
    for (const other of document.querySelectorAll('audio')) other.pause();
    sessionRef.current = session;
    setPhase('loading');
    audio.onplaying = () => {
      if (sessionRef.current !== session) return;
      clearTimeout(session.timeout);
      setPhase('playing');
    };
    audio.onended = () => finish({ session });
    audio.onerror = () => finish({ session, failed: true });
    session.timeout = setTimeout(() => finish({ session, failed: true }), 15000);
    refreshWorkshopNamePreview(record, { signal: session.controller.signal })
      .then(src => {
        if (sessionRef.current !== session) return;
        audio.src = src;
        return audio.play();
      })
      .catch(error => {
        if (sessionRef.current !== session) return;
        finish({ session, failed: true, message: error.name === 'NotAllowedError'
          ? 'Your browser blocked playback. Please press Play again.'
          : error.message });
      });
  };

  const active = phase !== 'idle';
  return (
    <span className="smw-name-preview">
      <button className="smw-name-preview-button" type="button" onClick={toggle}
        aria-label={`${active ? 'Stop' : 'Play'} recorded name for ${record?.name || 'this name'}`}
        aria-pressed={active} aria-busy={phase === 'loading'} aria-describedby={error ? errorId : undefined}
        title={active ? 'Stop name preview' : 'Hear just Santa’s recorded name'}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {active ? <path d="M6 6h12v12H6z" /> : <path d="M8 4v16l13-8z" />}
        </svg>
      </button>
      <span className="smw-name-preview-status" role="status">
        {phase === 'loading' ? 'Loading name…' : phase === 'playing' ? 'Playing name…' : ''}
      </span>
      {error && <span className="smw-name-preview-error" id={errorId} role="alert">{error}</span>}
    </span>
  );
}
