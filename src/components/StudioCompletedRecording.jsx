import StudioPreparationRunner from './StudioPreparationRunner.jsx';
import StudioAccountSave from './StudioAccountSave.jsx';
import { useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import StudioBundleDownload from './StudioBundleDownload.jsx';
import SantaVideoPlayer from './SantaVideoPlayer.jsx';
import { SantaGreetingShare } from './SantaMessageShare.jsx';
import { createStudioVideo, createStudioVideoPoster, studioVideoFilename, STUDIO_VIDEO_ARTWORK } from '../lib/studioVideo.js';
import './SantaFreeVideo.css';

// The captured recording and gift details own the name and age, never the next draft.
export default function StudioCompletedRecording({ result, ordinal, visible, sectionRef, onDownloadRequested, onBundlePreparing, onBundleRequested, onVideoReady }) {
  const radio = useRadio();
  const section = useRef(null), resume = useRef(null), playingVideo = useRef(null);
  const callbacks = useRef({ onVideoReady, onBundlePreparing });
  callbacks.current = { onVideoReady, onBundlePreparing };
  const [poster, setPoster] = useState('');
  useEffect(() => {
    let active = true;
    createStudioVideoPoster(result)
      .then(image => { if (active) setPoster(image); })
      .catch(() => { if (active) setPoster(STUDIO_VIDEO_ARTWORK); });
    return () => { active = false; };
  }, [result.writtenName, result.gift, result.videoBlob]);
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('Preparing your premium Christmas video…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [hideProgress, setHideProgress] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const finish = () => { const restore = resume.current; resume.current = null; restore?.(); };
  useEffect(() => {
    if (result.videoBlob) return;
    const controller = new AbortController();
    setError(''); setProgress(null); setHideProgress(false);
    callbacks.current.onBundlePreparing?.(true);
    createStudioVideo(result, { signal: controller.signal, onProgress: value => { if (!controller.signal.aborted) setProgress(value === null ? null : 0.2 + value * 0.8); }, onStatus: text => { if (!controller.signal.aborted) setStatus(text); } })
      .then(blob => { if (!controller.signal.aborted) callbacks.current.onVideoReady?.(blob); })
      .catch(() => { if (!controller.signal.aborted) setError('Your video could not be prepared. Retry below — Santa’s recording is kept here and no extra message credit is used.'); })
      .finally(() => { if (!controller.signal.aborted) callbacks.current.onBundlePreparing?.(false); });
    return () => { controller.abort(); callbacks.current.onBundlePreparing?.(false); };
  }, [result.audioBlob, result.videoBlob, attempt]);
  useEffect(() => {
    if (!result.videoBlob) return;
    const objectUrl = URL.createObjectURL(result.videoBlob);
    setUrl(objectUrl); setProgress(1); setStatus('Your personalised Christmas video is ready.');
    const timer = setTimeout(() => setHideProgress(true), 3000);
    return () => { clearTimeout(timer); URL.revokeObjectURL(objectUrl); };
  }, [result.videoBlob]);
  useEffect(() => {
    const stop = () => { playingVideo.current?.pause(); finish(); };
    document.addEventListener('studio-stop-audio', stop);
    return () => { document.removeEventListener('studio-stop-audio', stop); stop(); };
  }, []);
  useEffect(() => { if (!visible) { section.current?.querySelector('video')?.pause(); finish(); } }, [visible]);
  return <section className="smw-message-result smw-message-finished" ref={node => {
    section.current = node;
    if (typeof sectionRef === 'function') sectionRef(node); else if (sectionRef) sectionRef.current = node;
  }} tabIndex={-1} aria-label={ordinal === 1 ? 'Your finished Santa message' : 'Your second finished Santa message'}>
    <h4>{ordinal === 1 ? 'First' : 'Second'} Santa message for {result.writtenName}</h4>
    {!hideProgress && !error && <><div className="santa-free-video__progress"><progress aria-label="Premium MP4 creation progress" max="1" value={progress ?? undefined} /><span>{progress === null ? 'Preparing…' : `${Math.floor(progress * 100)}%`}</span></div><p role="status">{status}</p>{!result.videoBlob && <StudioPreparationRunner costume="classic" />}</>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry video preparation</button></div>}
    {url && <>
      <SantaVideoPlayer poster={poster || STUDIO_VIDEO_ARTWORK} src={url} preload="auto" glow label={`Santa’s premium video message for ${result.writtenName}`} onPlay={event => {
        playingVideo.current = event.currentTarget;
        for (const other of document.querySelectorAll('audio, video')) if (other !== event.currentTarget) other.pause();
        resume.current = radio?.pauseForMessage?.() || null;
      }} onPause={finish} onEnded={finish} />
      <div className="smw-download-actions">
        <div className="smw-download-control">
          <a className={`smw-button smw-button-download${result.requested ? '' : ' smw-button-download--pending'}`} href={url} download={studioVideoFilename(result)}
            onClick={() => { setDownloaded(true); onDownloadRequested(); }}>Download your message <span aria-hidden="true">↓</span></a>
          {downloaded && <span className="smw-download-status" role="status">Downloaded</span>}
        </div>
        <SantaGreetingShare message={{ name: result.writtenName, blob: result.videoBlob }} filename={studioVideoFilename(result)} />
        <StudioBundleDownload result={result} onPreparing={onBundlePreparing} onDownloadRequested={() => { onDownloadRequested(); onBundleRequested?.(); }} />
      </div>
      <StudioAccountSave result={result} />
    </>}
  </section>;
}
