import { useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import { getWorkshopDownloadName } from '../lib/workshopNameSpelling.js';
import StudioBundleDownload from './StudioBundleDownload.jsx';

// A visit-local result owns its playback, independently of the editable draft.
export default function StudioCompletedRecording({ result, ordinal, visible, sectionRef, onDownloadRequested, onBundlePreparing, onBundleRequested }) {
  const radio = useRadio();
  const audioRef = useRef(null);
  const resumeRef = useRef(null);
  const [error, setError] = useState('');
  const finish = () => {
    const resume = resumeRef.current;
    resumeRef.current = null;
    resume?.();
  };
  useEffect(() => {
    // Capture the element: React clears refs before passive unmount cleanup.
    // A detached media element can otherwise continue playing between stages.
    const audio = audioRef.current;
    const stop = () => { audio?.pause(); finish(); };
    const otherPlayback = event => {
      if (event.target !== audioRef.current) {
        resumeRef.current = null;
        audioRef.current?.pause();
      }
    };
    document.addEventListener('play', otherPlayback, true);
    document.addEventListener('studio-stop-audio', stop);
    return () => {
      document.removeEventListener('play', otherPlayback, true);
      document.removeEventListener('studio-stop-audio', stop);
      stop();
    };
  }, []);
  useEffect(() => {
    if (!visible) { audioRef.current?.pause(); finish(); }
  }, [visible]);
  return <section className="smw-message-result smw-message-finished" ref={sectionRef}
    tabIndex={-1} aria-label={ordinal === 1 ? 'Your finished Santa message' : 'Your second finished Santa message'}>
    <h4>{ordinal === 1 ? 'First' : 'Second'} Santa message for {result.writtenName}</h4>
    <audio ref={audioRef} src={result.url} controls preload="metadata"
      aria-label={`Play ${ordinal === 1 ? 'first' : 'second'} Santa message for ${result.writtenName}`}
      onPlay={event => {
        for (const other of document.querySelectorAll('audio')) if (other !== event.currentTarget) other.pause();
        resumeRef.current = radio?.pauseForMessage?.() || null;
      }} onPause={finish} onEnded={finish}
      onError={() => { finish(); setError('Your browser could not play this MP3. You can still try downloading it.'); }} />
    <div className="smw-download-actions">
      <a className={`smw-button smw-button-download${result.requested ? '' : ' smw-button-download--pending'}`}
        href={result.url} download={getWorkshopDownloadName(result.record.name, result.spelling)}
        onClick={onDownloadRequested}>Download Audio <span aria-hidden="true">↓</span></a>
      <StudioBundleDownload result={result} onPreparing={onBundlePreparing}
        onDownloadRequested={() => { onDownloadRequested(); onBundleRequested?.(); }} />
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
