import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import { workshopNamePreviewUrl } from '../lib/workshopNamePreview.js';

export default function WorkshopNamePreview({ record }) {
  const radio = useRadio();
  const sessionRef = useRef(null);
  const errorId = useId();
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const finish = useCallback(({ session = sessionRef.current, failed = false, resume = true, notify = true } = {}) => {
    if (!session || sessionRef.current !== session) return;
    sessionRef.current = null;
    clearTimeout(session.timeout);
    session.audio.onplaying = session.audio.onended = session.audio.onerror = null;
    session.audio.pause();
    session.audio.removeAttribute('src');
    session.audio.load();
    if (resume) session.resumeRadio?.();
    if (notify) {
      setPhase('idle');
      setError(failed ? 'Santa’s recorded name could not be played. Please try again.' : '');
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
    const src = workshopNamePreviewUrl(record);
    if (!src) { setError('This recorded name preview is unavailable. Please choose the name again or try later.'); return; }
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.5;
    const session = { audio, resumeRadio: radio?.pauseForMessage?.() || null };
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
    audio.src = src;
    try {
      Promise.resolve(audio.play()).catch(() => finish({ session, failed: true }));
    } catch {
      finish({ session, failed: true });
    }
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
