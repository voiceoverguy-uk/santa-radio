import { createPortal } from 'react-dom';
import SantaVideoPlayer from './SantaVideoPlayer.jsx';
import { useEffect, useRef, useState } from 'react';
import { santaNameDisplay } from '../lib/santaNameSearch.js';
import { createSantaVideo, createSantaVideoPoster } from '../lib/createSantaVideo.js';
import { trackMessageAction } from '../lib/messageEngagement.js';
import './SantaFreeVideo.css';
import { SantaGreetingShare } from './SantaMessageShare.jsx';

export default function SantaFreeVideo({ message, onDownload, onPlay, onEnded, previewTarget, onReady }) {
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const [hideProgress, setHideProgress] = useState(false);
  const [url, setUrl] = useState('');
  const [poster, setPoster] = useState('');
  const [videoBlob, setVideoBlob] = useState(null);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('Preparing your Christmas video…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    if (cancelled) return;
    const controller = new AbortController();
    let objectUrl;
    setHideProgress(false); setUrl(''); setPoster(''); setVideoBlob(null); setProgress(null); setError(''); setStatus('Preparing your Christmas video…');
    const name = santaNameDisplay(message.name);
    Promise.all([
      createSantaVideoPoster(name),
      createSantaVideo({
        audio: message.blob,
        name,
        signal: controller.signal,
        encodingStatus: `Santa is recording a message for ${name}… Keep this page open.`,
        onProgress: value => { if (!controller.signal.aborted) setProgress(value); },
        onStatus: text => { if (!controller.signal.aborted) setStatus(text); },
      }),
    ])
      .then(([cover, blob]) => {
        if (controller.signal.aborted) return;
        setPoster(cover); setVideoBlob(blob); objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); setStatus('Your Christmas video is ready.'); readyCallback.current?.();
      }).catch(() => {
        if (!controller.signal.aborted) { setError('Your video could not be prepared on this device. Please try again.'); setStatus(''); }
      });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message.blob, message.name, attempt, cancelled]);
  useEffect(() => {
    if (!url) return;
    const timer = setTimeout(() => setHideProgress(true), 3000);
    return () => clearTimeout(timer);
  }, [url]);
  const player = <SantaVideoPlayer poster={poster} src={url} preload="auto" glow label={`Santa’s video message for ${message.name}`} onPlay={onPlay} onPause={onEnded} onEnded={onEnded} onPlaying={() => trackMessageAction(message.statisticsReceipt, 'listen')} />;
  const filename = `Santa-message-for-${message.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'you'}.mp4`;
  return <div className="santa-free-video">
    {!error && !cancelled && !hideProgress && <div className="santa-free-video__progress"><progress aria-label="MP4 creation progress" max="1" value={progress ?? undefined} /><span>{progress === null ? 'Preparing…' : `${Math.floor(progress * 100)}%`}</span></div>}
    {!hideProgress && <p role="status" aria-live="polite">{cancelled ? 'Video preparation cancelled. You can try again below.' : status}</p>}
    {url && !cancelled && <>
      {previewTarget ? createPortal(player, previewTarget) : player}
      <div className="santa-free-video__actions">
      <a className="btn-red santa-free-video__download" href={url} download={filename} onClick={() => {
        trackMessageAction(message.statisticsReceipt, 'mp4-download');
        trackMessageAction(message.statisticsReceipt, 'download');
        onDownload?.();
      }}>Download your message</a>
      <SantaGreetingShare message={{ ...message, blob: videoBlob }} filename={filename} />
      </div>
    </>}
    {!url && !error && !cancelled && <button type="button" onClick={() => setCancelled(true)}>Cancel video preparation</button>}
    {error && <p role="alert">{error}</p>}
    {(error || cancelled) && <button type="button" onClick={() => { setCancelled(false); setAttempt(value => value + 1); }}>Prepare video again</button>}
  </div>;
}
